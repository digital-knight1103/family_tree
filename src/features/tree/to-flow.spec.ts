// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildTreeGraph, layoutTree } from '@/domain/tree-layout'
import { buildFamily } from '@tests/fixtures/build-family'
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
    const flow = toFlow(layout)

    expect(flow.nodes).toHaveLength(layout.nodes.length)
    expect(flow.edges).toHaveLength(layout.edges.length)

    const person = layout.nodes.find((n) => n.id === 'person:p_a')!
    const flowPerson = flow.nodes.find((n) => n.id === 'person:p_a')!
    expect(flowPerson.type).toBe('person')
    expect(flowPerson.data).toEqual({ personId: 'p_a' })
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
