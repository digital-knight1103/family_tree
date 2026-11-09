// @vitest-environment node
import { describe, expect, it } from 'vitest'
import seed from '@seed/demo-family.json'
import { genDateSortKey } from '@/domain/dates'
import { familyDataSchema, type FamilyData } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { centerX, countCrossings, segments } from '@tests/fixtures/layout-metrics'
import { buildTreeGraph } from './graph'
import { layoutTree, type PositionedNode, type TreeLayout } from './layout'

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

  it('osoba niepołączona jest obok i nie nachodzi na resztę', async () => {
    const data: FamilyData = {
      ...demo,
      persons: [
        ...demo.persons,
        { id: 'p_samotna', givenNames: 'Samotna', surname: 'Osoba', sex: 'female', living: true },
      ],
    }
    const result = await layout(data)
    const lone = result.nodes.find((n) => n.id === 'person:p_samotna')
    expect(lone).toBeDefined()
    for (const node of result.nodes) {
      if (node.id === lone!.id) continue
      expect(overlaps(lone!, node), `nachodzi na ${nameOf(data, node.id)}`).toBe(false)
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
