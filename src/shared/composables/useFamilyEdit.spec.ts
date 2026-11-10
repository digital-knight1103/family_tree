import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFamilyStore } from '@/stores/family'
import { buildFamily } from '@tests/fixtures/build-family'
import { useFamilyEdit } from './useFamilyEdit'

describe('useFamilyEdit', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('zwraca wynik mutatora, gdy edycja się udaje, i czyści błąd', () => {
    const family = useFamilyStore()
    family.update = (mutator) => mutator({} as never)
    const edit = useFamilyEdit()
    expect(edit.run(() => 'x')).toBe('x')
    expect(edit.error.value).toBeNull()
  })

  it('wyjątek z mutatora trafia do error, bez rzucania dalej', () => {
    const family = useFamilyStore()
    family.update = (mutator) => mutator({} as never)
    const edit = useFamilyEdit()
    expect(
      edit.run(() => {
        throw new Error('X')
      }),
    ).toBeUndefined()
    expect(edit.error.value).toBe('X')
  })

  it('udany run po błędzie czyści error', () => {
    const family = useFamilyStore()
    family.update = (mutator) => mutator({} as never)
    const edit = useFamilyEdit()
    edit.run(() => {
      throw new Error('X')
    })
    expect(edit.run(() => 1)).toBe(1)
    expect(edit.error.value).toBeNull()
  })

  it('w demo update rzuca komunikat tylko do odczytu i trafia on do error', () => {
    const family = useFamilyStore()
    family.readOnly = true
    family.status = 'ready'
    family.data = buildFamily({ persons: [{ id: 'p_a' }] })
    const edit = useFamilyEdit()
    expect(edit.run(() => 1)).toBeUndefined()
    expect(edit.error.value).toBe('Edycja niedostępna w wersji tylko do odczytu')
    expect(edit.canEdit.value).toBe(false)
  })
})
