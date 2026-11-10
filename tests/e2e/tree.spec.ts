import { expect, test, type Locator, type Page } from '@playwright/test'
import { resetDataDir } from './fixtures/data-dir'

const PIOTR = '[data-person-id="p_piotr_kowalczyk"]'

test.afterEach(() => resetDataDir('seed-copy'))

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function openTree(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('tree-canvas')).toBeVisible()
  await expect(page.getByTestId('person-node')).toHaveCount(20)
}

test('drzewo pokazuje wszystkie osoby z danych', async ({ page }) => {
  resetDataDir('seed-copy')
  await openTree(page)
  await expect(page.locator('.vue-flow__minimap')).toBeVisible()
  await expect(page.locator('.vue-flow__controls')).toBeVisible()
})

test('kliknięcie osoby ją zaznacza, a klik w tło zdejmuje zaznaczenie', async ({ page }) => {
  resetDataDir('seed-copy')
  await openTree(page)
  const piotr = page.locator(PIOTR)
  await expect(piotr).toHaveAttribute('data-selected', 'false')
  await piotr.click()
  await expect(piotr).toHaveAttribute('data-selected', 'true')
  const pane = page.locator('.vue-flow__pane')
  const box = await pane.boundingBox()
  if (!box) throw new Error('pane has no bounding box')
  // Top-left corner of the canvas: empty space, away from nodes, minimap and controls.
  await page.mouse.click(box.x + 5, box.y + 5)
  await expect(piotr).toHaveAttribute('data-selected', 'false')
})

test('Backspace, Delete i zaznaczenie ramką nie usuwają osób z płótna', async ({ page }) => {
  resetDataDir('seed-copy')
  await openTree(page)
  await page.locator(PIOTR).click()
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Delete')
  const pane = page.locator('.vue-flow__pane')
  const box = await pane.boundingBox()
  if (!box) throw new Error('pane has no bounding box')
  await page.keyboard.down('Shift')
  await page.mouse.move(box.x + 5, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Delete')
  await expect(page.getByTestId('person-node')).toHaveCount(20)
  await expect(page.locator('.vue-flow__edge')).toHaveCount(26)
})

test('Wyśrodkuj na mnie centruje osobę Ja', async ({ page }) => {
  resetDataDir('seed-copy')
  await openTree(page)
  const canvas = page.getByTestId('tree-canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  await page.mouse.move(box.x + 5, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + 305, box.y + 205, { steps: 10 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Wyśrodkuj na mnie' }).click()
  await expect
    .poll(async () => {
      const node = await center(page.locator(PIOTR))
      const area = await center(canvas)
      return Math.hypot(node.x - area.x, node.y - area.y)
    })
    .toBeLessThanOrEqual(40)
})

test('tryb demo też pokazuje drzewo', async ({ page }) => {
  resetDataDir('empty')
  await page.goto('/')
  await expect(page.getByTestId('demo-banner')).toContainText(
    'To są dane przykładowe. Zmiany nie są zapisywane.',
  )
  await expect(page.getByTestId('person-node')).toHaveCount(20)
})

test('Wyśrodkuj na mnie centruje osobę Ja także przy otwartym panelu', async ({ page }) => {
  resetDataDir('seed-copy')
  await openTree(page)
  await page.locator('[data-person-id="p_andrzej_kowalczyk"]').click()
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await page.getByRole('button', { name: 'Wyśrodkuj na mnie' }).click()
  const canvas = page.getByTestId('tree-canvas')
  await expect
    .poll(async () => {
      const node = await center(page.locator(PIOTR))
      const area = await center(canvas)
      return Math.hypot(node.x - area.x, node.y - area.y)
    })
    .toBeLessThanOrEqual(40)
})
