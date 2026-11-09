import { describe, expect, it } from 'vitest'
import seed from '@seed/demo-family.json'
import { familyDataSchema } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { buildTreeGraph } from './graph'
import { orderNodes } from './row-order'

const personRow = (graph: ReturnType<typeof buildTreeGraph>, generation: number) =>
  orderNodes(graph)
    .filter((n) => n.kind === 'person' && n.generation === generation)
    .map((n) => n.id.slice('person:p_'.length))

describe('orderNodes', () => {
  it('zwraca każdy węzeł grafu dokładnie raz', () => {
    const graph = buildTreeGraph(familyDataSchema.parse(seed))
    const ids = orderNodes(graph).map((n) => n.id)
    expect([...ids].sort()).toEqual(graph.nodes.map((n) => n.id).sort())
  })

  it('stawia wżenionego partnera obok, a rodzeństwo w kolejności urodzenia', () => {
    const graph = buildTreeGraph(
      buildFamily({
        persons: [
          { id: 'p_ojciec' },
          { id: 'p_matka' },
          { id: 'p_starszy', birth: { date: { year: 1950 } } },
          { id: 'p_srodkowa', birth: { date: { year: 1952 } } },
          { id: 'p_mlodszy', birth: { date: { year: 1955 } } },
          { id: 'p_maz', birth: { date: { year: 1940 } } },
        ],
        parentChild: [
          ['p_ojciec', 'p_starszy'],
          ['p_matka', 'p_starszy'],
          ['p_ojciec', 'p_srodkowa'],
          ['p_matka', 'p_srodkowa'],
          ['p_ojciec', 'p_mlodszy'],
          ['p_matka', 'p_mlodszy'],
        ],
        unions: [
          ['p_ojciec', 'p_matka'],
          ['p_srodkowa', 'p_maz'],
        ],
      }),
    )
    const row = personRow(graph, 1)
    expect(row.filter((id) => id !== 'maz')).toEqual(['starszy', 'srodkowa', 'mlodszy'])
    expect(Math.abs(row.indexOf('maz') - row.indexOf('srodkowa'))).toBe(1)
  })
})
