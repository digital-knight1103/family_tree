import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { buildFamily } from '@tests/fixtures/build-family'
import type { FamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'
import { useSelectionStore } from '@/stores/selection'
import ReviewButton from './ReviewButton.vue'
import ReviewList from './ReviewList.vue'

function family(): FamilyData {
  return buildFamily({
    persons: [
      {
        id: 'p_stefan',
        givenNames: 'Stefan',
        surname: 'Lis',
        birth: { date: { year: 1895 }, place: 'Górka', unconfirmed: true },
        researchNotes: 'Sprawdzić księgi parafialne.',
      },
      { id: 'p_x', givenNames: '', surname: '', sex: 'female' },
      { id: 'p_jan', givenNames: 'Jan', surname: 'Lis' },
    ],
  })
}

function mountBoth(data: FamilyData) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useFamilyStore().data = data
  const options = { global: { plugins: [pinia] } }
  return { list: mount(ReviewList, options), button: mount(ReviewButton, options) }
}

describe('ReviewList', () => {
  it('pokazuje osoby z powodami i notatką, a przycisk ich liczbę', () => {
    const { list, button } = mountBoth(family())
    const items = list.findAll('[data-testid="review-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Stefan Lis')
    expect(items[0]!.text()).toContain('data i miejsce urodzenia do potwierdzenia')
    expect(items[0]!.text()).toContain('Sprawdzić księgi parafialne.')
    expect(items[1]!.text()).toContain('brak imienia i nazwiska')
    expect(button.text()).toBe('Do sprawdzenia · 2')
  })

  it('przycisk otwiera listę w panelu', async () => {
    const { button } = mountBoth(family())
    await button.get('button').trigger('click')
    expect(usePanelStore().view).toEqual({ kind: 'review' })
  })

  it('kliknięcie już zaznaczonej osoby przełącza panel na kartę z powrotem do listy', async () => {
    const { list } = mountBoth(family())
    const panel = usePanelStore()
    useSelectionStore().select('p_stefan')
    panel.openReview()
    await list.get('[data-testid="review-item"]').trigger('click')
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_stefan' })
    expect(useSelectionStore().pendingFocusId).toBe('p_stefan')
    expect(panel.canReturnToReview).toBe(true)
  })

  it('lista i licznik zmieniają się razem z danymi', async () => {
    const { list, button } = mountBoth(family())
    const store = useFamilyStore()
    const confirmed = family()
    confirmed.persons[0]!.birth!.unconfirmed = false
    store.data = confirmed
    await list.vm.$nextTick()
    expect(list.findAll('[data-testid="review-item"]')).toHaveLength(1)
    expect(button.text()).toBe('Do sprawdzenia · 1')

    const removed = family()
    removed.persons = removed.persons.filter((p) => p.id !== 'p_x')
    store.data = removed
    await list.vm.$nextTick()
    expect(list.findAll('[data-testid="review-item"]').map((i) => i.text())).toEqual([
      expect.stringContaining('Stefan Lis'),
    ])
  })

  it('pusta lista pokazuje „Nic do sprawdzenia.”', () => {
    const { list, button } = mountBoth(buildFamily({ persons: [{ id: 'p_1' }] }))
    expect(list.text()).toContain('Nic do sprawdzenia.')
    expect(button.text()).toBe('Do sprawdzenia · 0')
  })
})
