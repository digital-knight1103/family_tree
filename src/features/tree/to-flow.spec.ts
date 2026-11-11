// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildTreeGraph, layoutTree } from '@/domain/tree-layout'
import { buildFamily } from '@tests/fixtures/build-family'
import { personNodeView } from './person-node-view'
import { toFlow } from './to-flow'

describe('toFlow', () => {
  it('przenosi pozycje i punkty tras do Vue Flow', async () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }],
      parentChild: [
        ['p_a', 'p_c'],
        ['p_b', 'p_c'],
      ],
      unions: [['p_a', 'p_b']],
    })
    const layout = await layoutTree(buildTreeGraph(data))
    const flow = toFlow(layout, data, (person) =>
      person.photo ? `/photos/${person.photo}` : undefined,
    )

    expect(flow.nodes).toHaveLength(layout.nodes.length)
    expect(flow.edges).toHaveLength(layout.edges.length)

    const person = layout.nodes.find((n) => n.id === 'person:p_a')!
    const flowPerson = flow.nodes.find((n) => n.id === 'person:p_a')!
    expect(flowPerson.type).toBe('person')
    expect(flowPerson.data).toEqual({
      view: personNodeView(data.persons[0]!),
      width: person.width,
      height: person.height,
      highlight: undefined,
    })
    expect(flowPerson.position).toEqual({ x: person.x, y: person.y })
    expect(flow.nodes.filter((n) => n.type === 'union')).toHaveLength(
      layout.nodes.filter((n) => n.kind === 'union').length,
    )

    for (const edge of layout.edges) {
      const flowEdge = flow.edges.find((e) => e.id === edge.id)!
      expect(flowEdge.type).toBe('elk')
      expect(flowEdge.source).toBe(edge.source)
      expect(flowEdge.target).toBe(edge.target)
      expect(flowEdge.data?.points).toEqual(edge.points)
    }
  })
})

describe('toFlow zdjęcia', () => {
  it('dodaje adres zdjęcia tylko osobie ze zdjęciem i pomija pusty adres', async () => {
    const data = buildFamily({ persons: [{ id: 'p_a', photo: 'a.webp' }, { id: 'p_b' }] })
    const layout = await layoutTree(buildTreeGraph(data))

    const withUrl = toFlow(layout, data, (person) =>
      person.photo ? `/photos/${person.photo}` : undefined,
    )
    expect(withUrl.nodes.find((n) => n.id === 'person:p_a')!.data.photoUrl).toBe('/photos/a.webp')
    expect(withUrl.nodes.find((n) => n.id === 'person:p_b')!.data).not.toHaveProperty('photoUrl')

    const empty = toFlow(layout, data, () => undefined)
    expect(empty.nodes.find((n) => n.id === 'person:p_a')!.data).not.toHaveProperty('photoUrl')
  })
})

describe('toFlow podświetlenie', () => {
  const data = buildFamily({
    persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }, { id: 'p_x' }, { id: 'p_y' }],
    parentChild: [
      ['p_a', 'p_c'],
      ['p_b', 'p_c'],
    ],
    unions: [
      ['p_a', 'p_b'],
      ['p_x', 'p_y'],
    ],
  })

  it('bez zaznaczenia nic nie jest podświetlone ani przygaszone', async () => {
    const flow = toFlow(await layoutTree(buildTreeGraph(data)), data, () => undefined)
    expect(flow.nodes.every((n) => !n.data.highlight && !n.data.dimmed)).toBe(true)
    expect(flow.edges.every((e) => !e.data!.dimmed)).toBe(true)
  })

  it('najbliżsi dostają grupę, reszta jest przygaszona', async () => {
    const layout = await layoutTree(buildTreeGraph(data))
    const flow = toFlow(layout, data, () => undefined, 'p_c')
    const highlight = (id: string) =>
      flow.nodes.find((n) => n.id === `person:${id}`)!.data.highlight
    expect(['p_a', 'p_b', 'p_c', 'p_x'].map(highlight)).toEqual([
      'parent',
      'parent',
      undefined,
      'dimmed',
    ])
    const unions = flow.nodes.filter((n) => n.type === 'union')
    expect(unions.map((n) => n.data.dimmed).sort()).toEqual([false, true])
    const brightEdges = flow.edges.filter((e) => !e.data!.dimmed).map((e) => e.source)
    expect(brightEdges.sort()).toEqual(
      ['person:p_a', 'person:p_b', unions.find((n) => !n.data.dimmed)!.id].sort(),
    )
  })
})
