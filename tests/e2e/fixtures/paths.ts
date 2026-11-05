import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Project-local temp dir used instead of the system %TEMP% during e2e runs.
export const E2E_TMP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../test-results/.tmp',
)
