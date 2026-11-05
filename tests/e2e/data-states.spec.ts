import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { E2E_DATA_DIR, resetDataDir } from './fixtures/data-dir'

const FAMILY_FILE = path.join(E2E_DATA_DIR, 'family.json')
const BACKUPS_DIR = path.join(E2E_DATA_DIR, '.backups')

test.afterEach(() => resetDataDir('seed-copy'))

test('pusty plik (0 bajtów) to błąd danych, bez nadpisania i bez kopii', async ({ page }) => {
  resetDataDir('zero-bytes')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const screen = page.getByTestId('invalid-data')
  await expect(screen).toBeVisible()
  await expect(screen).toContainText('family tree e2e')
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await page.waitForTimeout(2000)
  expect(fs.statSync(FAMILY_FILE).size).toBe(0)
  expect(fs.existsSync(BACKUPS_DIR)).toBe(false)
  expect(errors).toEqual([])
})

test('cykl w relacjach to błąd danych, plik pozostaje bez zmian', async ({ page }) => {
  resetDataDir('corrupt')
  const before = fs.readFileSync(FAMILY_FILE)
  await page.goto('/')
  const screen = page.getByTestId('invalid-data')
  await expect(screen).toBeVisible()
  await expect(screen).toContainText('parentChild')
  await page.waitForTimeout(2000)
  expect(fs.readFileSync(FAMILY_FILE).equals(before)).toBe(true)
  expect(fs.existsSync(BACKUPS_DIR)).toBe(false)
})

test('brak pliku pokazuje demo, a start własnego drzewa tworzy plik', async ({ page }) => {
  resetDataDir('empty')
  await page.goto('/')
  await expect(page.getByTestId('demo-banner')).toContainText(
    'To są dane przykładowe. Zmiany nie są zapisywane.',
  )
  await page.getByRole('button', { name: 'Rozpocznij własne drzewo' }).click()
  await expect(page.getByText('Twoje drzewo jest puste')).toBeVisible()
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await expect.poll(() => fs.existsSync(FAMILY_FILE)).toBe(true)
})

test('plik z danymi pokazuje miejsce na drzewo', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await expect(page.getByTestId('tree-placeholder')).toContainText('Liczba osób:')
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
})
