import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/test'
import { E2E_DATA_DIR, resetDataDir } from './fixtures/data-dir'

const FAMILY_FILE = path.join(E2E_DATA_DIR, 'family.json')
const BACKUPS_DIR = path.join(E2E_DATA_DIR, '.backups')

test.afterEach(() => resetDataDir('seed-copy'))

function recordWrites(page: Page): string[] {
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/__data/')) {
      writes.push(`${request.method()} ${request.url()}`)
    }
  })
  return writes
}

test('pusty plik (0 bajtów) to błąd danych, bez nadpisania i bez kopii', async ({ page }) => {
  resetDataDir('zero-bytes')
  const writes = recordWrites(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const screen = page.getByTestId('invalid-data')
  await expect(screen).toBeVisible()
  await expect(screen).toContainText('family tree e2e')
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await page.waitForTimeout(2000)
  expect(writes).toEqual([])
  expect(fs.statSync(FAMILY_FILE).size).toBe(0)
  expect(fs.existsSync(BACKUPS_DIR)).toBe(false)
  expect(errors).toEqual([])
})

test('cykl w relacjach to błąd danych, plik pozostaje bez zmian', async ({ page }) => {
  resetDataDir('corrupt')
  const before = fs.readFileSync(FAMILY_FILE)
  const writes = recordWrites(page)
  await page.goto('/')
  const screen = page.getByTestId('invalid-data')
  await expect(screen).toBeVisible()
  await expect(screen).toContainText('parentChild')
  await page.waitForTimeout(2000)
  expect(writes).toEqual([])
  expect(fs.readFileSync(FAMILY_FILE).equals(before)).toBe(true)
  expect(fs.existsSync(BACKUPS_DIR)).toBe(false)
})

test('brak pliku pokazuje demo, a start własnego drzewa tworzy plik', async ({ page }) => {
  resetDataDir('empty')
  await page.goto('/')
  await expect(page.getByTestId('demo-banner')).toContainText(
    'To są dane przykładowe. Zmiany nie są zapisywane.',
  )
  await expect(page.getByTestId('demo-file-path')).toHaveText(`Szukano danych w: ${FAMILY_FILE}`)
  await page.getByRole('button', { name: 'Rozpocznij własne drzewo' }).click()
  await expect(page.getByText('Twoje drzewo jest puste')).toBeVisible()
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await expect.poll(() => fs.existsSync(FAMILY_FILE)).toBe(true)
})

test('plik z danymi pokazuje drzewo', async ({ page }) => {
  resetDataDir('seed-copy')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('tree-canvas')).toBeVisible()
  await expect(page.getByTestId('person-node')).toHaveCount(20)
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  expect(errors).toEqual([])
})
