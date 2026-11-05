import { describe, expect, it } from 'vitest'
import { buildFamily, type FamilySpec } from '@tests/fixtures/build-family'
import { canAddParent, canAddUnion, checkRelationRules } from '@/domain/relation-rules'
import type { FamilyData } from '@/domain/schema'

const persons = (...ids: string[]) => ids.map((id) => ({ id }))

function violationPaths(spec: FamilySpec | FamilyData): string[] {
  const data = 'version' in spec ? spec : buildFamily(spec)
  const violations = checkRelationRules(data)
  for (const v of violations) expect(v.message.length).toBeGreaterThan(0)
  return violations.map((v) => v.path)
}

// Same family as in relations.spec.ts: A+B → C, D; C+E → F; G alone.
const family = buildFamily({
  persons: persons('p_A', 'p_B', 'p_C', 'p_D', 'p_E', 'p_F', 'p_G'),
  parentChild: [
    ['p_A', 'p_C'],
    ['p_B', 'p_C'],
    ['p_A', 'p_D'],
    ['p_B', 'p_D'],
    ['p_C', 'p_F'],
    ['p_E', 'p_F'],
  ],
  unions: [
    ['p_A', 'p_B'],
    ['p_C', 'p_E'],
  ],
})

describe('checkRelationRules', () => {
  it('akceptuje poprawną rodzinę', () => {
    expect(checkRelationRules(family)).toEqual([])
  })

  it('wykrywa cykl bezpośredni', () => {
    const paths = violationPaths({
      persons: persons('p_A', 'p_B'),
      parentChild: [
        ['p_A', 'p_B'],
        ['p_B', 'p_A'],
      ],
    })
    expect(paths).toEqual(['parentChild[1]'])
  })

  it('wykrywa cykl pośredni', () => {
    const paths = violationPaths({
      persons: persons('p_A', 'p_B', 'p_C'),
      parentChild: [
        ['p_A', 'p_B'],
        ['p_B', 'p_C'],
        ['p_C', 'p_A'],
      ],
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatch(/^parentChild\[\d\]$/)
  })

  it('wykrywa osobę, która jest swoim rodzicem', () => {
    expect(violationPaths({ persons: persons('p_A'), parentChild: [['p_A', 'p_A']] })).toEqual([
      'parentChild[0]',
    ])
  })

  it('wykrywa trzeciego rodzica biologicznego', () => {
    const paths = violationPaths({
      persons: persons('p_A', 'p_B', 'p_C', 'p_X'),
      parentChild: [
        ['p_A', 'p_X'],
        ['p_B', 'p_X'],
        ['p_C', 'p_X'],
      ],
    })
    expect(paths).toEqual(['parentChild[2]'])
  })

  it('pozwala na rodzica adopcyjnego obok dwóch biologicznych', () => {
    const paths = violationPaths({
      persons: persons('p_A', 'p_B', 'p_C', 'p_X'),
      parentChild: [
        ['p_A', 'p_X'],
        ['p_B', 'p_X'],
        ['p_C', 'p_X', 'adoptive'],
      ],
    })
    expect(paths).toEqual([])
  })

  it('wykrywa zduplikowaną relację rodzic–dziecko', () => {
    const paths = violationPaths({
      persons: persons('p_A', 'p_X'),
      parentChild: [
        ['p_A', 'p_X'],
        ['p_A', 'p_X', 'adoptive'],
      ],
    })
    expect(paths).toEqual(['parentChild[1]'])
  })

  it('wykrywa dwa związki tej samej pary, także w odwrotnej kolejności', () => {
    const paths = violationPaths({
      persons: persons('p_A', 'p_B'),
      unions: [
        ['p_A', 'p_B'],
        ['p_B', 'p_A'],
      ],
    })
    expect(paths).toEqual(['unions[1]'])
  })

  it('wykrywa związek osoby z samą sobą', () => {
    expect(violationPaths({ persons: persons('p_A'), unions: [['p_A', 'p_A']] })).toEqual([
      'unions[0].partnerIds',
    ])
  })

  it('wykrywa identyfikatory wskazujące nieistniejące osoby', () => {
    const data = buildFamily({
      persons: persons('p_A'),
      parentChild: [['p_Z', 'p_A']],
      unions: [['p_A', 'p_Y']],
    })
    data.settings.selfPersonId = 'p_Q'
    expect(violationPaths(data)).toEqual([
      'parentChild[0].parentId',
      'unions[0].partnerIds[1]',
      'settings.selfPersonId',
    ])
  })

  it('wykrywa zduplikowane identyfikatory osób i związków', () => {
    const data = buildFamily({
      persons: persons('p_A', 'p_B', 'p_A'),
      unions: [['p_A', 'p_B']],
    })
    data.unions.push({ ...data.unions[0]!, partnerIds: ['p_B', 'p_B'] })
    const paths = violationPaths(data)
    expect(paths).toContain('persons[2].id')
    expect(paths).toContain('unions[1].id')
  })
})

describe('canAddParent', () => {
  it('nie pozwala dodać potomka jako rodzica', () => {
    const result = canAddParent(family, 'p_A', 'p_F', 'biological')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('przodkiem')
  })

  it('nie pozwala dodać trzeciego rodzica biologicznego', () => {
    expect(canAddParent(family, 'p_C', 'p_G', 'biological').ok).toBe(false)
  })

  it('pozwala dodać trzeciego rodzica jako adopcyjnego', () => {
    expect(canAddParent(family, 'p_C', 'p_G', 'adoptive')).toEqual({ ok: true })
  })

  it('pozwala dodać poprawnego rodzica', () => {
    expect(canAddParent(family, 'p_E', 'p_G', 'biological')).toEqual({ ok: true })
  })

  it('nie pozwala na istniejącą relację ani na bycie swoim rodzicem', () => {
    expect(canAddParent(family, 'p_C', 'p_A', 'adoptive').ok).toBe(false)
    expect(canAddParent(family, 'p_G', 'p_G', 'biological').ok).toBe(false)
  })
})

describe('canAddUnion', () => {
  it('nie pozwala na zduplikowany związek', () => {
    expect(canAddUnion(family, 'p_E', 'p_C').ok).toBe(false)
  })

  it('nie pozwala na związek z samym sobą', () => {
    expect(canAddUnion(family, 'p_G', 'p_G').ok).toBe(false)
  })

  it('pozwala na nowy związek', () => {
    expect(canAddUnion(family, 'p_D', 'p_G')).toEqual({ ok: true })
  })
})
