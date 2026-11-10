import { describe, expect, it } from 'vitest'
import { buildFamily } from '@tests/fixtures/build-family'
import { familyDataSchema } from '@/domain/schema'
import seed from '@seed/demo-family.json'
import { personCardView } from './person-card-view'

const data = familyDataSchema.parse(seed)

describe('personCardView', () => {
  it('zwraca null dla nieistniejącej osoby', () => {
    expect(personCardView(data, 'p_brak')).toBeNull()
  })

  it('Piotr ma rodziców, partnerkę ze związku, dzieci i rodzeństwo', () => {
    const view = personCardView(data, 'p_piotr_kowalczyk')!
    expect(view.displayName).toBe('Piotr Kowalczyk')
    expect(view.parents.map((p) => p.personId).sort()).toEqual([
      'p_andrzej_kowalczyk',
      'p_ewa_kowalczyk',
    ])
    expect(view.partners).toHaveLength(1)
    expect(view.partners[0]).toMatchObject({
      personId: 'p_katarzyna_kowalczyk',
      unionType: 'związek',
    })
    expect(view.partners[0]!.start?.date).toBe('2005')
    expect(view.children.map((p) => p.personId)).toEqual(['p_ola_kowalczyk'])
    expect(view.siblings.map((p) => p.personId)).toEqual(['p_anna_kowalczyk'])
    expect(view.birth?.place).toBe('Nowe Miasto')
  })

  it('sortuje dzieci i rodzeństwo według urodzenia', () => {
    const family = buildFamily({
      persons: [
        { id: 'p_r' },
        { id: 'p_a', birth: { date: { year: 1990 } } },
        { id: 'p_b', birth: { date: { year: 1980 } } },
        { id: 'p_c', birth: { date: { year: 1985 } } },
      ],
      parentChild: [
        ['p_r', 'p_a'],
        ['p_r', 'p_b'],
        ['p_r', 'p_c'],
      ],
    })
    expect(personCardView(family, 'p_r')!.children.map((p) => p.personId)).toEqual([
      'p_b',
      'p_c',
      'p_a',
    ])
    expect(personCardView(family, 'p_a')!.siblings.map((p) => p.personId)).toEqual(['p_b', 'p_c'])
  })

  it('przenosi unconfirmed, notatki badawcze i renderuje biografię', () => {
    const stefan = personCardView(data, 'p_stefan_lis')!
    expect(stefan.birth?.unconfirmed).toBe(true)
    expect(stefan.researchNotes).not.toBe('')
    expect(personCardView(data, 'p_jan_kowalczyk')!.bioHtml).toContain('<p>')
  })
})
