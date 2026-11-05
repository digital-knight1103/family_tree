import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseFamilyJson } from '../src/domain/validate'
import { resolveDataDir } from './resolve-data-dir'

export function validateFile(filePath: string): { ok: true } | { ok: false; report: string } {
  const result = parseFamilyJson(fs.readFileSync(filePath, 'utf8'))
  if (result.ok) return { ok: true }
  const lines = result.errors.map((e) => `  ${e.path || '(cały plik)'}: ${e.message}`)
  return { ok: false, report: [`Błędy w ${filePath}:`, ...lines].join('\n') }
}

function main(): number {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url))
  const envFile = path.join(projectRoot, '.env')
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

  const useSeed = process.argv.includes('--seed')
  const filePath = useSeed
    ? path.join(projectRoot, 'data', 'seed', 'demo-family.json')
    : path.join(resolveDataDir(process.env, projectRoot), 'family.json')

  if (!fs.existsSync(filePath)) {
    console.log(`Brak family.json w ${path.dirname(filePath)}, nic do walidacji`)
    return 0
  }

  const result = validateFile(filePath)
  if (!result.ok) {
    console.error(result.report)
    return 1
  }
  console.log(`OK: ${path.relative(projectRoot, filePath).split(path.sep).join('/')}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}
