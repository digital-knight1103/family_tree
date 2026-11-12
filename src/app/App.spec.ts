import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/app/App.vue'
import { SPLASH } from '@/app/splash/splash-config'
import { emptyFamilyData } from '@/domain/schema'

const repo = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), createNew: vi.fn() }))

vi.mock('@/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data')>()
  return { ...actual, getRepository: () => repo }
})

describe('App', () => {
  it('renderuje powłokę aplikacji i wczytuje dane przy starcie', async () => {
    repo.load.mockResolvedValue({
      kind: 'ok',
      data: emptyFamilyData(),
      source: 'user',
      readOnly: false,
      hash: 'h0',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(repo.load).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="save-status"]').exists()).toBe(true)
  })

  it('ekran powitalny leży nad aplikacją, która wczytuje dane od razu', async () => {
    sessionStorage.clear()
    repo.load.mockClear()
    repo.load.mockResolvedValue({
      kind: 'ok',
      data: emptyFamilyData(),
      source: 'user',
      readOnly: false,
      hash: 'h0',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.find('[aria-label="Ekran powitalny"]').exists()).toBe(true)
    const shell = wrapper.get('[data-testid="app-shell"]')
    expect(repo.load).toHaveBeenCalledTimes(1)
    // Beneath the splash the app is unreachable by Tab and screen readers.
    expect(shell.attributes('inert')).toBeDefined()

    await wrapper.get('[aria-label="Ekran powitalny"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, SPLASH.fadeOutMs + 50))
    expect(wrapper.find('[aria-label="Ekran powitalny"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="app-shell"]').attributes('inert')).toBeUndefined()
    wrapper.unmount()
  })

  it('w trybie demo pokazuje pasek z przyciskiem, ale bez wskaźnika zapisu', async () => {
    repo.load.mockResolvedValue({
      kind: 'ok',
      data: emptyFamilyData(),
      source: 'demo',
      readOnly: true,
      hash: 'h0',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Wyśrodkuj na mnie')
    expect(wrapper.find('[data-testid="save-status"]').exists()).toBe(false)
  })
})
