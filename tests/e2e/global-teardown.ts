import fs from 'node:fs'
import path from 'node:path'
import { E2E_TMP_DIR } from './fixtures/paths'

// Empties the project-local e2e temp dir so browser/node junk never accumulates.
export default function globalTeardown(): void {
  const dir = path.resolve(E2E_TMP_DIR)
  const suffix = path.join('test-results', '.tmp')
  const systemTmp = process.env.E2E_SYSTEM_TMP
  if (!dir.endsWith(path.sep + suffix) || (systemTmp && dir === path.resolve(systemTmp))) {
    throw new Error(`Refusing to clean unexpected directory: ${dir}`)
  }
  for (const entry of fs.readdirSync(dir)) {
    try {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
    } catch {
      // best effort
    }
  }
}
