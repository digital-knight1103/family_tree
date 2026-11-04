import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { E2E_DATA_DIR, resetDataDir } from './tests/e2e/fixtures/data-dir'

resetDataDir('empty')

// Chromium profile cleanup in the system %TEMP% is denied on this machine and hangs Playwright, so use a project-local temp dir.
const TMP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-results', '.tmp')
fs.mkdirSync(TMP_DIR, { recursive: true })
process.env.TEMP = TMP_DIR
process.env.TMP = TMP_DIR

const BASE_URL = 'http://localhost:5179'

export default defineConfig({
  testDir: 'tests/e2e',
  // Outside test-results/.tmp, which Playwright would otherwise wipe at run start.
  outputDir: 'test-results/artifacts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  workers: 1,
  use: { baseURL: BASE_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev --port 5179 --strictPort',
    url: BASE_URL,
    env: { FAMILY_DATA_DIR: E2E_DATA_DIR },
    reuseExistingServer: false,
  },
})
