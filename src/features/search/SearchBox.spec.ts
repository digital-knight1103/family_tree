import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { buildFamily } from '@tests/fixtures/build-family'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'
import { useSelectionStore } from '@/stores/selection'
import SearchBox from './SearchBox.vue'

let wrapper: VueWrapper | undefined

function mountBox() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useFamilyStore().data = buildFamily({
    persons: [
      {
        id: 'p_ewa',
        givenNames: 'Ewa',
        surname: 'Wiśniewska',
        birth: { date: { year: 1950 } },
        living: true,
      },
      { id: 'p_anna', givenNames: 'Anna', surname: 'Wiśniewska' },
      { id: 'p_jan', givenNames: 'Jan', surname: 'Lis' },
    ],
  })
  wrapper = mount(SearchBox, { global: { plugins: [pinia] }, attachTo: document.body })
  return wrapper
}

function field(w: VueWrapper) {
  return w.get('input[aria-label="Szukaj osoby"]')
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('SearchBox', () => {
  it('pokazuje wyniki z latami życia', async () => {
    const w = mountBox()
    await field(w).setValue('wisniewska')
    const options = w.findAll('[role="option"]')
    expect(options.map((o) => o.text())).toEqual(['Anna Wiśniewska', 'Ewa Wiśniewska1950'])
  })

  it('strzałka i Enter zaznaczają osobę, otwierają kartę i czyszczą pole', async () => {
    const w = mountBox()
    await field(w).setValue('wisniewska')
    await field(w).trigger('keydown', { key: 'ArrowDown' })
    await field(w).trigger('keydown', { key: 'Enter' })
    expect(useSelectionStore().selectedPersonId).toBe('p_ewa')
    expect(useSelectionStore().pendingFocusId).toBe('p_ewa')
    expect(usePanelStore().view).toEqual({ kind: 'card', personId: 'p_ewa' })
    expect((field(w).element as HTMLInputElement).value).toBe('')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('kliknięcie wyniku wybiera osobę', async () => {
    const w = mountBox()
    await field(w).setValue('lis')
    await w.get('[role="option"]').trigger('mousedown')
    expect(useSelectionStore().selectedPersonId).toBe('p_jan')
  })

  it('pokazuje „Brak wyników”', async () => {
    const w = mountBox()
    await field(w).setValue('kowalski')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
    expect(w.get('[role="status"]').text()).toBe('Brak wyników')
  })

  it('Escape zamyka listę i czyści pole', async () => {
    const w = mountBox()
    await field(w).setValue('lis')
    await field(w).trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="listbox"]').exists()).toBe(false)
    expect((field(w).element as HTMLInputElement).value).toBe('')
  })

  it('„/” poza polem tekstowym przenosi fokus do wyszukiwarki', () => {
    const w = mountBox()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    expect(document.activeElement).toBe(field(w).element)
  })

  it('„/” w polu tekstowym jest zwykłym znakiem', () => {
    const w = mountBox()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })
    textarea.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(textarea)
    expect(document.activeElement).not.toBe(field(w).element)
  })

  it.each([
    ['/', false],
    ['k', true],
  ])('skrót „%s” (Ctrl: %s) przy otwartym oknie modalnym nie działa', (key, ctrlKey) => {
    const w = mountBox()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'alertdialog')
    const button = document.createElement('button')
    dialog.appendChild(button)
    document.body.appendChild(dialog)
    button.focus()
    const event = new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true, cancelable: true })
    button.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(button)
    expect(document.activeElement).not.toBe(field(w).element)
  })

  it('Ctrl+K przenosi fokus do wyszukiwarki także z pola tekstowego', () => {
    const w = mountBox()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    textarea.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(field(w).element)
  })

  it('wybór z listy „Do sprawdzenia” albo edycji innej osoby otwiera kartę bez powrotu', async () => {
    const w = mountBox()
    const panel = usePanelStore()
    panel.openCard('p_jan', { fromReview: true })
    panel.openEdit('p_jan')
    await field(w).setValue('ewa')
    await field(w).trigger('keydown', { key: 'Enter' })
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_ewa' })
    expect(panel.canReturnToReview).toBe(false)

    panel.openReview()
    await field(w).setValue('ewa')
    await field(w).trigger('keydown', { key: 'Enter' })
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_ewa' })
    expect(panel.canReturnToReview).toBe(false)
  })
})
