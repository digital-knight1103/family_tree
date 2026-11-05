import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import InvalidDataScreen from './InvalidDataScreen.vue'

describe('InvalidDataScreen', () => {
  it('pokazuje ścieżkę pliku, błędy i przycisk ponowienia', async () => {
    const wrapper = mount(InvalidDataScreen, {
      props: {
        filePath: 'C:/dane/family.json',
        errors: [{ path: 'persons[3].birth.date.month', message: 'Niepoprawna data' }],
      },
    })
    const text = wrapper.text()
    expect(wrapper.find('[data-testid="invalid-data"]').exists()).toBe(true)
    expect(text).toContain('Nie można wczytać danych drzewa')
    expect(text).toContain('C:/dane/family.json')
    expect(text).toContain('persons[3].birth.date.month — Niepoprawna data')
    expect(text).toContain('.backups')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('pusta ścieżka błędu to „cały plik”', () => {
    const wrapper = mount(InvalidDataScreen, {
      props: { filePath: 'f.json', errors: [{ path: '', message: 'Pusty plik' }] },
    })
    expect(wrapper.text()).toContain('cały plik — Pusty plik')
  })

  it('blokuje przycisk, gdy disabled', () => {
    const wrapper = mount(InvalidDataScreen, {
      props: { filePath: 'f.json', errors: [], disabled: true },
    })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
