import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSelectionStore } from '@/stores/selection'

describe('useSelectionStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('startuje bez zaznaczenia', () => {
    expect(useSelectionStore().selectedPersonId).toBeNull()
  })

  it('select ustawia i czyści zaznaczenie', () => {
    const selection = useSelectionStore()
    selection.select('p_1')
    expect(selection.selectedPersonId).toBe('p_1')
    selection.select(null)
    expect(selection.selectedPersonId).toBeNull()
  })
})
