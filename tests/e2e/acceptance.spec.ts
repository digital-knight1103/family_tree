import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { parseFamilyJson } from '@/domain/validate'
import { expect, test } from './fixtures/test'
import { E2E_DATA_DIR, resetDataDir } from './fixtures/data-dir'

const PIOTR = '[data-person-id="p_piotr_kowalczyk"]'
const FAMILY_FILE = path.join(E2E_DATA_DIR, 'family.json')
const CONFLICT = 'Dane zmieniły się w innej karcie, odśwież'

test.beforeEach(() => resetDataDir('seed-copy'))
test.afterEach(() => resetDataDir('seed-copy'))

async function editBirthDate(page: Page, date: string): Promise<void> {
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Edytuj' }).click()
  await page.getByLabel('Data urodzenia').fill(date)
  await page.getByRole('button', { name: 'Gotowe' }).click()
}

function birthYearInFile(): unknown {
  const data = JSON.parse(fs.readFileSync(FAMILY_FILE, 'utf8')) as {
    persons: Array<{ id: string; birth?: { date?: { year?: number } } }>
  }
  return data.persons.find((p) => p.id === 'p_piotr_kowalczyk')?.birth?.date?.year
}

test('§9.3: zmiana jest w pliku w ciągu ok. 1 s, a plik przechodzi walidację', async ({ page }) => {
  await page.goto('/')
  await editBirthDate(page, '1891')
  const start = Date.now()
  await expect.poll(birthYearInFile, { timeout: 1500, intervals: [50] }).toBe(1891)
  expect(Date.now() - start).toBeLessThan(1500)
  expect(parseFamilyJson(fs.readFileSync(FAMILY_FILE, 'utf8')).ok).toBe(true)
})

test('§9.9: zapis z drugiej karty na starszej rewizji jest odrzucany z komunikatem', async ({
  context,
}) => {
  const first = await context.newPage()
  const second = await context.newPage()
  await first.goto('/')
  await second.goto('/')
  await expect(second.getByTestId('person-node')).toHaveCount(20)

  await editBirthDate(first, '1892')
  await expect.poll(birthYearInFile).toBe(1892)

  await editBirthDate(second, '1893')
  await expect(second.getByText(CONFLICT)).toBeVisible()
  await expect.poll(birthYearInFile).toBe(1892)
})
