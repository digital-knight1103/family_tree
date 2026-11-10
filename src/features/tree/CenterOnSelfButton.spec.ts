import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { buildFamily } from '@tests/fixtures/build-family'
import { useFamilyStore } from '@/stores/family'
import { useSelectionStore } from '@/stores/selection'
import CenterOnSelfButton from './CenterOnSelfButton.vue'

const nav = vi.hoisted(() => ({ centerOnPerson: vi.fn(() => true), fitAll: vi.fn() }))
vi.mock('./useTreeNavigation', () => ({ useTreeNavigation: () => nav }))

function mountWith(selfPersonId: string | undefined) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const data = buildFamily({ persons: [{ id: 'p_1' }, { id: 'p_2' }] })
  if (selfPersonId) data.settings.selfPersonId = selfPersonId
  useFamilyStore().data = data
  return mount(CenterOnSelfButton, { global: { plugins: [pinia] } })
}

describe('CenterOnSelfButton', () => {
  beforeEach(() => nav.centerOnPerson.mockClear())

  it('jest nieaktywny bez ustawionej osoby „ja”', () => {
    const wrapper = mountWith(undefined)
    expect(wrapper.text()).toBe('Wyśrodkuj na mnie')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('jest nieaktywny, gdy osoba „ja” nie istnieje', () => {
    const wrapper = mountWith('p_missing')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('wyśrodkowuje i zaznacza osobę „ja”', async () => {
    const wrapper = mountWith('p_2')
    await wrapper.find('button').trigger('click')
    expect(nav.centerOnPerson).toHaveBeenCalledWith('p_2')
    expect(useSelectionStore().selectedPersonId).toBe('p_2')
  })
})
