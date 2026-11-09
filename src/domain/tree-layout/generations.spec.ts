import { describe, expect, it } from 'vitest'
import seed from '@seed/demo-family.json'
import { familyDataSchema } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { assignGenerations } from './generations'

const ids = (...names: string[]) => names.map((id) => ({ id: `p_${id}` }))
const gen = (map: Map<string, number>, name: string) => map.get(`p_${name}`)

describe('assignGenerations', () => {
  it('rodzic jest pokolenie wyżej niż dziecko', () => {
    const result = assignGenerations(
      buildFamily({
        persons: ids('a', 'b', 'c'),
        parentChild: [
          ['p_a', 'p_b'],
          ['p_b', 'p_c'],
        ],
      }),
    )
    expect([gen(result, 'a'), gen(result, 'b'), gen(result, 'c')]).toEqual([0, 1, 2])
  })

  it('partner bez rodziców dostaje pokolenie współmałżonka', () => {
    const result = assignGenerations(
      buildFamily({
        persons: ids('a', 'b', 'x'),
        parentChild: [['p_a', 'p_b']],
        unions: [['p_b', 'p_x']],
      }),
    )
    expect(gen(result, 'x')).toBe(1)
  })

  it('rodzice współmałżonka trafiają pokolenie wyżej', () => {
    const result = assignGenerations(
      buildFamily({
        persons: ids('a', 'b', 'x', 'y'),
        parentChild: [
          ['p_a', 'p_b'],
          ['p_y', 'p_x'],
        ],
        unions: [['p_b', 'p_x']],
      }),
    )
    expect(gen(result, 'y')).toBe(0)
  })

  it('przydziela pokolenia danym demo', () => {
    const result = assignGenerations(familyDataSchema.parse(seed))
    const expected: Record<number, string[]> = {
      0: ['jan_kowalczyk', 'maria_kowalczyk', 'stefan_lis', 'nieznana_lis'],
      1: [
        'jozef_kowalczyk',
        'helena_mazur',
        'antoni_kowalczyk',
        'zofia_kowalczyk',
        'wladyslaw_mazur',
      ],
      2: [
        'andrzej_kowalczyk',
        'barbara_zielinska',
        'krzysztof_kowalczyk',
        'irena_mazur',
        'ewa_kowalczyk',
        'tomasz_zielinski',
      ],
      3: ['piotr_kowalczyk', 'anna_kowalczyk', 'marta_zielinska', 'katarzyna_kowalczyk'],
      4: ['ola_kowalczyk'],
    }
    for (const [g, names] of Object.entries(expected)) {
      for (const name of names) expect([name, gen(result, name)]).toEqual([name, Number(g)])
    }
    expect(result.size).toBe(20)
  })

  it('każda niepołączona grupa zaczyna od pokolenia 0', () => {
    const result = assignGenerations(
      buildFamily({
        persons: ids('a', 'b', 'c', 'd', 'e'),
        parentChild: [
          ['p_a', 'p_b'],
          ['p_c', 'p_d'],
        ],
      }),
    )
    expect(['a', 'b', 'c', 'd', 'e'].map((n) => gen(result, n))).toEqual([0, 1, 0, 1, 0])
  })

  it('kończy się przy związku z własnym wnukiem', () => {
    const data = buildFamily({
      persons: ids('a', 'b', 'c'),
      parentChild: [
        ['p_a', 'p_b'],
        ['p_b', 'p_c'],
      ],
      unions: [['p_a', 'p_c']],
    })
    const result = assignGenerations(data)
    expect(result.size).toBe(3)
    for (const { parentId, childId } of data.parentChild) {
      expect(result.get(childId)!).toBeGreaterThan(result.get(parentId)!)
    }
  })

  it('nie zależy od kolejności tablic', () => {
    const data = familyDataSchema.parse(seed)
    const reversed = {
      ...data,
      persons: [...data.persons].reverse(),
      parentChild: [...data.parentChild].reverse(),
      unions: [...data.unions].reverse(),
    }
    expect(assignGenerations(reversed)).toEqual(assignGenerations(data))
  })
})
