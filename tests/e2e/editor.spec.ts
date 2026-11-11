import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Locator } from '@playwright/test'
import { E2E_DATA_DIR, resetDataDir } from './fixtures/data-dir'

const PIOTR = '[data-person-id="p_piotr_kowalczyk"]'
const FAMILY_FILE = path.join(E2E_DATA_DIR, 'family.json')
const PORTRAIT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWM4Y2x8xtiYAUIBACPqBMlwUmUNAAAAAElFTkSuQmCC',
  'base64',
)

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
  await page.getByTestId('side-panel').getByLabel('Szukaj osoby').fill('Aleks')
  const item = page.getByTestId('existing-person-item').filter({ hasText: 'Aleksandra' })
  await expect(item).toBeDisabled()
  await expect(item).toContainText('Osoba nie może być swoim własnym przodkiem.')
})

test('edycja: data urodzenia z podglądem trafia na kartę i do pliku', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Edytuj' }).click()
  await page.getByLabel('Data urodzenia').fill('ok. 1890')
  await expect(page.getByTestId('date-preview').first()).toHaveText('ok. 1890')
  await page.getByRole('button', { name: 'Gotowe' }).click()
  await expect(page.getByTestId('person-card')).toContainText('ok. 1890')

  await expect
    .poll(() => {
      const data = JSON.parse(fs.readFileSync(FAMILY_FILE, 'utf8')) as {
        persons: Array<{ id: string; birth?: { date?: unknown } }>
      }
      return data.persons.find((p) => p.id === 'p_piotr_kowalczyk')?.birth?.date
    })
    .toEqual({ year: 1890, qualifier: 'about' })
})

test('zdjęcie: dodanie, zapis jako WebP i usunięcie', async ({ page }) => {
  resetDataDir('seed-copy')
  const photoFile = path.join(E2E_DATA_DIR, 'photos', 'p_piotr_kowalczyk.webp')
  await page.goto('/')
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Edytuj' }).click()
  await expect(page.locator(`${PIOTR} img`)).toHaveCount(0)

  await page.locator('input[type="file"]').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: PORTRAIT_PNG,
  })
  await expect(page.locator(`${PIOTR} img`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zmień zdjęcie' })).toBeVisible()
  await expect.poll(() => fs.existsSync(photoFile)).toBe(true)
  await expect
    .poll(() => {
      const data = JSON.parse(fs.readFileSync(FAMILY_FILE, 'utf8')) as {
        persons: Array<{ id: string; photo?: string }>
      }
      return data.persons.find((p) => p.id === 'p_piotr_kowalczyk')?.photo
    })
    .toBe('p_piotr_kowalczyk.webp')

  await page.getByRole('button', { name: 'Usuń zdjęcie' }).click()
  await expect(page.locator(`${PIOTR} img`)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dodaj zdjęcie' })).toBeVisible()
  await expect.poll(() => fs.existsSync(photoFile)).toBe(false)
})

function personIds(): string[] {
  const data = JSON.parse(fs.readFileSync(FAMILY_FILE, 'utf8')) as {
    persons: Array<{ id: string }>
  }
  return data.persons.map((p) => p.id)
}

test('usuwanie osoby: okno z nazwą i liczbą relacji, „Usuń” usuwa osobę i zamyka panel', async ({
  page,
}) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await expect(page.getByTestId('person-node')).toHaveCount(20)
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Edytuj' }).click()
  await page.getByRole('button', { name: 'Usuń osobę' }).click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Usunąć Piotr Kowalczyk?')
  await expect(dialog).toContainText(/Zostanie usuniętych relacji: \d+\./)
  await dialog.getByRole('button', { name: 'Usuń', exact: true }).click()

  await expect(page.getByTestId('person-node')).toHaveCount(19)
  await expect(page.locator(PIOTR)).toHaveCount(0)
  await expect(page.getByTestId('person-edit-form')).toHaveCount(0)
  await expect(page.getByTestId('person-card')).toHaveCount(0)
  await expect.poll(() => personIds().includes('p_piotr_kowalczyk')).toBe(false)
})

test('usuwanie osoby: „Anuluj” zostawia wszystko bez zmian', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Edytuj' }).click()
  await page.getByRole('button', { name: 'Usuń osobę' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Anuluj' }).click()

  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByTestId('person-node')).toHaveCount(20)
  await expect(page.getByTestId('person-edit-form')).toBeVisible()
  expect(personIds()).toContain('p_piotr_kowalczyk')
})

test('trzy pokolenia od zera: osoba, rodzice ze związkiem, dziecko i fakty w pliku', async ({
  page,
}) => {
  resetDataDir('empty')
  await page.goto('/')
  await page.getByRole('button', { name: 'Rozpocznij własne drzewo' }).click()
  await page.getByLabel('Imiona').fill('Jan')
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  const jan = page.locator('[data-testid="person-node"]', { hasText: 'Jan' })
  await expect(jan).toHaveAttribute('data-selected', 'true')

  for (const name of ['Adam', 'Ewa']) {
    await jan.click()
    await page.getByRole('button', { name: 'Dodaj rodzica' }).click()
    await page.getByLabel('Imiona').fill(name)
    await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
    await expect(page.locator('[data-testid="person-node"]', { hasText: name })).toBeVisible()
  }

  await jan.click()
  await page.getByRole('button', { name: 'Dodaj dziecko' }).click()
  await page.getByLabel('Imiona').fill('Ola')
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await expect(page.getByTestId('person-node')).toHaveCount(4)

  await page.locator('[data-testid="person-node"]', { hasText: 'Adam' }).click()
  await page.getByRole('button', { name: 'Edytuj' }).click()
  await page.getByLabel('Data urodzenia').fill('ok. 1890')
  await page.locator('#edit-birth-unconfirmed').click()
  await page.getByLabel('Notatki badawcze').fill('Sprawdzić w księgach parafialnych')
  await page.getByRole('button', { name: 'Gotowe' }).click()

  type Saved = {
    persons: Array<{
      id: string
      givenNames: string
      birth?: { date?: unknown; unconfirmed?: boolean }
      researchNotes?: string
    }>
    parentChild: Array<{ parentId: string; childId: string }>
    unions: Array<{ partnerIds: string[] }>
  }
  await expect
    .poll(() => {
      const data = JSON.parse(fs.readFileSync(FAMILY_FILE, 'utf8')) as Saved
      const id = (name: string) => data.persons.find((p) => p.givenNames === name)?.id
      const adam = data.persons.find((p) => p.givenNames === 'Adam')
      const hasEdge = (parent: string, child: string) =>
        data.parentChild.some((r) => r.parentId === id(parent) && r.childId === id(child))
      return (
        data.persons.length === 4 &&
        hasEdge('Adam', 'Jan') &&
        hasEdge('Ewa', 'Jan') &&
        hasEdge('Jan', 'Ola') &&
        data.unions.some(
          (u) => u.partnerIds.includes(id('Adam')!) && u.partnerIds.includes(id('Ewa')!),
        ) &&
        JSON.stringify(adam?.birth) ===
          JSON.stringify({ date: { year: 1890, qualifier: 'about' }, unconfirmed: true }) &&
        adam?.researchNotes === 'Sprawdzić w księgach parafialnych'
      )
    })
    .toBe(true)
})

test('trzeci rodzic biologiczny jest blokowany z komunikatem', async ({ page }) => {
  resetDataDir('seed-copy')
  await page.goto('/')
  await page.locator(PIOTR).click()
  await page.getByRole('button', { name: 'Dodaj rodzica' }).click()
  await expect(page.getByTestId('add-person-form')).toContainText(
    'Osoba może mieć najwyżej dwoje rodziców biologicznych.',
  )
  await expect(page.getByRole('button', { name: 'Dodaj', exact: true })).toBeDisabled()
})

test('tryb demo: karta osoby działa, ale bez „Edytuj” i „Usuń osobę”', async ({ page }) => {
  resetDataDir('empty')
  await page.goto('/')
  await page.locator(PIOTR).click()
  await expect(page.getByTestId('person-card')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edytuj' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Usuń osobę' })).toHaveCount(0)
})
