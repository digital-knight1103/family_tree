import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { FamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'
import { buildFamily } from '@tests/fixtures/build-family'
import PhotoField from './PhotoField.vue'
import DeletePersonDialog from './DeletePersonDialog.vue'

const repository = vi.hoisted(() => ({
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  photoUrl: vi.fn((photo: string) => `/__data/photos/${photo}`),
}))

vi.mock('@/data', () => ({ getRepository: () => repository }))

const updates: Array<{ immediate?: boolean } | undefined> = []

function setup(data: FamilyData) {
  const family = useFamilyStore()
  family.status = 'ready'
  family.source = 'user'
  family.data = data
  family.update = (mutator, opts) => {
    const draft = structuredClone(family.data!)
    mutator(draft)
    family.data = draft
    updates.push(opts)
  }
  return family
}

function body(): string {
  return document.body.textContent ?? ''
}

function button(name: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll('button')].find((b) => b.textContent === name)
  if (!found) throw new Error(`no button ${name}`)
  return found
}

async function open(personId = 'p_a') {
  const wrapper = mount(DeletePersonDialog, { props: { personId }, attachTo: document.body })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  return wrapper
}

const data = () =>
  buildFamily({
    persons: [
      { id: 'p_a', givenNames: 'Jan', surname: 'Kowalski', photo: 'p_a.webp' },
      { id: 'p_b', givenNames: 'Anna', surname: 'Nowak' },
      { id: 'p_c' },
    ],
    parentChild: [['p_a', 'p_c']],
    unions: [['p_a', 'p_b']],
  })

describe('DeletePersonDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    updates.length = 0
    repository.deletePhoto.mockReset()
    repository.deletePhoto.mockResolvedValue(undefined)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('okno pokazuje imię i liczbę relacji', async () => {
    setup(data())
    await open()
    expect(body()).toContain('Usunąć Jan Kowalski?')
    expect(body()).toContain('Zostanie usuniętych relacji: 2.')
  })

  it('„Usuń” usuwa osobę z relacjami (immediate) i woła deletePhoto dla zdjęcia', async () => {
    const family = setup(data())
    await open()
    button('Usuń').click()
    await flushPromises()
    expect(family.data!.persons.map((p) => p.id)).toEqual(['p_b', 'p_c'])
    expect(family.data!.parentChild).toEqual([])
    expect(family.data!.unions).toEqual([])
    expect(updates).toEqual([{ immediate: true }])
    expect(repository.deletePhoto).toHaveBeenCalledWith('p_a')
  })

  it('nieudane usunięcie osoby: bez deletePhoto, okno otwarte, komunikat w oknie', async () => {
    const family = setup(data())
    family.update = () => {
      throw new Error('Dane zmieniły się w innej karcie, odśwież')
    }
    await open()
    button('Usuń').click()
    await flushPromises()
    expect(repository.deletePhoto).not.toHaveBeenCalled()
    const content = document.body.querySelector('[role="alertdialog"]')!
    expect(content.textContent).toContain('Dane zmieniły się w innej karcie, odśwież')
    expect(family.data!.persons).toHaveLength(3)
  })

  it('dane są usuwane przed plikiem zdjęcia', async () => {
    const family = setup(data())
    const order: string[] = []
    const update = family.update
    family.update = (mutator, opts) => {
      order.push('update')
      update(mutator, opts)
    }
    repository.deletePhoto.mockImplementation(() => {
      order.push('deletePhoto')
      return Promise.resolve()
    })
    await open()
    button('Usuń').click()
    await flushPromises()
    expect(order).toEqual(['update', 'deletePhoto'])
  })

  it('nieudane usunięcie pliku po usunięciu osoby: console.error, osoba usunięta', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    repository.deletePhoto.mockRejectedValue(new Error('Nie udało się usunąć zdjęcia.'))
    const family = setup(data())
    await open()
    button('Usuń').click()
    await flushPromises()
    expect(family.data!.persons.map((p) => p.id)).toEqual(['p_b', 'p_c'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    const other = mount(PhotoField, { props: { personId: 'p_b' } })
    expect(other.text()).not.toContain('Nie udało się usunąć zdjęcia.')
  })

  it('osoba bez zdjęcia: nie woła deletePhoto', async () => {
    setup(data())
    await open('p_b')
    button('Usuń').click()
    await flushPromises()
    expect(repository.deletePhoto).not.toHaveBeenCalled()
  })

  it('„Anuluj” niczego nie zmienia', async () => {
    const family = setup(data())
    await open()
    button('Anuluj').click()
    await flushPromises()
    expect(family.data!.persons).toHaveLength(3)
    expect(updates).toEqual([])
    expect(repository.deletePhoto).not.toHaveBeenCalled()
  })
})
