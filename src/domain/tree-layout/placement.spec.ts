import { describe, expect, it } from 'vitest'
import seed from '@seed/demo-family.json'
import { familyDataSchema, type FamilyData } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { buildLargeFamily } from '@tests/fixtures/large-family'
import { buildTreeGraph } from './graph'
import { placeRows, type Placement } from './placement'
import { orderNodes } from './row-order'

const place = (data: FamilyData, widthOf: (nodeId: string) => number = () => 200) => {
  const graph = buildTreeGraph(data)
  return placeRows(graph, orderNodes(graph), widthOf, 104, 40)
}

/** The union point stands at `x` (to 0.01 px), its partner line at the top level. */
const expectUnion = (placement: Placement, unionId: string, x: number) => {
  const union = placement.unions.get(unionId)!
  expect(Math.abs(union.x - x), unionId).toBeLessThanOrEqual(0.01)
  expect(union.level, unionId).toBe(0)
}

describe('placeRows', () => {
  it('dzieci w różnych rzędach: rodzice nad środkiem dzieci z najbliższego rzędu', () => {
    // The aunt marries her nephew and moves one row down, to his row.
    const placement = place(
      buildFamily({
        persons: [
          { id: 'p_dziadek' },
          { id: 'p_babcia' },
          { id: 'p_ojciec', birth: { date: { year: 1950 } } },
          { id: 'p_ciotka', birth: { date: { year: 1960 } } },
          { id: 'p_matka' },
          { id: 'p_syn', birth: { date: { year: 1975 } } },
        ],
        parentChild: [
          ['p_dziadek', 'p_ojciec'],
          ['p_babcia', 'p_ojciec'],
          ['p_dziadek', 'p_ciotka'],
          ['p_babcia', 'p_ciotka'],
          ['p_ojciec', 'p_syn'],
          ['p_matka', 'p_syn'],
        ],
        unions: [
          ['p_dziadek', 'p_babcia'],
          ['p_ojciec', 'p_matka'],
          ['p_ciotka', 'p_syn'],
        ],
      }),
    )
    const x = (id: string) => placement.personX.get(`person:${id}`)!
    expect(x('p_ciotka')).not.toBe(x('p_ojciec'))
    expect(Math.abs(placement.unions.get('union:u_1')!.x - x('p_ojciec'))).toBeLessThanOrEqual(0.01)
  })

  it('wszystkie współrzędne mają najwyżej dwa miejsca po przecinku', () => {
    const odd = (nodeId: string) => 200 + (nodeId.length % 5) * 37
    for (const data of [familyDataSchema.parse(seed), buildLargeFamily()]) {
      for (const widthOf of [() => 200, odd]) {
        const { personX, unions, freeSpots } = place(data, widthOf)
        const values = [
          ...personX.values(),
          ...[...unions.values()].map((u) => u.x),
          ...[...freeSpots.values()].flat(),
        ]
        expect(values.filter((v) => Math.round(v * 100) / 100 !== v)).toEqual([])
      }
    }
  })

  it('kolejność X, A, Y (A z dwoma partnerami): dwie przerwy po 40 px, punkty związków w nich', () => {
    const placement = place(
      buildFamily({
        persons: [{ id: 'p_a' }, { id: 'p_x' }, { id: 'p_y' }, { id: 'p_m' }, { id: 'p_n' }],
        parentChild: [
          ['p_m', 'p_x'],
          ['p_n', 'p_y'],
        ],
        unions: [
          ['p_a', 'p_x'],
          ['p_a', 'p_y'],
        ],
      }),
    )
    const [x, a, y] = ['p_x', 'p_a', 'p_y'].map((id) => placement.personX.get(`person:${id}`)!) as [
      number,
      number,
      number,
    ]
    expect(Math.abs(a - x - 240)).toBeLessThanOrEqual(0.01)
    expect(Math.abs(y - a - 240)).toBeLessThanOrEqual(0.01)
    expectUnion(placement, 'union:u_1', (x + a) / 2)
    expectUnion(placement, 'union:u_2', (a + y) / 2)
  })

  it('partner partnera stoi na zewnątrz pary, obie przerwy po 40 px', () => {
    // R has parents; P is R's partner, Q is P's other partner.
    const placement = place(
      buildFamily({
        persons: [{ id: 'p_m' }, { id: 'p_f' }, { id: 'p_r' }, { id: 'p_p' }, { id: 'p_q' }],
        parentChild: [
          ['p_m', 'p_r'],
          ['p_f', 'p_r'],
        ],
        unions: [
          ['p_m', 'p_f'],
          ['p_r', 'p_p'],
          ['p_p', 'p_q'],
        ],
      }),
    )
    const [r, p, q] = ['p_r', 'p_p', 'p_q'].map((id) => placement.personX.get(`person:${id}`)!) as [
      number,
      number,
      number,
    ]
    expect(Math.abs(p - r - 240)).toBeLessThanOrEqual(0.01)
    expect(Math.abs(q - p - 240)).toBeLessThanOrEqual(0.01)
    expectUnion(placement, 'union:u_2', (r + p) / 2)
    expectUnion(placement, 'union:u_3', (p + q) / 2)
  })
})
