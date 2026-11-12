import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/test'
import { resetDataDir } from './fixtures/data-dir'

test.afterEach(() => resetDataDir('seed-copy'))

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function expectCentered(page: Page, node: Locator) {
  const canvas = page.getByTestId('tree-canvas')
  await expect
    .poll(async () => {
      const a = await center(node)
      const b = await center(canvas)
      return Math.hypot(a.x - b.x, a.y - b.y)
    })
    .toBeLessThanOrEqual(40)
}

test('wyszukiwarka zaznacza, centruje i otwiera kartę', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await expect(page.getByTestId('person-node')).toHaveCount(20)
  await page.locator('body').press('/')
  const search = page.getByRole('combobox', { name: 'Szukaj osoby' })
  await expect(search).toBeFocused()
  await search.fill('zielinska')
  const options = page.getByRole('option')
  await expect(options).toHaveText([/Barbara Zielińska/, /Marta Zielińska/])
  await search.press('ArrowDown')
  await search.press('Enter')

  const node = page.locator('[data-person-id="p_marta_zielinska"]')
  await expect(node).toHaveAttribute('data-selected', 'true')
  await expectCentered(page, node)
  await expect(page.getByTestId('side-panel')).toContainText('Marta Zielińska')
  await expect(search).toHaveValue('')
})

test('Do sprawdzenia: licznik, powody, przejście do karty i powrót', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await page.getByRole('button', { name: 'Do sprawdzenia · 5' }).click()
  const list = page.getByTestId('review-list')
  await expect(list.getByTestId('review-item')).toHaveCount(5)
  const stefan = list.getByTestId('review-item').filter({ hasText: 'Stefan Lis' })
  await expect(stefan).toContainText('data i miejsce urodzenia do potwierdzenia')
  await expect(stefan).toContainText(
    'Miejsce urodzenia znane tylko z rodzinnych opowieści. Sprawdzić księgi parafialne.',
  )
  await expect(list).toContainText('brak imienia i nazwiska')

  await stefan.click()
  const node = page.locator('[data-person-id="p_stefan_lis"]')
  await expect(node).toHaveAttribute('data-selected', 'true')
  await expectCentered(page, node)
  await expect(list).toBeHidden()
  await page.getByRole('button', { name: 'Wróć do listy' }).click()
  await expect(list.getByTestId('review-item')).toHaveCount(5)
})

test('demo: wyszukiwarka i lista działają', async ({ page }) => {
  resetDataDir('empty')
  await page.goto('/')
  await expect(page.getByText('To są dane przykładowe. Zmiany nie są zapisywane.')).toBeVisible()
  await page.locator('body').press('Control+k')
  const search = page.getByRole('combobox', { name: 'Szukaj osoby' })
  await expect(search).toBeFocused()
  await search.fill('helena')
  await search.press('Enter')
  await expect(page.locator('[data-person-id="p_helena_mazur"]')).toHaveAttribute(
    'data-selected',
    'true',
  )
  await page.getByRole('button', { name: /^Do sprawdzenia · 5/ }).click()
  await expect(page.getByTestId('review-item')).toHaveCount(5)
})
