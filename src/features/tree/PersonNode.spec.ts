import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PersonNode from './PersonNode.vue'
import type { PersonNodeView } from './person-node-view'

const view: PersonNodeView = {
  personId: 'p_a',
  displayName: 'Jan Kowalczyk',
  lifeSpan: '1890 – 1958',
  nameLine: 'Jan',
  surnameLine: 'Kowalczyk',
  dates: '12.03.1890 – 1958',
  maidenLine: '',
  initials: 'JK',
  sex: 'male',
  unknown: false,
  unconfirmed: false,
}

function mountNode(
  props: {
    view?: Partial<PersonNodeView>
    photoUrl?: string
    selected?: boolean
    editable?: boolean
  } = {},
) {
  return mount(PersonNode, {
    props: {
      view: { ...view, ...props.view },
      photoUrl: props.photoUrl,
      selected: props.selected ?? false,
      editable: props.editable,
    },
  })
}

describe('PersonNode', () => {
  it('pokazuje imiona, nazwisko i pełne daty w osobnych liniach, bez obcinania', () => {
    const wrapper = mountNode()
    expect(wrapper.get('[data-testid="person-node"]').attributes('data-person-id')).toBe('p_a')
    const lines = wrapper.findAll('.flex-col > span').map((line) => line.text())
    expect(lines).toEqual(['Jan', 'Kowalczyk', '12.03.1890 – 1958'])
    expect(wrapper.html()).not.toContain('truncate')
    expect(wrapper.text()).toContain('JK')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('ma szerokość z układu', () => {
    const node = mount(PersonNode, { props: { view, selected: false, width: 260 } })
    expect(node.get('[data-testid="person-node"]').attributes('style')).toContain('width: 260px')
  })

  it.each([
    ['parent', 'bg-violet-50'],
    ['sibling', 'bg-emerald-50'],
    ['partner', 'bg-amber-50'],
    ['child', 'bg-cyan-50'],
  ] as const)('grupa %s ma własne tło', (highlight, background) => {
    const node = mount(PersonNode, { props: { view, selected: false, highlight } })
    expect(node.get('[data-testid="person-node"]').classes()).toContain(background)
  })

  it('przygaszona osoba jest półprzezroczysta, bez podświetlenia wygląda zwyczajnie', () => {
    const dimmed = mount(PersonNode, { props: { view, selected: false, highlight: 'dimmed' } })
    expect(dimmed.get('[data-testid="person-node"]').classes()).toContain('opacity-40')
    const plain = mountNode().get('[data-testid="person-node"]').classes()
    expect(plain).toContain('bg-card')
    expect(plain).not.toContain('opacity-40')
  })

  it('pokazuje linię z nazwiskiem rodowym', () => {
    expect(mountNode({ view: { surnameLine: 'Kowalczyk z d. Lis' } }).text()).toContain(
      'Kowalczyk z d. Lis',
    )
  })

  it('pokazuje zdjęcie z alt równym nazwie', () => {
    const img = mountNode({ photoUrl: '/__data/photos/a.webp' }).get('img')
    expect(img.attributes('src')).toBe('/__data/photos/a.webp')
    expect(img.attributes('alt')).toBe('Jan Kowalczyk')
  })

  it('pokazuje plakietkę tylko przy faktach do potwierdzenia', () => {
    expect(mountNode().find('[aria-label="Fakty do potwierdzenia"]').exists()).toBe(false)
    const badge = mountNode({ view: { unconfirmed: true } }).get(
      '[aria-label="Fakty do potwierdzenia"]',
    )
    expect(badge.text()).toBe('?')
  })

  it('oznacza osobę nieznaną przerywaną ramką', () => {
    const root = mountNode({ view: { unknown: true } }).get('[data-testid="person-node"]')
    expect(root.attributes('data-unknown')).toBeDefined()
    expect(root.classes()).toContain('border-dashed')
    expect(root.classes()).toContain('opacity-70')
    expect(
      mountNode().get('[data-testid="person-node"]').attributes('data-unknown'),
    ).toBeUndefined()
  })

  it('oznacza zaznaczenie i płeć', () => {
    const root = mountNode({ selected: true, view: { sex: 'female' } }).get(
      '[data-testid="person-node"]',
    )
    expect(root.attributes('data-selected')).toBe('true')
    expect(root.attributes('data-sex')).toBe('female')
    expect(mountNode().get('[data-testid="person-node"]').attributes('data-selected')).toBe('false')
  })

  describe('przyciski „+”', () => {
    const labels = ['Dodaj rodzica', 'Dodaj partnera', 'Dodaj dziecko', 'Dodaj rodzeństwo']

    it('są cztery przy zaznaczeniu i editable', () => {
      const wrapper = mountNode({ selected: true, editable: true })
      const buttons = wrapper.findAll('button[aria-label^="Dodaj"]')
      expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(labels)
      for (const b of buttons)
        expect(b.classes()).toEqual(expect.arrayContaining(['nodrag', 'nopan']))
    })

    it('brak ich bez editable albo bez zaznaczenia', () => {
      expect(mountNode({ selected: true }).findAll('button')).toHaveLength(0)
      expect(mountNode({ selected: true, editable: false }).findAll('button')).toHaveLength(0)
      expect(mountNode({ editable: true }).findAll('button')).toHaveLength(0)
    })

    it('klik emituje add z rodzajem i nie dociera do rodzica', async () => {
      const onParentClick = vi.fn()
      const wrapper = mount(PersonNode, {
        props: { view, selected: true, editable: true },
        attachTo: document.body,
      })
      wrapper.element.parentElement?.addEventListener('click', onParentClick)
      for (const b of wrapper.findAll('button[aria-label^="Dodaj"]')) await b.trigger('click')
      expect(wrapper.emitted('add')).toEqual([['parent'], ['partner'], ['child'], ['sibling']])
      expect(onParentClick).not.toHaveBeenCalled()
      wrapper.unmount()
    })
  })
})
