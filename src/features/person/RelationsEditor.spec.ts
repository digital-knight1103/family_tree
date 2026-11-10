import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { FamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'
import { buildFamily } from '@tests/fixtures/build-family'
import RelationsEditor from './RelationsEditor.vue'

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

function mountEditor(personId = 'p_child') {
  return mount(RelationsEditor, { props: { personId }, attachTo: document.body })
}

const withThreeParents = () =>
  buildFamily({
    persons: [
      { id: 'p_child', givenNames: 'Dziecko' },
      { id: 'p_m', givenNames: 'Matka' },
      { id: 'p_f', givenNames: 'Ojciec' },
      { id: 'p_x', givenNames: 'Wuj' },
    ],
    parentChild: [
      ['p_m', 'p_child'],
      ['p_f', 'p_child'],
      ['p_x', 'p_child', 'adoptive'],
    ],
    unions: [['p_child', 'p_m']],
  })

describe('RelationsEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    updates.length = 0
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pokazuje rodziców, dzieci i partnerów z typami', () => {
    setup(withThreeParents())
    const wrapper = mountEditor()
    expect(wrapper.text()).toContain('Matka')
    expect(wrapper.text()).toContain('Wuj')
    expect(wrapper.findAll('[data-testid="parent-row"]')).toHaveLength(3)
    const asParent = mountEditor('p_m')
    expect(asParent.findAll('[data-testid="child-row"]')).toHaveLength(1)
    expect(asParent.findAll('[data-testid="union-row"]')).toHaveLength(1)
  })

  it('zmiana typu na „biologiczny” przy dwóch biologicznych: komunikat, dane bez zmian', async () => {
    const family = setup(withThreeParents())
    const wrapper = mountEditor()
    const row = wrapper.findAll('[data-testid="parent-row"]')[2]!
    await row.get('select').setValue('biological')
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Osoba może mieć najwyżej dwoje rodziców biologicznych.',
    )
    expect(family.data!.parentChild[2]!.type).toBe('adoptive')
    expect((row.get('select').element as HTMLSelectElement).value).toBe('adoptive')
  })

  it('nieudana zmiana typu związku przywraca select do zapisanego typu', async () => {
    const family = setup(withThreeParents())
    const wrapper = mountEditor()
    family.update = () => {
      throw new Error('Zapis zablokowany.')
    }
    const select = wrapper.get('[data-testid="union-row"] select')
    await select.setValue('partnership')
    expect(wrapper.get('[role="alert"]').text()).toBe('Zapis zablokowany.')
    expect((select.element as HTMLSelectElement).value).toBe('marriage')
  })

  it('zmiana typu relacji zapisuje z immediate', async () => {
    const family = setup(withThreeParents())
    const wrapper = mountEditor()
    await wrapper.findAll('[data-testid="parent-row"]')[0]!.get('select').setValue('adoptive')
    expect(family.data!.parentChild[0]!.type).toBe('adoptive')
    expect(updates).toEqual([{ immediate: true }])
  })

  it('„Usuń relację” usuwa tylko tę relację', async () => {
    const family = setup(withThreeParents())
    const wrapper = mountEditor()
    const row = wrapper.findAll('[data-testid="parent-row"]')[2]!
    await row
      .findAll('button')
      .find((b) => b.text() === 'Usuń relację')!
      .trigger('click')
    expect(family.data!.parentChild.map((r) => r.parentId)).toEqual(['p_m', 'p_f'])
    expect(family.data!.persons).toHaveLength(4)
  })

  it('„Usuń związek” usuwa związek, ale nie osoby', async () => {
    const family = setup(withThreeParents())
    const wrapper = mountEditor()
    await wrapper
      .get('[data-testid="union-row"]')
      .findAll('button')
      .find((b) => b.text() === 'Usuń związek')!
      .trigger('click')
    expect(family.data!.unions).toEqual([])
    expect(family.data!.persons).toHaveLength(4)
  })

  it('edycja związku: typ, początek (data, miejsce, do potwierdzenia) i koniec', async () => {
    const family = setup(withThreeParents())
    const wrapper = mountEditor()
    const row = wrapper.get('[data-testid="union-row"]')
    await row.get('select').setValue('partnership')
    await row.get('input[id$="-start-date"]').setValue('1950')
    await row.get('input[id$="-start-place"]').setValue('Kraków')
    await row.get('[role="checkbox"]').trigger('click')
    await row.get('input[id$="-end-date"]').setValue('1980')
    const union = family.data!.unions[0]!
    expect(union.type).toBe('partnership')
    expect(union.start).toEqual({ date: { year: 1950 }, place: 'Kraków', unconfirmed: true })
    expect(union.end).toEqual({ date: { year: 1980 } })
  })
})
