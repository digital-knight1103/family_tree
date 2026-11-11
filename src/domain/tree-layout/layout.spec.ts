// @vitest-environment node
import { describe, expect, it } from 'vitest'
import seed from '@seed/demo-family.json'
import { genDateSortKey } from '@/domain/dates'
import { familyDataSchema, type FamilyData } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { buildLargeFamily } from '@tests/fixtures/large-family'
import { centerX, countCrossings, segments } from '@tests/fixtures/layout-metrics'
import { buildTreeGraph, type TreeGraph } from './graph'
import { layoutTree, PERSON_NODE, type PositionedNode, type TreeLayout } from './layout'

const demo = familyDataSchema.parse(seed)
const layout = (data: FamilyData) => layoutTree(buildTreeGraph(data))
const nameOf = (data: FamilyData, nodeId: string) => {
  const person = data.persons.find((p) => `person:${p.id}` === nodeId)
  return person ? `${person.givenNames} ${person.surname} (${person.id})` : nodeId
}
const byId = (result: TreeLayout) => new Map(result.nodes.map((n) => [n.id, n]))
const overlaps = (a: PositionedNode, b: PositionedNode) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('layoutTree (dane demo, właściwości §6.4)', () => {
  it('pokolenia leżą w poziomych rzędach, przodkowie wyżej', async () => {
    const graph = buildTreeGraph(demo)
    const result = await layoutTree(graph)
    const nodes = byId(result)
    const rowY = new Map<number, number>()
    for (const node of graph.nodes) {
      if (node.kind !== 'person') continue
      const y = nodes.get(node.id)!.y
      const expected = rowY.get(node.generation) ?? y
      rowY.set(node.generation, expected)
      expect(y, `${nameOf(demo, node.id)}: y w pokoleniu ${node.generation}`).toBe(expected)
    }
    const generations = [...rowY.keys()].sort((a, b) => a - b)
    for (let i = 1; i < generations.length; i++) {
      const g = generations[i]!
      expect(rowY.get(g)!, `rząd pokolenia ${g} pod rzędem ${generations[i - 1]}`).toBeGreaterThan(
        rowY.get(generations[i - 1]!)!,
      )
    }
  })

  it('partnerzy stoją obok siebie', async () => {
    const graph = buildTreeGraph(demo)
    const nodes = byId(await layoutTree(graph))
    for (const union of graph.nodes) {
      if (union.kind !== 'union') continue
      const [a, b] = union.partnerIds.map((id) => nodes.get(`person:${id}`)!)
      const [left, right] = a!.x < b!.x ? [a!, b!] : [b!, a!]
      const between = graph.nodes
        .filter((n) => n.kind === 'person' && n.generation === union.generation)
        .map((n) => nodes.get(n.id)!)
        .filter((n) => n.y === left.y && n.x > left.x && n.x < right.x)
        .map((n) => nameOf(demo, n.id))
      expect(between, `między partnerami ${union.partnerIds.join(' i ')}`).toEqual([])
    }
  })

  it('linia do dzieci wychodzi ze środka pary', async () => {
    const graph = buildTreeGraph(demo)
    const result = await layoutTree(graph)
    const nodes = byId(result)
    for (const union of graph.nodes) {
      if (union.kind !== 'union') continue
      const u = nodes.get(union.id)!
      const [a, b] = union.partnerIds.map((id) => nodes.get(`person:${id}`)!)
      const label = `węzeł ${union.id} (${union.partnerIds.join(' i ')})`
      expect(centerX(u), `${label}: środek nie leży między partnerami`).toBeGreaterThanOrEqual(
        Math.min(centerX(a!), centerX(b!)) - 1,
      )
      expect(centerX(u), `${label}: środek nie leży między partnerami`).toBeLessThanOrEqual(
        Math.max(centerX(a!), centerX(b!)) + 1,
      )
      expect(u.y, `${label}: nie leży pod partnerami`).toBeGreaterThanOrEqual(
        Math.max(a!.y + a!.height, b!.y + b!.height),
      )
      for (const edge of result.edges) {
        if (edge.kind !== 'child' || edge.source !== union.id) continue
        const start = edge.points[0]!
        const inside =
          start.x >= u.x - 0.5 &&
          start.x <= u.x + u.width + 0.5 &&
          start.y >= u.y - 0.5 &&
          start.y <= u.y + u.height + 0.5
        expect(inside, `${edge.id}: nie zaczyna się w węźle związku`).toBe(true)
      }
    }
  })

  it('połączenia są ortogonalne', async () => {
    const result = await layout(demo)
    for (const edge of result.edges) {
      for (const [p, q] of segments(edge)) {
        const orthogonal = Math.abs(p.x - q.x) <= 0.5 || Math.abs(p.y - q.y) <= 0.5
        expect(orthogonal, `${edge.id}: odcinek ukośny ${JSON.stringify([p, q])}`).toBe(true)
      }
    }
  })

  it('na danych demo linie się nie przecinają', async () => {
    const result = await layout(demo)
    expect(countCrossings(result.edges)).toBe(0)
  })

  it('rodzeństwo jest w kolejności urodzenia', async () => {
    const graph = buildTreeGraph(demo)
    const result = await layoutTree(graph)
    const nodes = byId(result)
    const birthKey = (nodeId: string) =>
      genDateSortKey(demo.persons.find((p) => `person:${p.id}` === nodeId)?.birth?.date)
    for (const union of graph.nodes) {
      if (union.kind !== 'union') continue
      const children = result.edges
        .filter((e) => e.kind === 'child' && e.source === union.id)
        .map((e) => e.target)
        .sort((a, b) => nodes.get(a)!.x - nodes.get(b)!.x)
      for (let i = 1; i < children.length; i++) {
        expect(
          birthKey(children[i]!),
          `${nameOf(demo, children[i]!)} stoi na prawo od starszego ${nameOf(demo, children[i - 1]!)}`,
        ).toBeGreaterThanOrEqual(birthKey(children[i - 1]!))
      }
    }
  })

  it('układ jest deterministyczny', async () => {
    const reversed: FamilyData = {
      ...demo,
      persons: [...demo.persons].reverse(),
      parentChild: [...demo.parentChild].reverse(),
      unions: [...demo.unions].reverse(),
    }
    const first = await layout(demo)
    expect(await layout(demo)).toEqual(first)
    expect(await layout(reversed)).toEqual(first)
  })

  it('osobne grupy i osoba niepołączona stoją obok drzewa, w tych samych rzędach', async () => {
    const stranger = (id: string, birth: number) => ({
      id,
      givenNames: id,
      surname: 'Obcy',
      sex: 'unknown' as const,
      living: false,
      birth: { date: { year: birth } },
    })
    const data: FamilyData = {
      ...demo,
      persons: [
        ...demo.persons,
        stranger('p_obcy_ojciec', 1900),
        stranger('p_obca_matka', 1902),
        stranger('p_obce_dziecko', 1930),
        stranger('p_samotna', 1950),
      ],
      parentChild: [
        ...demo.parentChild,
        { parentId: 'p_obcy_ojciec', childId: 'p_obce_dziecko', type: 'biological' },
        { parentId: 'p_obca_matka', childId: 'p_obce_dziecko', type: 'biological' },
      ],
      unions: [
        ...demo.unions,
        { id: 'u_obcy', partnerIds: ['p_obcy_ojciec', 'p_obca_matka'], type: 'marriage' },
      ],
    }
    const graph = buildTreeGraph(data)
    const result = await layoutTree(graph)
    const nodes = byId(result)
    const groupOf = (ids: string[]) => ids.map((id) => nodes.get(`person:${id}`)!)
    const main = groupOf(demo.persons.map((p) => p.id))
    const other = groupOf(['p_obcy_ojciec', 'p_obca_matka', 'p_obce_dziecko'])
    const lone = groupOf(['p_samotna'])
    const range = (group: PositionedNode[]) => [
      Math.min(...group.map((n) => n.x)),
      Math.max(...group.map((n) => n.x + n.width)),
    ]
    const disjoint = (a: PositionedNode[], b: PositionedNode[]) => {
      const [a0, a1] = range(a)
      const [b0, b1] = range(b)
      return a1! <= b0! || b1! <= a0!
    }
    expect(disjoint(main, other), 'osobna rodzina nachodzi w poziomie na drzewo').toBe(true)
    expect(disjoint(main, lone), 'osoba samotna nachodzi w poziomie na drzewo').toBe(true)
    expect(disjoint(other, lone), 'osoba samotna nachodzi na osobną rodzinę').toBe(true)

    const generationOf = new Map(graph.nodes.map((n) => [n.id, n.generation]))
    const rowY = (generation: number) => main.find((n) => generationOf.get(n.id) === generation)!.y
    for (const node of [...other, ...lone]) {
      expect(node.y, `${nameOf(data, node.id)}: rząd pokolenia`).toBe(
        rowY(generationOf.get(node.id)!),
      )
    }
    for (const node of result.nodes) {
      for (const otherNode of result.nodes) {
        if (node.id < otherNode.id) {
          expect(overlaps(node, otherNode), `${node.id} nachodzi na ${otherNode.id}`).toBe(false)
        }
      }
    }
  })

  it('dzieci drugiego związku wiszą pod właściwą parą', async () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_x' }, { id: 'p_c' }, { id: 'p_d' }],
      parentChild: [
        ['p_a', 'p_c'],
        ['p_b', 'p_c'],
        ['p_a', 'p_d'],
        ['p_x', 'p_d'],
      ],
      unions: [
        ['p_a', 'p_b'],
        ['p_a', 'p_x'],
      ],
    })
    const nodes = byId(await layout(data))
    for (const [unionId, partners] of [
      ['union:u_1', ['p_a', 'p_b']],
      ['union:u_2', ['p_a', 'p_x']],
    ] as const) {
      const u = centerX(nodes.get(unionId)!)
      const [a, b] = partners.map((id) => centerX(nodes.get(`person:${id}`)!))
      expect(u, `${unionId} nie leży między ${partners.join(' i ')}`).toBeGreaterThanOrEqual(
        Math.min(a!, b!) - 1,
      )
      expect(u, `${unionId} nie leży między ${partners.join(' i ')}`).toBeLessThanOrEqual(
        Math.max(a!, b!) + 1,
      )
    }
  })
})

describe('layoutTree (zmiany danych i wydajność)', () => {
  const rowOrder = async (data: FamilyData, generations: number[]) => {
    const graph = buildTreeGraph(data)
    const nodes = byId(await layoutTree(graph))
    return generations.map((generation) =>
      graph.nodes
        .filter((n) => n.kind === 'person' && n.generation === generation)
        .map((n) => n.id)
        .sort((a, b) => nodes.get(a)!.x - nodes.get(b)!.x),
    )
  }

  it('dodanie dziecka nie przestawia starszych pokoleń', async () => {
    const data: FamilyData = {
      ...demo,
      persons: [
        ...demo.persons,
        {
          id: 'p_nowe_dziecko',
          givenNames: 'Nowe',
          surname: 'Kowalczyk',
          sex: 'male',
          birth: { date: { year: 2012 } },
          living: true,
        },
      ],
      parentChild: [
        ...demo.parentChild,
        { parentId: 'p_piotr_kowalczyk', childId: 'p_nowe_dziecko', type: 'biological' },
        { parentId: 'p_katarzyna_kowalczyk', childId: 'p_nowe_dziecko', type: 'biological' },
      ],
    }
    expect(await rowOrder(data, [0, 1, 2])).toEqual(await rowOrder(demo, [0, 1, 2]))
  })

  it('układa ~300 osób w mniej niż 3 s', { timeout: 20_000 }, async () => {
    const large = buildLargeFamily()
    expect(large.persons.length).toBeGreaterThanOrEqual(280)
    expect(large.persons.length).toBeLessThanOrEqual(330)
    await layout(demo)
    const start = performance.now()
    const result = await layout(large)
    const elapsed = performance.now() - start
    expect(result.nodes.filter((n) => n.kind === 'person')).toHaveLength(large.persons.length)
    expect(elapsed, `układ ${large.persons.length} osób: ${Math.round(elapsed)} ms`).toBeLessThan(
      3000,
    )
  })
})

describe('layoutTree (rodzice nad środkiem dzieci, szerokość węzła)', () => {
  /** Siblings Paweł and Sławomir with partners without parents; Sławomir's sons below. */
  const siblings = buildFamily({
    persons: [
      { id: 'p_andrzej', birth: { date: { year: 1950 } } },
      { id: 'p_halina', birth: { date: { year: 1952 } } },
      { id: 'p_pawel', birth: { date: { year: 1975 } } },
      { id: 'p_slawomir', birth: { date: { year: 1978 } } },
      { id: 'p_aneta', birth: { date: { year: 1976 } } },
      { id: 'p_patrycja', birth: { date: { year: 1980 } } },
      { id: 'p_antoni', birth: { date: { year: 2005 } } },
      { id: 'p_aleksander', birth: { date: { year: 2008 } } },
    ],
    parentChild: [
      ['p_andrzej', 'p_pawel'],
      ['p_halina', 'p_pawel'],
      ['p_andrzej', 'p_slawomir'],
      ['p_halina', 'p_slawomir'],
      ['p_slawomir', 'p_antoni'],
      ['p_patrycja', 'p_antoni'],
      ['p_slawomir', 'p_aleksander'],
      ['p_patrycja', 'p_aleksander'],
    ],
    unions: [
      ['p_andrzej', 'p_halina'],
      ['p_pawel', 'p_aneta'],
      ['p_slawomir', 'p_patrycja'],
    ],
  })
  const center = (nodes: Map<string, PositionedNode>, id: string) => centerX(nodes.get(id)!)
  const middle = (nodes: Map<string, PositionedNode>, a: string, b: string) =>
    (center(nodes, `person:${a}`) + center(nodes, `person:${b}`)) / 2
  /** No node overlaps another, no line runs through a person and every line is orthogonal. */
  const noOverlaps = (result: TreeLayout) => {
    for (const a of result.nodes) {
      for (const b of result.nodes) {
        if (a.id < b.id) expect(overlaps(a, b), `${a.id} nachodzi na ${b.id}`).toBe(false)
      }
    }
    const people = result.nodes.filter((n) => n.kind === 'person')
    for (const edge of result.edges) {
      for (const [p, q] of segments(edge)) {
        expect(Math.abs(p.x - q.x) <= 0.5 || Math.abs(p.y - q.y) <= 0.5, edge.id).toBe(true)
        for (const n of people) {
          const through =
            Math.max(p.x, q.x) > n.x + 0.5 &&
            Math.min(p.x, q.x) < n.x + n.width - 0.5 &&
            Math.max(p.y, q.y) > n.y + 0.5 &&
            Math.min(p.y, q.y) < n.y + n.height - 0.5
          expect(through, `${edge.id} przechodzi przez ${n.id}`).toBe(false)
        }
      }
    }
  }
  const wide = (personId: string) => 200 + (personId.length % 4) * 70

  it('punkt związku rodziców stoi nad środkiem rodzeństwa, a nie ich partnerów', async () => {
    for (const options of [undefined, { personWidth: wide }]) {
      const result = await layoutTree(buildTreeGraph(siblings), options)
      const nodes = byId(result)
      const row = ['pawel', 'aneta', 'slawomir', 'patrycja'].map((id) =>
        nodes.get(`person:p_${id}`)!,
      )
      for (let i = 1; i < row.length; i++) expect(row[i]!.x).toBeGreaterThan(row[i - 1]!.x)
      expect(
        Math.abs(center(nodes, 'union:u_1') - middle(nodes, 'p_pawel', 'p_slawomir')),
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(center(nodes, 'union:u_3') - middle(nodes, 'p_antoni', 'p_aleksander')),
      ).toBeLessThanOrEqual(1)
      noOverlaps(result)
    }
  })

  it('para z dwójką dzieci ma punkt związku między dziećmi', async () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }, { id: 'p_d' }],
      parentChild: [
        ['p_a', 'p_c'],
        ['p_b', 'p_c'],
        ['p_a', 'p_d'],
        ['p_b', 'p_d'],
      ],
      unions: [['p_a', 'p_b']],
    })
    const nodes = byId(await layout(data))
    expect(Math.abs(center(nodes, 'union:u_1') - middle(nodes, 'p_c', 'p_d'))).toBeLessThanOrEqual(
      1,
    )
  })

  it('samotny rodzic stoi nad środkiem swoich dzieci', async () => {
    const data = buildFamily({
      persons: [
        { id: 'p_matka' },
        { id: 'p_c1', birth: { date: { year: 1990 } } },
        { id: 'p_c2', birth: { date: { year: 1991 } } },
        { id: 'p_c3', birth: { date: { year: 1992 } } },
      ],
      parentChild: [
        ['p_matka', 'p_c1'],
        ['p_matka', 'p_c2'],
        ['p_matka', 'p_c3'],
      ],
    })
    const result = await layout(data)
    const nodes = byId(result)
    expect(
      Math.abs(center(nodes, 'person:p_matka') - middle(nodes, 'p_c1', 'p_c3')),
    ).toBeLessThanOrEqual(1)
    const matka = nodes.get('person:p_matka')!
    const toMiddle = result.edges.find((e) => e.target === 'person:p_c2')!
    // Straight down from the parent to the middle child.
    expect(toMiddle.points.map((p) => p.y)).toEqual([
      matka.y + matka.height,
      nodes.get('person:p_c2')!.y,
    ])
    for (const p of toMiddle.points) {
      expect(Math.abs(p.x - centerX(matka))).toBeLessThanOrEqual(0.5)
    }
    noOverlaps(result)
  })

  it('linia do dziecka o dwa rzędy niżej omija osoby po drodze', async () => {
    // The aunt marries her nephew, so she stands a row below her parents.
    const data = buildFamily({
      persons: [
        { id: 'p_p' },
        { id: 'p_q' },
        { id: 'p_a', birth: { date: { year: 1950 } } },
        { id: 'p_z', birth: { date: { year: 1952 } } },
        { id: 'p_s', birth: { date: { year: 1960 } } },
        { id: 'p_w' },
        { id: 'p_k', birth: { date: { year: 1975 } } },
      ],
      parentChild: [
        ['p_p', 'p_a'],
        ['p_q', 'p_a'],
        ['p_p', 'p_z'],
        ['p_q', 'p_z'],
        ['p_p', 'p_s'],
        ['p_q', 'p_s'],
        ['p_a', 'p_k'],
        ['p_w', 'p_k'],
      ],
      unions: [
        ['p_p', 'p_q'],
        ['p_a', 'p_w'],
        ['p_s', 'p_k'],
      ],
    })
    const graph = buildTreeGraph(data)
    const generation = (id: string) => graph.nodes.find((n) => n.id === id)!.generation
    expect(generation('person:p_s') - generation('union:u_1')).toBe(2)
    const result = await layoutTree(graph)
    noOverlaps(result)
    const start = result.edges.find((e) => e.target === 'person:p_s')!.points[0]!
    expect(Math.abs(start.x - centerX(byId(result).get('union:u_1')!))).toBeLessThanOrEqual(0.5)
  })

  it('gdy obie strony pary mają rodziców, rozkłada odchylenie po równo bez nakładania', async () => {
    // Two only children marry: their parents need more room than the couple, so neither pair of
    // parents can stand right above its child.
    const data = buildFamily({
      persons: [
        { id: 'p_f1' },
        { id: 'p_f2' },
        { id: 'p_g1' },
        { id: 'p_g2' },
        { id: 'p_c', birth: { date: { year: 1980 } } },
        { id: 'p_d', birth: { date: { year: 1981 } } },
      ],
      parentChild: [
        ['p_f1', 'p_c'],
        ['p_f2', 'p_c'],
        ['p_g1', 'p_d'],
        ['p_g2', 'p_d'],
      ],
      unions: [
        ['p_f1', 'p_f2'],
        ['p_g1', 'p_g2'],
        ['p_c', 'p_d'],
      ],
    })
    const result = await layout(data)
    const nodes = byId(result)
    const deviationF = Math.abs(center(nodes, 'union:u_1') - center(nodes, 'person:p_c'))
    const deviationG = Math.abs(center(nodes, 'union:u_2') - center(nodes, 'person:p_d'))
    // Union to union the pairs of parents stand at least 544 px apart (half a pair (200 + 40) / 2,
    // then 200 + 104 to the other pair, then its half), the couple 240 px (200 + 40): the excess
    // 304 px is split, 152 px each (the partner gap cancels out, so the numbers stay as with 104).
    expect(Math.abs(deviationF - 152)).toBeLessThanOrEqual(1)
    expect(Math.abs(deviationG - 152)).toBeLessThanOrEqual(1)
    noOverlaps(result)
  })

  it('osoba z dwoma partnerami: punkty obu związków między partnerami, linie ortogonalne', async () => {
    const data = buildFamily({
      persons: [
        { id: 'p_ojciec' },
        { id: 'p_matka' },
        { id: 'p_a', birth: { date: { year: 1950 } } },
        { id: 'p_x', birth: { date: { year: 1951 } } },
        { id: 'p_y', birth: { date: { year: 1952 } } },
        { id: 'p_cx', birth: { date: { year: 1975 } } },
        { id: 'p_cy', birth: { date: { year: 1985 } } },
      ],
      parentChild: [
        ['p_ojciec', 'p_a'],
        ['p_matka', 'p_a'],
        ['p_a', 'p_cx'],
        ['p_x', 'p_cx'],
        ['p_a', 'p_cy'],
        ['p_y', 'p_cy'],
      ],
      unions: [
        ['p_ojciec', 'p_matka'],
        ['p_a', 'p_x'],
        ['p_a', 'p_y'],
      ],
    })
    const result = await layout(data)
    const nodes = byId(result)
    // The union points stand 272 px apart (40 / 2 + 200 + 104 / 2), the half-siblings below at
    // least 304 px (200 + 104): each union point is 16 px off the middle of its child.
    for (const [unionId, partner, child] of [
      ['union:u_2', 'p_x', 'p_cx'],
      ['union:u_3', 'p_y', 'p_cy'],
    ] as const) {
      const u = nodes.get(unionId)!
      expect(centerX(u)).toBeGreaterThan(center(nodes, 'person:p_a'))
      expect(centerX(u)).toBeLessThan(center(nodes, `person:${partner}`))
      const deviation = Math.abs(centerX(u) - center(nodes, `person:${child}`))
      expect(Math.abs(deviation - 16)).toBeLessThanOrEqual(1)
      const start = result.edges.find((e) => e.source === unionId)!.points[0]!
      expect(Math.abs(start.x - centerX(u))).toBeLessThanOrEqual(0.5)
      expect(Math.abs(start.y - (u.y + u.height))).toBeLessThanOrEqual(0.5)
    }
    // The line to the second partner runs below the first union.
    expect(nodes.get('union:u_3')!.y).toBeGreaterThan(nodes.get('union:u_2')!.y)
    // A and the first partner stand 40 px apart; the second union point sits in the gap between
    // the two partners, who are not partners of each other: that gap keeps 104 px.
    const [a, x, y] = ['p_a', 'p_x', 'p_y'].map((id) => nodes.get(`person:${id}`)!) as [
      PositionedNode,
      PositionedNode,
      PositionedNode,
    ]
    expect(Math.abs(x.x - (a.x + a.width) - 40)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(y.x - (x.x + x.width) - 104)).toBeLessThanOrEqual(0.5)
    const u3 = nodes.get('union:u_3')!
    expect(u3.x).toBeGreaterThan(x.x + x.width)
    expect(u3.x + u3.width).toBeLessThan(y.x)
    for (const edge of result.edges) {
      for (const [p, q] of segments(edge)) {
        expect(Math.abs(p.x - q.x) <= 0.5 || Math.abs(p.y - q.y) <= 0.5, edge.id).toBe(true)
      }
      if (edge.kind === 'partner') {
        const person = nodes.get(edge.source)!
        expect(Math.abs(edge.points[0]!.x - centerX(person))).toBeLessThanOrEqual(0.5)
        expect(edge.points[0]!.y).toBe(person.y + person.height)
      }
    }
    noOverlaps(result)
  })

  it('szerokość osoby pochodzi z personWidth, najmniej PERSON_NODE.width', async () => {
    const widths: Record<string, number> = { p_a: 320, p_b: 120, p_c: Number.NaN }
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }, { id: 'p_d' }],
      parentChild: [
        ['p_a', 'p_c'],
        ['p_b', 'p_c'],
      ],
      unions: [['p_a', 'p_b']],
    })
    const nodes = byId(
      await layoutTree(buildTreeGraph(data), { personWidth: (id) => widths[id] ?? 0 }),
    )
    expect(nodes.get('person:p_a')!.width).toBe(320)
    expect(nodes.get('person:p_b')!.width).toBe(PERSON_NODE.width)
    expect(nodes.get('person:p_c')!.width).toBe(PERSON_NODE.width)
    expect(nodes.get('person:p_d')!.width).toBe(PERSON_NODE.width)
    expect(nodes.get('person:p_a')!.height).toBe(PERSON_NODE.height)
    const plain = byId(await layout(data))
    for (const node of plain.values()) {
      if (node.kind === 'person') expect(node.width).toBe(PERSON_NODE.width)
    }
  })

  it('przy różnych szerokościach na danych demo węzły nie nachodzą na siebie, a układ jest deterministyczny', async () => {
    const options = { personWidth: wide }
    const result = await layoutTree(buildTreeGraph(demo), options)
    noOverlaps(result)
    expect(countCrossings(result.edges)).toBe(0)
    const reversed: FamilyData = {
      ...demo,
      persons: [...demo.persons].reverse(),
      parentChild: [...demo.parentChild].reverse(),
      unions: [...demo.unions].reverse(),
    }
    expect(await layoutTree(buildTreeGraph(reversed), options)).toEqual(result)
  })
})

describe('layoutTree (wysokość węzła i odstęp w rzędzie)', () => {
  const people = (result: TreeLayout) => result.nodes.filter((n) => n.kind === 'person')
  const rowsOf = (graph: TreeGraph, result: TreeLayout) => {
    const generationOf = new Map(graph.nodes.map((n) => [n.id, n.generation]))
    const rows = new Map<number, PositionedNode[]>()
    for (const n of people(result)) {
      const generation = generationOf.get(n.id)!
      rows.set(generation, [...(rows.get(generation) ?? []), n])
    }
    return rows
  }
  /** The shared checks, plus rows that read as rows and lines that meet the nodes' edges. */
  const invariants = (graph: TreeGraph, result: TreeLayout) => {
    const nodes = byId(result)
    const generationOf = new Map(graph.nodes.map((n) => [n.id, n.generation]))
    for (const a of result.nodes) {
      for (const b of result.nodes) {
        if (a.id < b.id) expect(overlaps(a, b), `${a.id} nachodzi na ${b.id}`).toBe(false)
      }
    }
    const rows = rowsOf(graph, result)
    const generations = [...rows.keys()].sort((a, b) => a - b)
    for (const [i, generation] of generations.entries()) {
      const row = rows.get(generation)!
      for (const n of row) expect(n.y, `${n.id}: góra rzędu`).toBe(row[0]!.y)
      const next = rows.get(generations[i + 1]!)
      if (next) {
        const bottom = Math.max(...row.map((n) => n.y + n.height))
        expect(next[0]!.y, `rząd ${generation + 1} pod rzędem ${generation}`).toBeGreaterThan(
          bottom,
        )
      }
    }
    for (const edge of result.edges) {
      const source = nodes.get(edge.source)!
      const target = nodes.get(edge.target)!
      const first = edge.points[0]!
      const last = edge.points[edge.points.length - 1]!
      expect(Math.abs(first.x - centerX(source)), `${edge.id}: start x`).toBeLessThanOrEqual(0.5)
      expect(Math.abs(first.y - (source.y + source.height)), `${edge.id}: start y`).toBeLessThan(
        0.5,
      )
      if (edge.kind === 'partner' && generationOf.get(source.id) === generationOf.get(target.id)) {
        expect(target.y, `${target.id} pod ${source.id}`).toBeGreaterThan(source.y + source.height)
      }
      if (edge.kind === 'child') {
        expect(Math.abs(last.y - target.y), `${edge.id}: koniec na górze dziecka`).toBeLessThan(0.5)
        expect(last.x, `${edge.id}: koniec nad dzieckiem`).toBeGreaterThan(target.x)
        expect(last.x, `${edge.id}: koniec nad dzieckiem`).toBeLessThan(target.x + target.width)
      }
      for (const [p, q] of segments(edge)) {
        expect(Math.abs(p.x - q.x) <= 0.5 || Math.abs(p.y - q.y) <= 0.5, edge.id).toBe(true)
        for (const n of people(result)) {
          const through =
            Math.max(p.x, q.x) > n.x + 0.5 &&
            Math.min(p.x, q.x) < n.x + n.width - 0.5 &&
            Math.max(p.y, q.y) > n.y + 0.5 &&
            Math.min(p.y, q.y) < n.y + n.height - 0.5
          expect(through, `${edge.id} przechodzi przez ${n.id}`).toBe(false)
        }
      }
    }
  }
  const wide = (personId: string) => 200 + (personId.length % 4) * 70
  const tall = (personId: string) => 72 + ((personId.length * 7) % 5) * 23
  /** Grandparents, two children with partners, grandchildren; heights mixed in every row. */
  const family = buildFamily({
    persons: [
      { id: 'p_dziadek' },
      { id: 'p_babcia' },
      { id: 'p_syn', birth: { date: { year: 1970 } } },
      { id: 'p_corka', birth: { date: { year: 1972 } } },
      { id: 'p_synowa' },
      { id: 'p_ziec' },
      { id: 'p_wnuk', birth: { date: { year: 2000 } } },
      { id: 'p_wnuczka', birth: { date: { year: 2002 } } },
      { id: 'p_wnuk2', birth: { date: { year: 2004 } } },
    ],
    parentChild: [
      ['p_dziadek', 'p_syn'],
      ['p_babcia', 'p_syn'],
      ['p_dziadek', 'p_corka'],
      ['p_babcia', 'p_corka'],
      ['p_syn', 'p_wnuk'],
      ['p_synowa', 'p_wnuk'],
      ['p_syn', 'p_wnuczka'],
      ['p_synowa', 'p_wnuczka'],
      ['p_corka', 'p_wnuk2'],
    ],
    unions: [
      ['p_dziadek', 'p_babcia'],
      ['p_syn', 'p_synowa'],
      ['p_corka', 'p_ziec'],
    ],
  })
  const heights: Record<string, number> = {
    p_dziadek: 72,
    p_babcia: 140,
    p_syn: 160,
    p_corka: 90,
    p_synowa: 72,
    p_ziec: 120,
    p_wnuk: 100,
    p_wnuczka: 72,
    p_wnuk2: 180,
  }

  it('wysokość osoby pochodzi z personHeight, najmniej PERSON_NODE.height', async () => {
    const given: Record<string, number> = {
      p_dziadek: 130,
      p_babcia: 40,
      p_syn: Number.NaN,
      p_corka: Number.POSITIVE_INFINITY,
    }
    const graph = buildTreeGraph(family)
    const nodes = byId(await layoutTree(graph, { personHeight: (id) => given[id] ?? 0 }))
    expect(nodes.get('person:p_dziadek')!.height).toBe(130)
    expect(nodes.get('person:p_babcia')!.height).toBe(PERSON_NODE.height)
    expect(nodes.get('person:p_syn')!.height).toBe(PERSON_NODE.height)
    expect(nodes.get('person:p_corka')!.height).toBe(PERSON_NODE.height)
    expect(nodes.get('person:p_ziec')!.height).toBe(PERSON_NODE.height)
    const plain = byId(await layoutTree(graph))
    for (const node of plain.values()) {
      if (node.kind === 'person') expect(node.height).toBe(PERSON_NODE.height)
    }
  })

  it('różne wysokości w rzędzie i między rzędami: rzędy się nie nakładają, linie od dołu do góry', async () => {
    const graph = buildTreeGraph(family)
    const result = await layoutTree(graph, { personHeight: (id) => heights[id] ?? 0 })
    invariants(graph, result)
    const nodes = byId(result)
    // The tallest node of a row pushes the next row down.
    expect(nodes.get('person:p_syn')!.y).toBeGreaterThan(nodes.get('person:p_babcia')!.y + 140)
    expect(nodes.get('person:p_wnuk')!.y).toBeGreaterThan(nodes.get('person:p_syn')!.y + 160)
    expect(result.height).toBeGreaterThan(nodes.get('person:p_wnuk2')!.y + 180)
  })

  it('partnerzy obok siebie stoją 40 px od siebie, pozostali sąsiedzi co najmniej 104 px', async () => {
    const graph = buildTreeGraph(family)
    const result = await layoutTree(graph, { personWidth: wide })
    const partners = new Set(
      family.unions.map((u) =>
        [...u.partnerIds]
          .map((id) => `person:${id}`)
          .sort()
          .join(' '),
      ),
    )
    let partnerGaps = 0
    let tightGaps = 0
    for (const row of rowsOf(graph, result).values()) {
      row.sort((a, b) => a.x - b.x)
      for (const [i, b] of row.entries()) {
        const a = row[i - 1]
        if (!a) continue
        const gap = b.x - (a.x + a.width)
        if (partners.has([a.id, b.id].sort().join(' '))) {
          expect(Math.abs(gap - 40), `${a.id} – ${b.id}`).toBeLessThanOrEqual(0.5)
          partnerGaps++
          continue
        }
        expect(gap, `${a.id} – ${b.id}`).toBeGreaterThanOrEqual(104 - 0.5)
        if (Math.abs(gap - 104) <= 0.5) tightGaps++
      }
    }
    expect(partnerGaps).toBe(3)
    // Siblings' blocks stand as close as allowed: syn + synowa, then córka + zięć.
    expect(tightGaps).toBeGreaterThan(0)
  })

  it(
    'wspólne niezmienniki na danych demo i dużej rodzinie przy różnych szerokościach i wysokościach',
    { timeout: 20_000 },
    async () => {
      for (const data of [demo, buildLargeFamily()]) {
        const graph = buildTreeGraph(data)
        const options = { personWidth: wide, personHeight: tall }
        const result = await layoutTree(graph, options)
        invariants(graph, result)
        expect(await layoutTree(graph, options)).toEqual(result)
      }
    },
  )
})
