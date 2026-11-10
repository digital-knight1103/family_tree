import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DateField from './DateField.vue'

function field(modelValue?: { year: number }) {
  return mount(DateField, { props: { id: 'd', label: 'Data urodzenia', modelValue } })
}

describe('DateField', () => {
  it('„ok. 1890” emituje datę z kwalifikatorem i pokazuje podgląd', async () => {
    const wrapper = field()
    await wrapper.find('input').setValue('ok. 1890')
    expect(wrapper.emitted('update:modelValue')).toEqual([[{ year: 1890, qualifier: 'about' }]])
    expect(wrapper.get('[data-testid="date-preview"]').text()).toBe('ok. 1890')
  })

  it('błędna data pokazuje błąd i nic nie emituje', async () => {
    const wrapper = field()
    await wrapper.find('input').setValue('12.13.1921')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('[data-testid="date-error"]').text()).not.toBe('')
  })

  it('puste pole emituje undefined', async () => {
    const wrapper = field({ year: 1890 })
    expect(wrapper.find('input').element.value).toBe('1890')
    await wrapper.find('input').setValue('')
    expect(wrapper.emitted('update:modelValue')).toEqual([[undefined]])
    expect(wrapper.find('[data-testid="date-error"]').exists()).toBe(false)
  })
})
