import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useFamilyStore } from '@/stores/family'
import { useSelectionStore } from '@/stores/selection'
import { buildFamily } from '@tests/fixtures/build-family'

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

  it('focus zaznacza osobę i ustawia oczekujące centrowanie, focusDone je zdejmuje', () => {
    const selection = useSelectionStore()
    selection.focus('p_1')
    expect(selection.selectedPersonId).toBe('p_1')
    expect(selection.pendingFocusId).toBe('p_1')
    selection.focusDone()
    expect(selection.pendingFocusId).toBeNull()
    expect(selection.selectedPersonId).toBe('p_1')
  })

  it('usunięcie zaznaczonej osoby z danych czyści zaznaczenie i centrowanie', async () => {
    const family = useFamilyStore()
    const selection = useSelectionStore()
    family.data = buildFamily({ persons: [{ id: 'p_a' }, { id: 'p_b' }] })
    selection.focus('p_a')
    await nextTick()
    expect(selection.selectedPersonId).toBe('p_a')
    family.data = buildFamily({ persons: [{ id: 'p_b' }] })
    await nextTick()
    expect(selection.selectedPersonId).toBeNull()
    expect(selection.pendingFocusId).toBeNull()
  })

  it('nie czyści zaznaczenia osoby, która nadal istnieje', async () => {
    const family = useFamilyStore()
    const selection = useSelectionStore()
    family.data = buildFamily({ persons: [{ id: 'p_a' }] })
    selection.select('p_a')
    family.data = buildFamily({ persons: [{ id: 'p_a' }, { id: 'p_b' }] })
    await nextTick()
    expect(selection.selectedPersonId).toBe('p_a')
  })
})
