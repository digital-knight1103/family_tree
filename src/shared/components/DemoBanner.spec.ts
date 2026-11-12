import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DemoBanner from './DemoBanner.vue'

describe('DemoBanner', () => {
  it('pokazuje stały tekst i przycisk startu', async () => {
    const wrapper = mount(DemoBanner)
    expect(wrapper.text()).toContain('To są dane przykładowe. Zmiany nie są zapisywane.')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('pokazuje, gdzie szukano danych, gdy serwer podał ścieżkę', () => {
    const wrapper = mount(DemoBanner, { props: { filePath: 'C:\\dane\\family.json' } })
    expect(wrapper.find('[data-testid="demo-file-path"]').text()).toBe(
      'Szukano danych w: C:\\dane\\family.json',
    )
    expect(wrapper.text()).toContain('To są dane przykładowe. Zmiany nie są zapisywane.')
  })

  it('bez ścieżki (build) nie pokazuje linii ze ścieżką', () => {
    const wrapper = mount(DemoBanner)
    expect(wrapper.find('[data-testid="demo-file-path"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Szukano danych w')
  })
})
