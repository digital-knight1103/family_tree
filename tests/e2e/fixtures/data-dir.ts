import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// playwright.config.ts redirects TEMP to a project-local dir; keep the data dir in the real system tmp in every process.
process.env.E2E_SYSTEM_TMP ??= os.tmpdir()

export const E2E_DATA_DIR = path.join(process.env.E2E_SYSTEM_TMP, 'family tree e2e')

export type DataDirKind = 'empty'

export function resetDataDir(kind: DataDirKind): void {
  fs.rmSync(E2E_DATA_DIR, { recursive: true, force: true })
  fs.mkdirSync(E2E_DATA_DIR, { recursive: true })
  switch (kind) {
    case 'empty':
      break
  }
}
