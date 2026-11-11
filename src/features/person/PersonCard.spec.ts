import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PersonCard from './PersonCard.vue'
import type { PersonCardView } from './person-card-view'

const view: PersonCardView = {
  personId: 'p_a',
  displayName: 'Jan Kowalski',
  maidenLine: '',
  birth: { date: '1950', place: 'Górka', unconfirmed: true },
  parents: [{ personId: 'p_ojciec', displayName: 'Adam Kowalski', lifeSpan: '1920 – 1990' }],
  partners: [],
  children: [],
  siblings: [],
  bioHtml: '',
  researchNotes: '',
}

function render(canEdit: boolean, overrides: Partial<PersonCardView> = {}) {
  return mount(PersonCard, { props: { view: { ...view, ...overrides }, canEdit } })
}

describe('PersonCard', () => {
  it('klik w rodzica emituje select z jego id', async () => {
    const wrapper = render(false)
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Adam Kowalski'))!
      .trigger('click')
    expect(wrapper.emitted('select')).toEqual([['p_ojciec']])
  })

  it('„Edytuj” tylko przy canEdit i emituje edit', async () => {
    expect(render(false).text()).not.toContain('Edytuj')
    const wrapper = render(true)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Edytuj')!
      .trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })

  it('pokazuje plakietkę „do potwierdzenia” przy niepotwierdzonym fakcie', () => {
    expect(render(false).text()).toContain('do potwierdzenia')
    const confirmed = render(false, { birth: { date: '1950', place: '', unconfirmed: false } })
    expect(confirmed.text()).not.toContain('do potwierdzenia')
  })

  it('fakt bez daty i miejsca, ale niepotwierdzony, pokazuje sekcję z plakietką', () => {
    const text = render(false, {
      birth: undefined,
      death: { date: '', place: '', unconfirmed: true },
    }).text()
    expect(text).toContain('Śmierć')
    expect(text).toContain('do potwierdzenia')
  })

  it('nie pokazuje pustych sekcji', () => {
    const text = render(false).text()
    for (const title of ['Śmierć', 'Partnerzy', 'Dzieci', 'Rodzeństwo', 'Biografia', 'Notatki'])
      expect(text).not.toContain(title)
    expect(text).toContain('Urodzenie')
    expect(text).toContain('Rodzice')
  })

  it('pokazuje biografię i notatki badawcze', () => {
    const wrapper = render(false, {
      bioHtml: '<p><strong>Życiorys</strong></p>',
      researchNotes: 'Sprawdzić akt',
    })
    expect(wrapper.find('strong').text()).toBe('Życiorys')
    expect(wrapper.get('[data-testid="research-notes"]').text()).toContain('Sprawdzić akt')
  })
})
