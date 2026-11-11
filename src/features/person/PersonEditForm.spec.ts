import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { FamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'
import { buildFamily } from '@tests/fixtures/build-family'
import PersonEditForm from './PersonEditForm.vue'

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

function mountForm(personId = 'p_a') {
  return mount(PersonEditForm, { props: { personId }, attachTo: document.body })
}

describe('PersonEditForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    updates.length = 0
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('wpisywanie znak po znaku zapisuje imię bez gubienia znaków, bez immediate', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a', givenNames: '' }] }))
    const wrapper = mountForm()
    const input = wrapper.get('#edit-given-names')
    for (const text of ['J', 'Ja', 'Jan']) await input.setValue(text)
    expect((input.element as HTMLInputElement).value).toBe('Jan')
    expect(family.data!.persons[0]!.givenNames).toBe('Jan')
    expect(updates.every((u) => u?.immediate === undefined)).toBe(true)
  })

  it('imiona, nazwisko i nazwisko rodowe zapisują się po trim, pole zostaje jak wpisane', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a', sex: 'female' }] }))
    const wrapper = mountForm()
    await wrapper.get('#edit-given-names').setValue('Anna ')
    await wrapper.get('#edit-surname').setValue('  Nowak ')
    await wrapper.get('#edit-maiden-name').setValue(' Kowalska')
    expect((wrapper.get('#edit-given-names').element as HTMLInputElement).value).toBe('Anna ')
    const saved = family.data!.persons[0]!
    expect([saved.givenNames, saved.surname, saved.maidenName]).toEqual([
      'Anna',
      'Nowak',
      'Kowalska',
    ])
  })

  it('data śmierci zdejmuje „Żyje”', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a', living: true }] }))
    const wrapper = mountForm()
    await wrapper.get('#edit-death-date').setValue('1950')
    expect(family.data!.persons[0]!.death?.date).toEqual({ year: 1950 })
    expect(family.data!.persons[0]!.living).toBe(false)
  })

  it('pusta biografia usuwa klucz', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a', bio: 'x' }] }))
    const wrapper = mountForm()
    await wrapper.get('#edit-bio').setValue('')
    expect('bio' in family.data!.persons[0]!).toBe(false)
  })

  it('poprawna data zapisuje się, błędna nie zmienia zapisanej', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const wrapper = mountForm()
    const input = wrapper.get('#edit-birth-date')
    await input.setValue('ok. 1890')
    expect(family.data!.persons[0]!.birth?.date).toEqual({ year: 1890, qualifier: 'about' })
    await input.setValue('12.13.1921')
    expect(family.data!.persons[0]!.birth?.date).toEqual({ year: 1890, qualifier: 'about' })
    expect(wrapper.find('[data-testid="date-error"]').exists()).toBe(true)
    await input.setValue('')
    expect(family.data!.persons[0]!.birth).toBeUndefined()
  })

  it('„To jestem ja” ustawia settings.selfPersonId natychmiast i znika', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const wrapper = mountForm()
    const button = wrapper.findAll('button').find((b) => b.text() === 'To jestem ja')!
    await button.trigger('click')
    expect(family.data!.settings.selfPersonId).toBe('p_a')
    expect(updates.at(-1)).toEqual({ immediate: true })
    expect(wrapper.findAll('button').some((b) => b.text() === 'To jestem ja')).toBe(false)
    expect(wrapper.text()).toContain('To Ty')
  })

  it('zmiana personId w trakcie pisania nie przenosi tekstu na drugą osobę', async () => {
    const family = setup(
      buildFamily({
        persons: [
          { id: 'p_a', givenNames: 'Anna' },
          { id: 'p_b', givenNames: 'Barbara' },
        ],
      }),
    )
    const wrapper = mountForm('p_a')
    await wrapper.get('#edit-given-names').setValue('Annabella')
    await wrapper.setProps({ personId: 'p_b' })
    expect((wrapper.get('#edit-given-names').element as HTMLInputElement).value).toBe('Barbara')
    await wrapper.get('#edit-given-names').setValue('Basia')
    const names = Object.fromEntries(family.data!.persons.map((p) => [p.id, p.givenNames]))
    expect(names).toEqual({ p_a: 'Annabella', p_b: 'Basia' })
  })

  it('płeć i „Żyje” zapisują się natychmiast', async () => {
    const family = setup(buildFamily({ persons: [{ id: 'p_a', living: true }] }))
    const wrapper = mountForm()
    await wrapper.get('#edit-sex-female').trigger('click')
    expect(family.data!.persons[0]!.sex).toBe('female')
    await wrapper.get('#edit-living').trigger('click')
    expect(family.data!.persons[0]!.living).toBe(false)
    expect(updates.every((u) => u?.immediate === true)).toBe(true)
  })

  it('„Gotowe” emituje done', async () => {
    setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const wrapper = mountForm()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('done')).toHaveLength(1)
  })
})
