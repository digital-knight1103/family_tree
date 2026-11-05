import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// playwright.config.ts redirects TEMP to a project-local dir; keep the data dir in the real system tmp in every process.
process.env.E2E_SYSTEM_TMP ??= os.tmpdir()

export const E2E_DATA_DIR = path.join(process.env.E2E_SYSTEM_TMP, 'family tree e2e')

const SEED_FILE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'data',
  'seed',
  'demo-family.json',
)

export type DataDirKind = 'empty' | 'seed-copy' | 'corrupt' | 'zero-bytes'

// Valid JSON that fails domain validation: Jan is a parent of Jozef and Jozef becomes a parent of Jan.
function seedWithParentChildCycle(): { parentChild: unknown[] } {
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as { parentChild: unknown[] }
  seed.parentChild.push({
    parentId: 'p_jozef_kowalczyk',
    childId: 'p_jan_kowalczyk',
    type: 'biological',
  })
  return seed
}

export function resetDataDir(kind: DataDirKind): void {
  fs.rmSync(E2E_DATA_DIR, { recursive: true, force: true })
  fs.mkdirSync(E2E_DATA_DIR, { recursive: true })
  const familyFile = path.join(E2E_DATA_DIR, 'family.json')
  switch (kind) {
    case 'empty':
      break
    case 'seed-copy':
      fs.copyFileSync(SEED_FILE, familyFile)
      break
    case 'corrupt':
      fs.writeFileSync(familyFile, JSON.stringify(seedWithParentChildCycle(), null, 2))
      break
    case 'zero-bytes':
      fs.writeFileSync(familyFile, '')
      break
  }
}
