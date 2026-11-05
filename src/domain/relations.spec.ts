import { describe, expect, it } from 'vitest'
import { buildFamily } from '@tests/fixtures/build-family'
import {
  ancestorIds,
  childrenOf,
  descendantIds,
  isUnknownPerson,
  parentsOf,
  partnersOf,
  siblingsOf,
  unionsOf,
} from '@/domain/relations'
import type { Person } from '@/domain/schema'

// Grandparents A+B have C (born 1965) and D (born about 1969); C+E have F; G has no relations.
// D is listed before C so that child order must come from birth dates, not input order.
const family = buildFamily({
  persons: [
    { id: 'p_A' },
    { id: 'p_B' },
    { id: 'p_D', birth: { date: { year: 1969, qualifier: 'about' } } },
    { id: 'p_C', birth: { date: { year: 1965 } } },
    { id: 'p_E' },
    { id: 'p_F' },
    { id: 'p_G' },
  ],
  parentChild: [
    ['p_A', 'p_D'],
    ['p_B', 'p_D'],
    ['p_A', 'p_C'],
    ['p_B', 'p_C'],
    ['p_C', 'p_F'],
    ['p_E', 'p_F'],
  ],
  unions: [
    ['p_A', 'p_B'],
    ['p_C', 'p_E'],
  ],
})

const ids = (persons: Person[]) => persons.map((p) => p.id)

describe('zapytania o relacje', () => {
  it('zwraca rodziców', () => {
    expect(ids(parentsOf(family, 'p_C')).sort()).toEqual(['p_A', 'p_B'])
  })

  it('zwraca dzieci posortowane według daty urodzenia', () => {
    expect(ids(childrenOf(family, 'p_A'))).toEqual(['p_C', 'p_D'])
  })

  it('zwraca rodzeństwo bez samej osoby', () => {
    expect(ids(siblingsOf(family, 'p_C'))).toEqual(['p_D'])
  })

  it('zwraca partnerów i związki', () => {
    expect(ids(partnersOf(family, 'p_C'))).toEqual(['p_E'])
    expect(unionsOf(family, 'p_C').map((u) => u.id)).toEqual(['u_2'])
  })

  it('zwraca wszystkich przodków', () => {
    expect(ancestorIds(family, 'p_F')).toEqual(new Set(['p_C', 'p_E', 'p_A', 'p_B']))
  })

  it('zwraca wszystkich potomków', () => {
    expect(descendantIds(family, 'p_A')).toEqual(new Set(['p_C', 'p_D', 'p_F']))
  })

  it('zwraca puste listy dla osoby bez relacji', () => {
    expect(parentsOf(family, 'p_G')).toEqual([])
    expect(siblingsOf(family, 'p_G')).toEqual([])
  })

  it('kończy przechodzenie przy cyklu', () => {
    const cyclic = buildFamily({
      persons: [{ id: 'p_X' }, { id: 'p_Y' }],
      parentChild: [
        ['p_X', 'p_Y'],
        ['p_Y', 'p_X'],
      ],
    })
    expect(ancestorIds(cyclic, 'p_X')).toEqual(new Set(['p_Y', 'p_X']))
  })
})

describe('isUnknownPerson', () => {
  it('rozpoznaje osobę bez imienia i nazwiska', () => {
    const person = buildFamily({ persons: [{ id: 'p_1', givenNames: ' ', surname: '' }] })
      .persons[0]!
    expect(isUnknownPerson(person)).toBe(true)
  })

  it('nie traktuje osoby z nazwiskiem jako nieznanej', () => {
    const person = buildFamily({ persons: [{ id: 'p_1', givenNames: '', surname: 'Nowak' }] })
      .persons[0]!
    expect(isUnknownPerson(person)).toBe(false)
  })
})
