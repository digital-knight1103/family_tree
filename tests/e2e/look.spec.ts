import { SPLASH } from '@/app/splash/splash-config'
import { expect, test } from './fixtures/test'
import { resetDataDir } from './fixtures/data-dir'

const CLOCK_START = new Date('2026-01-01T12:00:00').getTime()

test.beforeEach(() => resetDataDir('seed-copy'))
test.afterEach(() => resetDataDir('seed-copy'))

test.describe('ekran powitalny', () => {
  test.use({ splash: true })

  // Splash timers run on a paused fake clock, so the checks do not depend on how fast the machine is.
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: CLOCK_START })
    await page.clock.pauseAt(CLOCK_START + 1000)
  })

  test('start → ekran powitalny → drzewo', async ({ page }) => {
    await page.goto('/')
    const splash = page.getByRole('dialog', { name: 'Ekran powitalny' })
    await expect(splash).toBeVisible()
    await expect(splash).toContainText(SPLASH.title)
    await expect(splash).toContainText(SPLASH.quote)

    await page.clock.runFor(SPLASH.durationMs - 1)
    await expect(splash).toBeVisible()
    await page.clock.runFor(1 + SPLASH.fadeOutMs)
    await expect(splash).toBeHidden()
    await page.clock.resume()
    await expect(page.getByTestId('person-node')).toHaveCount(20)

    await page.reload()
    await expect(page.getByTestId('person-node')).toHaveCount(20)
    await expect(splash).toHaveCount(0)
  })

  test('ekran powitalny: Esc pomija bez skutków w aplikacji', async ({ page }) => {
    await page.goto('/')
    const splash = page.getByRole('dialog', { name: 'Ekran powitalny' })
    await expect(splash).toBeVisible()
    const search = page.getByRole('combobox', { name: 'Szukaj osoby' })

    await page.keyboard.press('Tab')
    await page.keyboard.press('/')
    await expect(splash).toBeVisible()
    await expect(search).not.toBeFocused()

    await page.keyboard.press('Escape')
    await page.clock.runFor(SPLASH.fadeOutMs)
    await expect(splash).toBeHidden()
    await expect(page.getByRole('combobox', { name: 'Szukaj osoby' })).not.toBeFocused()
  })

  test('ekran powitalny przy reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const splash = page.getByRole('dialog', { name: 'Ekran powitalny' })
    await expect(splash).toBeVisible()
    await page.clock.runFor(SPLASH.reducedMotionDurationMs - 1)
    await expect(splash).toBeVisible()
    await page.clock.runFor(1)
    await expect(splash).toBeHidden()
  })
})

test.describe('motyw', () => {
  test.use({ colorScheme: 'dark' })

  test('motyw: domyślnie z systemu, przełącznik zapamiętuje', async ({ page }) => {
    // Records the theme when <body> is parsed: after the inline head script, before any module runs.
    // Browser code as a string: the e2e tsconfig has no DOM types.
    await page.addInitScript({
      content: `
        const observer = new MutationObserver(() => {
          if (!document.body) return
          window.darkBeforeApp = document.documentElement.classList.contains('dark')
          observer.disconnect()
        })
        observer.observe(document, { childList: true, subtree: true })
      `,
    })
    await page.goto('/')
    const html = page.locator('html')

    expect(await page.evaluate('window.darkBeforeApp')).toBe(true)
    await expect(html).toHaveClass(/\bdark\b/)

    await page.getByRole('button', { name: 'Przełącz motyw' }).click()
    await expect(html).not.toHaveClass(/\bdark\b/)

    await page.reload()
    await expect(page.getByTestId('person-node')).toHaveCount(20)
    await expect(html).not.toHaveClass(/\bdark\b/)
  })
})
