import { describe, expect, it } from 'vitest'
import seed from '@seed/demo-family.json'
import { familyDataSchema, type FamilyData } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { leftChild, rightChild, twoFamilies } from '@tests/fixtures/two-families'
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

describe('orderNodes (bloki rodzeństwa, §6.4 reguły twarde 1 i 2)', () => {
  const a = (i: number) => leftChild(i).slice('p_'.length)
  const b = (i: number) => rightChild(i).slice('p_'.length)
  const reversedInput = (data: FamilyData): FamilyData => ({
    ...data,
    persons: [...data.persons].reverse(),
    parentChild: [...data.parentChild].reverse(),
    unions: [...data.unions].reverse(),
  })

  it('para z dwóch rodzin stoi na styku ciągłych bloków, reszta w kolejności urodzenia', () => {
    expect(personRow(buildTreeGraph(twoFamilies()), 1)).toEqual([
      a(0),
      a(2),
      a(3),
      a(1),
      b(0),
      b(1),
      b(2),
    ])
  })

  it('para mosta w środku obu rodzin przesuwa się na styk, kierunek łamie najmniej kolejności urodzenia', () => {
    // A on the left would put a2 after a3, a4 and b2 before b1 (3 pairs against birth order);
    // B on the left only b2 after b3 and a2 before a1 (2 pairs).
    const graph = buildTreeGraph(twoFamilies({ bridge: { left: 1, right: 1 } }))
    expect(personRow(graph, 1)).toEqual([b(0), b(2), b(1), a(1), a(0), a(2), a(3)])
  })

  it('najstarsze dziecko w parze mosta: jego rodzina staje po prawej, kolejność urodzenia zostaje', () => {
    const graph = buildTreeGraph(
      twoFamilies({ leftChildren: 3, rightChildren: 1, bridge: { left: 0, right: 0 } }),
    )
    expect(personRow(graph, 1)).toEqual([b(0), a(0), a(1), a(2)])
  })

  it('para mosta już na skrajach zostaje na miejscu, rodzeństwo w kolejności urodzenia', () => {
    const graph = buildTreeGraph(twoFamilies({ bridge: { left: 3, right: 0 } }))
    expect(personRow(graph, 1)).toEqual([a(0), a(1), a(2), a(3), b(0), b(1), b(2)])
  })

  it('kolejność bloków nie zależy od kolejności danych wejściowych', () => {
    const data = twoFamilies({ bridge: { left: 2, right: 1 }, bridgeChildren: 2 })
    const ids = (d: FamilyData) => orderNodes(buildTreeGraph(d)).map((n) => n.id)
    expect(ids(reversedInput(data))).toEqual(ids(data))
  })

  it('osoba z partnerami z dwóch innych rodzin: obie pary obok niej, reguła deterministyczna', () => {
    // r2 (family R) has partners p1 (family P) and s3 (family S); each family has three children.
    // One row cannot keep all three blocks whole: the family with the earliest-born parents (P)
    // and R keep theirs, s3 stands next to r2, away from its siblings.
    const families = { p: 1919, r: 1920, s: 1921 }
    const persons = Object.entries(families).flatMap(([family, year]) => [
      { id: `p_${family}_ojciec`, birth: { date: { year } } },
      { id: `p_${family}_matka`, birth: { date: { year } } },
      ...[0, 1, 2].map((i) => ({ id: `p_${family}${i + 1}`, birth: { date: { year: 1950 + i } } })),
    ])
    const parentChild = Object.keys(families).flatMap((family) =>
      [1, 2, 3].flatMap((i): Array<[string, string]> => [
        [`p_${family}_ojciec`, `p_${family}${i}`],
        [`p_${family}_matka`, `p_${family}${i}`],
      ]),
    )
    const data = buildFamily({
      persons,
      parentChild,
      unions: [
        ['p_p_ojciec', 'p_p_matka'],
        ['p_r_ojciec', 'p_r_matka'],
        ['p_s_ojciec', 'p_s_matka'],
        ['p_r2', 'p_p1'],
        ['p_r2', 'p_s3'],
      ],
    })
    const row = personRow(buildTreeGraph(data), 1)
    const partnersOf: Record<string, string[]> = { r2: ['p1', 's3'], p1: ['r2'], s3: ['r2'] }
    /** Rule 1: between the outermost siblings stand only siblings and their partners. */
    const whole = (family: string) => {
      const at = row.flatMap((id, i) => (id.startsWith(family) ? [i] : []))
      return row
        .slice(at[0], at[at.length - 1]! + 1)
        .every(
          (id) =>
            id.startsWith(family) ||
            row.some((sibling) => sibling.startsWith(family) && partnersOf[sibling]?.includes(id)),
        )
    }
    expect(Math.abs(row.indexOf('r2') - row.indexOf('p1'))).toBe(1)
    expect(Math.abs(row.indexOf('r2') - row.indexOf('s3'))).toBe(1)
    expect([whole('p'), whole('r'), whole('s')]).toEqual([true, true, false])
    expect(personRow(buildTreeGraph(reversedInput(data)), 1)).toEqual(row)
  })
})
