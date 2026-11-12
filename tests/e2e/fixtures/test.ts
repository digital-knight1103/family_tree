import { test as base, expect } from '@playwright/test'
import { SPLASH } from '@/app/splash/splash-config'

/**
 * Playwright `test` with a `splash` option: by default (`false`) the welcome screen is marked
 * as already shown, so tests start straight on the app. Opt in with `test.use({ splash: true })`.
 */
export const test = base.extend<{ splash: boolean; skipSplash: void }>({
  splash: [false, { option: true }],
  skipSplash: [
    async ({ page, splash }, use) => {
      if (!splash) {
        await page.addInitScript((key) => sessionStorage.setItem(key, '1'), SPLASH.sessionKey)
      }
      await use()
    },
    { auto: true },
  ],
})

export { expect }
