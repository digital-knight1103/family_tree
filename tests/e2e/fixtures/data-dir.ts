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

export type DataDirKind = 'empty' | 'seed-copy' | 'corrupt'

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
      fs.writeFileSync(familyFile, '{"version":1,"persons":[')
      break
  }
}
