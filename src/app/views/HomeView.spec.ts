import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { emptyFamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'
import HomeView from './HomeView.vue'

function mountView() {
  const store = useFamilyStore()
  const load = vi.spyOn(store, 'load').mockResolvedValue()
  const startOwnTree = vi.spyOn(store, 'startOwnTree').mockResolvedValue()
  return {
    store,
    load,
    startOwnTree,
    wrapper: mount(HomeView, { attachTo: document.body, global: { stubs: { TreeCanvas: true } } }),
  }
}

describe('HomeView', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pokazuje spinner podczas ładowania', () => {
    const { wrapper } = mountView()
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('pokazuje błąd ładowania z przyciskiem ponowienia', async () => {
    const { store, load, wrapper } = mountView()
    store.status = 'load-error'
    store.loadError = 'Serwer niedostępny'
    await flushPromises()
    const screen = wrapper.find('[data-testid="load-error"]')
    expect(screen.text()).toContain('Nie udało się wczytać danych')
    expect(screen.text()).toContain('Serwer niedostępny')
    await screen.find('button').trigger('click')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('demo: belka i start własnego drzewa', async () => {
    const { store, startOwnTree, wrapper } = mountView()
    store.status = 'ready'
    store.source = 'demo'
    store.data = emptyFamilyData()
    await flushPromises()
    const banner = wrapper.find('[data-testid="demo-banner"]')
    expect(banner.text()).toContain('To są dane przykładowe. Zmiany nie są zapisywane.')
    await banner.find('button').trigger('click')
    expect(startOwnTree).toHaveBeenCalledTimes(1)
  })

  it('własne puste drzewo: stan pusty, brak belki', async () => {
    const { store, wrapper } = mountView()
    store.status = 'ready'
    store.source = 'user'
    store.data = emptyFamilyData()
    await flushPromises()
    expect(wrapper.text()).toContain('Twoje drzewo jest puste')
    expect(wrapper.find('[data-testid="demo-banner"]').exists()).toBe(false)
  })

  it('własne puste drzewo: formularz pierwszej osoby ustawia „To jestem ja”', async () => {
    const { store, wrapper } = mountView()
    store.status = 'ready'
    store.source = 'user'
    store.data = emptyFamilyData()
    store.update = (mutator) => {
      const draft = structuredClone(store.data!)
      mutator(draft)
      store.data = draft
    }
    await flushPromises()
    expect(wrapper.text()).toContain('Dodaj pierwszą osobę')
    await wrapper.get('input[name="givenNames"]').setValue('Piotr')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Dodaj')!
      .trigger('click')
    const [created] = store.data.persons
    expect(created?.givenNames).toBe('Piotr')
    expect(store.data.settings.selfPersonId).toBe(created?.id)
  })

  it('demo z pustymi danymi: bez formularza pierwszej osoby', async () => {
    const { store, wrapper } = mountView()
    store.status = 'ready'
    store.source = 'demo'
    store.data = emptyFamilyData()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Dodaj pierwszą osobę')
  })
})
