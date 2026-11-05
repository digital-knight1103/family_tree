import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SaveStatus } from '@/data'
import SaveStatusIndicator from './SaveStatusIndicator.vue'

function render(status: SaveStatus, saveError: string | null = null) {
  return mount(SaveStatusIndicator, { props: { status, saveError } })
}

describe('SaveStatusIndicator', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['pending', 'Zapisywanie…'],
    ['saving', 'Zapisywanie…'],
    ['saved', 'Zapisano'],
  ] as const)('status %s pokazuje „%s”', (status, text) => {
    expect(render(status).find('[data-testid="save-status"]').text()).toBe(text)
  })

  it('idle nic nie pokazuje', () => {
    expect(render('idle').find('[data-testid="save-status"]').text()).toBe('')
  })

  it('error pokazuje komunikat, szczegóły i przycisk Ponów', async () => {
    const wrapper = render('error', 'Brak połączenia')
    const text = wrapper.text()
    expect(text).toContain('Błąd zapisu')
    expect(text).toContain('Brak połączenia')
    const button = wrapper.find('button')
    expect(button.text()).toBe('Ponów')
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('conflict pokazuje komunikat, osobną linię i przycisk Odśwież', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const wrapper = render('conflict')
    expect(wrapper.text()).toContain('Dane zmieniły się w innej karcie, odśwież')
    expect(wrapper.text()).toContain('Ostatnie zmiany nie zostały zapisane.')
    const button = wrapper.find('button')
    expect(button.text()).toBe('Odśwież')
    await button.trigger('click')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
