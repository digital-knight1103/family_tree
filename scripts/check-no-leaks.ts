import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { FamilyData } from '../src/domain/schema.ts'

const CANARY = 'CANARY_LEAK_TEST_7f3a'
const DEMO_SURNAME = 'Kowalczyk'
const IMAGE_EXTENSION = /\.(webp|jpe?g|png)$/i
const ALLOWED_IMAGE_PREFIXES = ['public/', 'src/assets/']
/** The README screenshot of the demo family; one exact path, not the whole docs/ folder. */
const ALLOWED_IMAGE_PATHS = ['docs/screenshot.png']
/** A person id (PERSON_ID_PATTERN) as a whole quoted string literal, in any quoting the bundle uses. */
const QUOTED_PERSON_ID = /["'`](p_[A-Za-z0-9_-]+)\\?["'`]/g

export function checkTrackedFiles(trackedPaths: string[]): string[] {
  const violations: string[] = []
  for (const trackedPath of trackedPaths) {
    if (trackedPath.startsWith('data/family/')) {
      violations.push(`Plik z folderu danych jest śledzony przez git: ${trackedPath}`)
    } else if (
      IMAGE_EXTENSION.test(trackedPath) &&
      !ALLOWED_IMAGE_PATHS.includes(trackedPath) &&
      !ALLOWED_IMAGE_PREFIXES.some((prefix) => trackedPath.startsWith(prefix))
    ) {
      violations.push(`Zdjęcie poza dozwolonymi folderami jest śledzone przez git: ${trackedPath}`)
    }
  }
  return violations
}

function listFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(full))
    else files.push(full)
  }
  return files
}

function filesContaining(distDir: string, needle: string): string[] {
  const needleBytes = Buffer.from(needle, 'utf8')
  return listFiles(distDir).filter((file) => fs.readFileSync(file).includes(needleBytes))
}

export function checkDistForCanary(distDir: string, canary: string): string[] {
  return filesContaining(distDir, canary)
}

function listEntries(dir: string): { full: string; isDirectory: boolean }[] {
  const entries: { full: string; isDirectory: boolean }[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    entries.push({ full, isDirectory: entry.isDirectory() })
    if (entry.isDirectory()) entries.push(...listEntries(full))
  }
  return entries
}

export function checkDistHasNoDataFiles(distDir: string): string[] {
  return listEntries(distDir)
    .filter(({ full, isDirectory }) => {
      const name = path.basename(full)
      if (isDirectory) return name === '.backups' || name === 'photos'
      return name === 'family.json' || name.toLowerCase().endsWith('.webp')
    })
    .map(({ full }) => full)
}

/** Person ids in dist text must be exactly the seed's: no others, none missing. */
export function checkDistMatchesSeed(distDir: string, seed: FamilyData): string[] {
  const seedIds = new Set(seed.persons.map((person) => person.id))
  const distIds = new Set<string>()
  for (const file of listFiles(distDir)) {
    for (const [, id] of fs.readFileSync(file, 'utf8').matchAll(QUOTED_PERSON_ID)) {
      if (id) distIds.add(id)
    }
  }
  return [
    ...[...distIds]
      .filter((id) => !seedIds.has(id))
      .map((id) => `Build zawiera osobę spoza danych demo: ${id}`),
    ...[...seedIds]
      .filter((id) => !distIds.has(id))
      .map((id) => `Build nie zawiera osoby z danych demo: ${id}`),
  ]
}

function main(): number {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url))
  const distDir = path.join(projectRoot, 'dist')
  if (!fs.existsSync(distDir)) {
    console.error('Brak folderu dist. Najpierw uruchom: pnpm build')
    return 1
  }

  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean)

  const seed = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'data', 'seed', 'demo-family.json'), 'utf8'),
  ) as FamilyData
  const relative = (file: string) => path.relative(projectRoot, file).split(path.sep).join('/')
  const violations = [
    ...checkTrackedFiles(tracked),
    ...checkDistForCanary(distDir, CANARY).map(
      (file) => `Kanarek danych znaleziony w pliku: ${relative(file)}`,
    ),
    ...checkDistHasNoDataFiles(distDir).map(
      (file) => `Plik lub folder z danymi w buildzie: ${relative(file)}`,
    ),
    ...checkDistMatchesSeed(distDir, seed),
  ]
  if (filesContaining(distDir, DEMO_SURNAME).length === 0) {
    violations.push(`Build nie zawiera danych demo (brak nazwiska „${DEMO_SURNAME}” w dist)`)
  }

  if (violations.length > 0) {
    console.error(
      ['Wykryto problemy z ochroną danych:', ...violations.map((v) => `  - ${v}`)].join('\n'),
    )
    return 1
  }
  console.log('OK: brak wycieku danych, build zawiera wyłącznie dane demo')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}
