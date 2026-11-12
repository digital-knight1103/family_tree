import { expect, test } from './fixtures/test'

test('strona startowa się ładuje', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page).toHaveTitle('Drzewo Rodzinne')
})
