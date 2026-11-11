import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { FamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'
import { useSelectionStore } from '@/stores/selection'
import { buildFamily } from '@tests/fixtures/build-family'
import AddPersonForm from './AddPersonForm.vue'

const updates: Array<{ immediate?: boolean } | undefined> = []

function setup(data: FamilyData) {
  const family = useFamilyStore()
  family.status = 'ready'
  family.source = 'user'
  family.data = data
  family.update = (mutator, opts) => {
    const draft = structuredClone(family.data!)
    mutator(draft)
    family.data = draft
    updates.push(opts)
  }
  return family
}

type Relation = 'parent' | 'partner' | 'child' | 'sibling'

function relative(relation: Relation, anchorId = 'p_a') {
  return mount(AddPersonForm, {
    props: { mode: 'relative', anchorId, relation },
    attachTo: document.body,
  })
}

function button(wrapper: ReturnType<typeof relative>, text: string) {
  return wrapper.findAll('button').find((b) => b.text() === text)!
}

describe('AddPersonForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    updates.length = 0
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('tytuł zależy od relacji', () => {
    setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    expect(relative('parent').text()).toContain('Dodaj rodzica')
    expect(relative('partner').text()).toContain('Dodaj partnera')
    expect(relative('child').text()).toContain('Dodaj dziecko')
    expect(relative('sibling').text()).toContain('Dodaj rodzeństwo')
  })

  it('puste pola dodają osobę nieznaną i relację, natychmiast, z focusem', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const wrapper = relative('child')
    await button(wrapper, 'Dodaj').trigger('click')
    expect(family.data!.persons).toHaveLength(2)
    const created = family.data!.persons[1]!
    expect(created.givenNames).toBe('')
    expect(created.sex).toBe('unknown')
    expect(family.data!.parentChild).toEqual([
      { parentId: 'p_a', childId: created.id, type: 'biological' },
    ])
    expect(updates).toEqual([{ immediate: true }])
    expect(useSelectionStore().pendingFocusId).toBe(created.id)
    expect(wrapper.emitted('done')).toEqual([[created.id]])
  })

  it('wpisane imię i nazwisko trafiają do osoby', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const wrapper = relative('sibling')
    await wrapper.get('input[name="givenNames"]').setValue('Anna')
    await wrapper.get('input[name="surname"]').setValue('Nowak')
    await button(wrapper, 'Dodaj').trigger('click')
    expect(family.data!.persons[1]).toMatchObject({ givenNames: 'Anna', surname: 'Nowak' })
  })

  it('„Nazwisko rodowe” jest od razu przy płci Kobieta, inaczej za przyciskiem', async () => {
    setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const wrapper = relative('child')
    expect(wrapper.find('input[name="maidenName"]').exists()).toBe(false)
    await wrapper.get('[role="radio"][value="female"]').trigger('click')
    expect(wrapper.find('input[name="maidenName"]').exists()).toBe(true)

    const other = relative('child')
    await button(other, '+ nazwisko rodowe').trigger('click')
    expect(other.find('input[name="maidenName"]').exists()).toBe(true)
  })

  it('płeć partnera jest domyślnie przeciwna do płci kotwicy', () => {
    setup(
      buildFamily({
        persons: [
          { id: 'p_a', sex: 'male' },
          { id: 'p_k', sex: 'female' },
        ],
      }),
    )
    const checked = (w: ReturnType<typeof relative>) =>
      w.get('[role="radio"][aria-checked="true"]').attributes('value')
    expect(checked(relative('partner', 'p_a'))).toBe('female')
    expect(checked(relative('partner', 'p_k'))).toBe('male')
    expect(checked(relative('child', 'p_a'))).toBe('unknown')
  })

  it('rodzic przy dwóch biologicznych: komunikat i wyłączone „Dodaj”', () => {
    setup(
      buildFamily({
        persons: [{ id: 'p_a' }, { id: 'p_m' }, { id: 'p_o' }],
        parentChild: [
          ['p_m', 'p_a'],
          ['p_o', 'p_a'],
        ],
      }),
    )
    const wrapper = relative('parent')
    expect(wrapper.text()).toContain('Osoba może mieć najwyżej dwoje rodziców biologicznych.')
    expect(button(wrapper, 'Dodaj').attributes('disabled')).toBeDefined()
  })

  it('dziecko przy dwóch związkach wymaga wyboru „Z kim?”', async () => {
    const family = setup(
      buildFamily({
        persons: [
          { id: 'p_a', sex: 'male' },
          { id: 'p_k', givenNames: 'Kasia', sex: 'female' },
          { id: 'p_l', givenNames: 'Lena', sex: 'female' },
        ],
        unions: [
          ['p_a', 'p_k'],
          ['p_a', 'p_l'],
        ],
      }),
    )
    const wrapper = relative('child')
    expect(wrapper.text()).toContain('Z kim?')
    expect(wrapper.text()).toContain('nieznany drugi rodzic')
    expect(button(wrapper, 'Dodaj').attributes('disabled')).toBeDefined()
    await wrapper.get('[role="radio"][value="u_2"]').trigger('click')
    expect(button(wrapper, 'Dodaj').attributes('disabled')).toBeUndefined()
    await button(wrapper, 'Dodaj').trigger('click')
    const created = family.data!.persons.at(-1)!
    const parents = family
      .data!.parentChild.filter((pc) => pc.childId === created.id)
      .map((pc) => pc.parentId)
    expect(parents.sort()).toEqual(['p_a', 'p_l'])
  })

  it('„Anuluj” emituje cancel', async () => {
    setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const wrapper = relative('child')
    await button(wrapper, 'Anuluj').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('tryb pierwszej osoby: „To jestem ja” zaznaczone domyślnie ustawia selfPersonId', async () => {
    const family = setup(buildFamily({ persons: [] }))
    const wrapper = mount(AddPersonForm, { props: { mode: 'first' }, attachTo: document.body })
    expect(wrapper.text()).toContain('Dodaj pierwszą osobę')
    const self = wrapper.get('input[name="self"]').element as HTMLInputElement
    expect(self.checked).toBe(true)
    await wrapper.get('input[name="givenNames"]').setValue('Piotr')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Dodaj')!
      .trigger('click')
    const created = family.data!.persons[0]!
    expect(family.data!.settings.selfPersonId).toBe(created.id)
    expect(useSelectionStore().pendingFocusId).toBe(created.id)
  })

  it('błąd mutacji pokazuje komunikat i nie emituje done', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    family.update = () => {
      throw new Error('Dane zmieniły się w innej karcie, odśwież')
    }
    const wrapper = relative('child')
    await button(wrapper, 'Dodaj').trigger('click')
    expect(wrapper.text()).toContain('Dane zmieniły się w innej karcie, odśwież')
    expect(wrapper.emitted('done')).toBeUndefined()
  })

  describe('istniejąca osoba', () => {
    async function existing(relation: Relation, anchorId = 'p_a') {
      const wrapper = relative(relation, anchorId)
      await button(wrapper, 'Istniejąca osoba').trigger('click')
      return wrapper
    }

    function items(wrapper: ReturnType<typeof relative>) {
      return wrapper.findAll('[data-testid="existing-person-item"]')
    }

    it('przełącznik chowa pola nowej osoby i pokazuje wyszukiwanie', async () => {
      setup(buildFamily({ persons: [{ id: 'p_a' }] }))
      const wrapper = await existing('child')
      expect(wrapper.find('input[name="givenNames"]').exists()).toBe(false)
      expect(wrapper.find('input[name="search"]').exists()).toBe(true)
      await button(wrapper, 'Nowa osoba').trigger('click')
      expect(wrapper.find('input[name="givenNames"]').exists()).toBe(true)
    })

    it('w trybie pierwszej osoby nie ma przełącznika', () => {
      setup(buildFamily({ persons: [] }))
      const wrapper = mount(AddPersonForm, { props: { mode: 'first' }, attachTo: document.body })
      expect(wrapper.text()).not.toContain('Istniejąca osoba')
    })

    it('rodzic, który jest wnukiem kotwicy, jest wyłączony z komunikatem', async () => {
      setup(
        buildFamily({
          persons: [
            { id: 'p_a', givenNames: 'Adam' },
            { id: 'p_d', givenNames: 'Dorota' },
            { id: 'p_w', givenNames: 'Wiktor' },
          ],
          parentChild: [
            ['p_a', 'p_d'],
            ['p_d', 'p_w'],
          ],
        }),
      )
      const wrapper = await existing('parent')
      await wrapper.get('input[name="search"]').setValue('wiktor')
      const [item] = items(wrapper)
      expect(item!.attributes('disabled')).toBeDefined()
      expect(item!.text()).toContain('Osoba nie może być swoim własnym przodkiem.')
    })

    it('wybór poprawnej osoby tworzy relację bez nowej osoby i ustawia focus', async () => {
      const family = setup(
        buildFamily({
          persons: [
            { id: 'p_a', givenNames: 'Adam' },
            { id: 'p_x', givenNames: 'Zofia', surname: 'Wiśniewska' },
          ],
        }),
      )
      const wrapper = await existing('parent')
      expect(items(wrapper)).toHaveLength(0)
      expect(button(wrapper, 'Dodaj').attributes('disabled')).toBeDefined()
      await wrapper.get('input[name="search"]').setValue('wisniew')
      expect(items(wrapper)).toHaveLength(1)
      await items(wrapper)[0]!.trigger('click')
      await button(wrapper, 'Dodaj').trigger('click')
      expect(family.data!.persons).toHaveLength(2)
      expect(family.data!.parentChild).toEqual([
        { parentId: 'p_x', childId: 'p_a', type: 'biological' },
      ])
      expect(updates).toEqual([{ immediate: true }])
      expect(useSelectionStore().pendingFocusId).toBe('p_x')
      expect(wrapper.emitted('done')).toEqual([['p_x']])
    })

    it('zmiana zapytania albo trybu czyści wybór, więc „Dodaj” nie łączy niewidocznej osoby', async () => {
      const family = setup(
        buildFamily({
          persons: [
            { id: 'p_a', givenNames: 'Adam' },
            { id: 'p_x', givenNames: 'Zofia', surname: 'Wiśniewska' },
            { id: 'p_y', givenNames: 'Jan', surname: 'Kowalski' },
          ],
        }),
      )
      const wrapper = await existing('parent')
      await wrapper.get('input[name="search"]').setValue('wisniew')
      await items(wrapper)[0]!.trigger('click')
      await wrapper.get('input[name="search"]').setValue('kowal')
      expect(button(wrapper, 'Dodaj').attributes('disabled')).toBeDefined()
      await wrapper.get('input[name="search"]').setValue('wisniew')
      expect(items(wrapper)[0]!.attributes('aria-pressed')).toBe('false')
      await items(wrapper)[0]!.trigger('click')
      await button(wrapper, 'Nowa osoba').trigger('click')
      await button(wrapper, 'Istniejąca osoba').trigger('click')
      expect(button(wrapper, 'Dodaj').attributes('disabled')).toBeDefined()
      await button(wrapper, 'Dodaj').trigger('click')
      expect(family.data!.parentChild).toEqual([])
    })

    it('kotwica nie występuje na liście, a wyników jest najwyżej 8', async () => {
      setup(
        buildFamily({
          persons: Array.from({ length: 12 }, (_, i) => ({
            id: `p_${i}`,
            givenNames: 'Osoba',
            surname: `Test${i}`,
          })),
        }),
      )
      const wrapper = await existing('sibling', 'p_0')
      await wrapper.get('input[name="search"]').setValue('osoba')
      expect(items(wrapper)).toHaveLength(8)
      expect(wrapper.text()).not.toContain('Test0')
    })

    it('dziecko istniejące przy dwóch związkach nadal wymaga „Z kim?”', async () => {
      const family = setup(
        buildFamily({
          persons: [
            { id: 'p_a', sex: 'male' },
            { id: 'p_k', givenNames: 'Kasia', sex: 'female' },
            { id: 'p_l', givenNames: 'Lena', sex: 'female' },
            { id: 'p_c', givenNames: 'Cezary' },
          ],
          unions: [
            ['p_a', 'p_k'],
            ['p_a', 'p_l'],
          ],
        }),
      )
      const wrapper = await existing('child')
      await wrapper.get('input[name="search"]').setValue('cezary')
      await items(wrapper)[0]!.trigger('click')
      expect(wrapper.text()).toContain('Z kim?')
      expect(button(wrapper, 'Dodaj').attributes('disabled')).toBeDefined()
      await wrapper.get('[role="radio"][value="u_2"]').trigger('click')
      await button(wrapper, 'Dodaj').trigger('click')
      expect(family.data!.persons).toHaveLength(4)
      expect(
        family.data!.parentChild.filter((pc) => pc.childId === 'p_c').map((pc) => pc.parentId),
      ).toEqual(expect.arrayContaining(['p_a', 'p_l']))
    })
  })
})
