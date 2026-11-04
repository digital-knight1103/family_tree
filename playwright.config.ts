import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { E2E_DATA_DIR } from './tests/e2e/fixtures/data-dir'
import { E2E_TMP_DIR } from './tests/e2e/fixtures/paths'

// Chromium profile cleanup in the system %TEMP% is denied on this machine and hangs Playwright, so use a project-local temp dir.
fs.mkdirSync(E2E_TMP_DIR, { recursive: true })
process.env.TEMP = E2E_TMP_DIR
process.env.TMP = E2E_TMP_DIR

const BASE_URL = 'http://localhost:5179'

export default defineConfig({
  testDir: 'tests/e2e',
  // Outside test-results/.tmp, which Playwright would otherwise wipe at run start.
  outputDir: 'test-results/artifacts',
  globalSetup: './tests/e2e/global-setup.ts',
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
