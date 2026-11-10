import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Locator } from '@playwright/test'
import { E2E_DATA_DIR, resetDataDir } from './fixtures/data-dir'

const PIOTR = '[data-person-id="p_piotr_kowalczyk"]'
const FAMILY_FILE = path.join(E2E_DATA_DIR, 'family.json')

test.afterEach(() => resetDataDir('seed-copy'))

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('dodanie dziecka z drzewa: nowy węzeł jest zaznaczony, wyśrodkowany i zapisany', async ({
  page,
}) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await expect(page.getByTestId('person-node')).toHaveCount(20)
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Dodaj dziecko' }).click()
  await expect(page.getByTestId('add-person-form')).toBeVisible()
  await page.getByLabel('Imiona').fill('Hieronim')
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()

  const created = page.locator('[data-testid="person-node"]', { hasText: 'Hieronim' })
  await expect(page.getByTestId('person-node')).toHaveCount(21)
  await expect(created).toHaveAttribute('data-selected', 'true')
  const canvas = page.getByTestId('tree-canvas')
  await expect
    .poll(async () => {
      const node = await center(created)
      const area = await center(canvas)
      return Math.hypot(node.x - area.x, node.y - area.y)
    })
    .toBeLessThanOrEqual(40)

  await expect
    .poll(() => {
      const data = JSON.parse(fs.readFileSync(FAMILY_FILE, 'utf8')) as {
        persons: Array<{ id: string; givenNames: string }>
        parentChild: Array<{ parentId: string; childId: string }>
      }
      const person = data.persons.find((p) => p.givenNames === 'Hieronim')
      return data.parentChild.some(
        (pc) => pc.parentId === 'p_piotr_kowalczyk' && pc.childId === person?.id,
      )
    })
    .toBe(true)
})

test('anulowanie formularza wraca do karty osoby', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Dodaj rodzeństwo' }).click()
  await page.getByRole('button', { name: 'Anuluj' }).click()
  await expect(page.getByTestId('person-card')).toBeVisible()
})

test('tryb demo: po zaznaczeniu osoby nie ma przycisków „Dodaj …”', async ({ page }) => {
  resetDataDir('empty')
  await page.goto('/')
  await expect(page.getByTestId('person-node')).toHaveCount(20)
  await page.locator(PIOTR).click()
  await expect(page.locator(PIOTR)).toHaveAttribute('data-selected', 'true')
  await expect(page.getByRole('button', { name: /^Dodaj / })).toHaveCount(0)
})

test('własne puste drzewo: pierwsza osoba jako „Ja”', async ({ page }) => {
  resetDataDir('empty')
  await page.goto('/')
  await page.getByRole('button', { name: 'Rozpocznij własne drzewo' }).click()
  await page.getByLabel('Imiona').fill('Ewa')
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await expect(page.getByTestId('person-node')).toHaveCount(1)
  await expect
    .poll(() => {
      const data = JSON.parse(fs.readFileSync(FAMILY_FILE, 'utf8')) as {
        persons: Array<{ id: string }>
        settings: { selfPersonId?: string }
      }
      return data.persons.length === 1 && data.settings.selfPersonId === data.persons[0]?.id
    })
    .toBe(true)
})

test('istniejąca osoba: potomek jako rodzic jest wyłączony z komunikatem', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Dodaj rodzica' }).click()
  await page.getByRole('button', { name: 'Istniejąca osoba' }).click()
  await page.getByLabel('Szukaj osoby').fill('Aleks')
  const item = page.getByTestId('existing-person-item').filter({ hasText: 'Aleksandra' })
  await expect(item).toBeDisabled()
  await expect(item).toContainText('Osoba nie może być swoim własnym przodkiem.')
})
