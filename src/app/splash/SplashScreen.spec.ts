import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SplashScreen from '@/app/splash/SplashScreen.vue'
import { SPLASH } from '@/app/splash/splash-config'
import { installMatchMedia, REDUCED_MOTION_QUERY } from '@tests/fixtures/match-media'

function press(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  document.body.dispatchEvent(event)
  return event
}

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    installMatchMedia({ [REDUCED_MOTION_QUERY]: false })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('pokazuje tytuł i cytat jako dialog „Ekran powitalny”', () => {
    const wrapper = mount(SplashScreen, { attachTo: document.body })

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-label')).toBe('Ekran powitalny')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(wrapper.text()).toContain(SPLASH.title)
    expect(wrapper.text()).toContain(SPLASH.quote)
    wrapper.unmount()
  })

  it('Escape pomija ekran i nie dociera do aplikacji', async () => {
    const appListener = vi.fn()
    window.addEventListener('keydown', appListener)
    const wrapper = mount(SplashScreen, { attachTo: document.body })

    const event = press('Escape')
    vi.advanceTimersByTime(SPLASH.fadeOutMs)
    await wrapper.vm.$nextTick()

    expect(appListener).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('done')).toHaveLength(1)
    window.removeEventListener('keydown', appListener)
    wrapper.unmount()
  })

  it('Enter pomija ekran', async () => {
    const wrapper = mount(SplashScreen, { attachTo: document.body })

    press('Enter')
    vi.advanceTimersByTime(SPLASH.fadeOutMs)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })

  it('klik pomija ekran', async () => {
    const wrapper = mount(SplashScreen, { attachTo: document.body })

    await wrapper.get('[role="dialog"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').classes()).toContain('opacity-0')
    vi.advanceTimersByTime(SPLASH.fadeOutMs)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })

  it('po czasie emituje done', async () => {
    const wrapper = mount(SplashScreen, { attachTo: document.body })

    vi.advanceTimersByTime(SPLASH.durationMs + SPLASH.fadeOutMs)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })

  it('w tej samej sesji karty od razu emituje done', async () => {
    sessionStorage.setItem(SPLASH.sessionKey, '1')
    const wrapper = mount(SplashScreen, { attachTo: document.body })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })

  it('po zdjęciu ekranu klawisze docierają do aplikacji', () => {
    const wrapper = mount(SplashScreen, { attachTo: document.body })
    wrapper.unmount()
    const appListener = vi.fn()
    window.addEventListener('keydown', appListener)

    press('Escape')

    expect(appListener).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', appListener)
  })
})
