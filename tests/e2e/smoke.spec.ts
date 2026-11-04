import { expect, test } from '@playwright/test'

test('strona startowa się ładuje', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page).toHaveTitle('Drzewo Rodzinne')
})
