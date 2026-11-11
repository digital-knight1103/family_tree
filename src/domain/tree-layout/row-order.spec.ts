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

  it('stawia osobę z rodziny po lewej, a partnera bez rodziców po prawej (rodzeństwo z partnerami)', () => {
    const graph = buildTreeGraph(
      buildFamily({
        persons: [
          { id: 'p_ojciec' },
          { id: 'p_matka' },
          { id: 'p_a', birth: { date: { year: 1980 } } },
          { id: 'p_b', birth: { date: { year: 1983 } } },
          { id: 'p_x', birth: { date: { year: 1979 } } },
          { id: 'p_y', birth: { date: { year: 1984 } } },
        ],
        parentChild: [
          ['p_ojciec', 'p_a'],
          ['p_matka', 'p_a'],
          ['p_ojciec', 'p_b'],
          ['p_matka', 'p_b'],
        ],
        unions: [
          ['p_ojciec', 'p_matka'],
          ['p_a', 'p_x'],
          ['p_b', 'p_y'],
        ],
      }),
    )
    expect(personRow(graph, 1)).toEqual(['a', 'x', 'b', 'y'])
  })

  it('stawia po lewej tego z pary, kto ma rodziców, niezależnie od płci i wieku', () => {
    const graph = buildTreeGraph(
      buildFamily({
        persons: [
          { id: 'p_dziadek' },
          { id: 'p_babcia' },
          { id: 'p_corka', sex: 'female', birth: { date: { year: 1960 } } },
          { id: 'p_syn', sex: 'male', birth: { date: { year: 1962 } } },
          { id: 'p_ziec', sex: 'male', birth: { date: { year: 1950 } } },
          { id: 'p_synowa', sex: 'female', birth: { date: { year: 1951 } } },
        ],
        parentChild: [
          ['p_dziadek', 'p_corka'],
          ['p_babcia', 'p_corka'],
          ['p_dziadek', 'p_syn'],
          ['p_babcia', 'p_syn'],
        ],
        unions: [
          ['p_dziadek', 'p_babcia'],
          ['p_ziec', 'p_corka'],
          ['p_synowa', 'p_syn'],
        ],
      }),
    )
    expect(personRow(graph, 1)).toEqual(['corka', 'ziec', 'syn', 'synowa'])
  })

  it('stawia wszystkich partnerów osoby z rodziny po jej prawej, w kolejności związków', () => {
    const data = buildFamily({
      persons: [
        { id: 'p_ojciec' },
        { id: 'p_matka' },
        { id: 'p_a', birth: { date: { year: 1950 } } },
        { id: 'p_pierwsza', birth: { date: { year: 1955 } } },
        { id: 'p_druga', birth: { date: { year: 1945 } } },
        { id: 'p_dziecko', birth: { date: { year: 1975 } } },
      ],
      parentChild: [
        ['p_ojciec', 'p_a'],
        ['p_matka', 'p_a'],
        ['p_a', 'p_dziecko'],
        ['p_druga', 'p_dziecko'],
      ],
      unions: [
        ['p_ojciec', 'p_matka'],
        ['p_druga', 'p_a'],
        ['p_a', 'p_pierwsza'],
      ],
    })
    data.unions[1]!.start = { date: { year: 1980 } }
    data.unions[2]!.start = { date: { year: 1972 } }
    expect(personRow(buildTreeGraph(data), 1)).toEqual(['a', 'pierwsza', 'druga'])
    // Without union dates the partners follow their birth order.
    for (const union of data.unions) delete union.start
    expect(personRow(buildTreeGraph(data), 1)).toEqual(['a', 'druga', 'pierwsza'])
  })

  it('partner partnera stoi na zewnątrz pary, nie między partnerami', () => {
    const graph = buildTreeGraph(
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
    expect(personRow(graph, 1)).toEqual(['r', 'p', 'q'])
  })

  it('partner partnera z rodzicami w drzewie nie staje między partnerami', () => {
    const data = buildFamily({
      persons: [
        { id: 'p_m' },
        { id: 'p_f' },
        { id: 'p_g1' },
        { id: 'p_g2' },
        { id: 'p_r' },
        { id: 'p_p' },
        { id: 'p_s' },
      ],
      parentChild: [
        ['p_m', 'p_r'],
        ['p_f', 'p_r'],
        ['p_g1', 'p_s'],
        ['p_g2', 'p_s'],
      ],
      unions: [
        ['p_m', 'p_f'],
        ['p_g1', 'p_g2'],
        ['p_r', 'p_p'],
        ['p_p', 'p_s'],
      ],
    })
    const row = personRow(buildTreeGraph(data), 1)
    expect(Math.abs(row.indexOf('r') - row.indexOf('p'))).toBe(1)
    expect(Math.abs(row.indexOf('p') - row.indexOf('s'))).toBe(1)
    const reversed = {
      ...data,
      persons: [...data.persons].reverse(),
      parentChild: [...data.parentChild].reverse(),
      unions: [...data.unions].reverse(),
    }
    expect(personRow(buildTreeGraph(reversed), 1)).toEqual(row)
  })

  it('kolejność nie zależy od kolejności danych wejściowych', () => {
    const data = familyDataSchema.parse(seed)
    const reversed = {
      ...data,
      persons: [...data.persons].reverse(),
      parentChild: [...data.parentChild].reverse(),
      unions: [...data.unions].reverse(),
    }
    const ids = (d: typeof data) => orderNodes(buildTreeGraph(d)).map((n) => n.id)
    expect(ids(reversed)).toEqual(ids(data))
  })
})
