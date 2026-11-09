import { describe, expect, it } from 'vitest'
import seed from '@seed/demo-family.json'
import { familyDataSchema } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { buildTreeGraph, type TreeGraph } from './graph'

const ids = (...names: string[]) => names.map((id) => ({ id: `p_${id}` }))
const edgeIds = (graph: TreeGraph) => graph.edges.map((e) => e.id)
const nodeIds = (graph: TreeGraph) => graph.nodes.map((n) => n.id)

describe('buildTreeGraph', () => {
  it('para z dzieckiem daje węzeł związku między rodzicami a dzieckiem', () => {
    const graph = buildTreeGraph(
      buildFamily({
        persons: ids('a', 'b', 'c'),
        parentChild: [
          ['p_a', 'p_c'],
          ['p_b', 'p_c'],
        ],
        unions: [['p_a', 'p_b']],
      }),
    )
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { id: 'person:p_a->union:u_1', kind: 'partner', source: 'person:p_a', target: 'union:u_1' },
        { id: 'person:p_b->union:u_1', kind: 'partner', source: 'person:p_b', target: 'union:u_1' },
        { id: 'union:u_1->person:p_c', kind: 'child', source: 'union:u_1', target: 'person:p_c' },
      ]),
    )
    expect(graph.edges).toHaveLength(3)
  })

  it('dziecko jednego znanego rodzica łączy się bezpośrednio z nim', () => {
    const graph = buildTreeGraph(
      buildFamily({ persons: ids('a', 'c'), parentChild: [['p_a', 'p_c']] }),
    )
    expect(graph.edges).toEqual([
      { id: 'person:p_a->person:p_c', kind: 'child', source: 'person:p_a', target: 'person:p_c' },
    ])
    expect(nodeIds(graph).some((id) => id.startsWith('union:'))).toBe(false)
  })

  it('związek bez dzieci też ma węzeł', () => {
    const graph = buildTreeGraph(buildFamily({ persons: ids('a', 'b'), unions: [['p_a', 'p_b']] }))
    expect(nodeIds(graph)).toContain('union:u_1')
    expect(graph.edges.map((e) => e.kind)).toEqual(['partner', 'partner'])
  })

  it('rodzice bez rekordu związku dostają węzeł pary', () => {
    const graph = buildTreeGraph(
      buildFamily({
        persons: ids('a', 'b', 'c'),
        parentChild: [
          ['p_b', 'p_c'],
          ['p_a', 'p_c'],
        ],
      }),
    )
    const couple = graph.nodes.find((n) => n.id === 'couple:p_a+p_b')
    expect(couple).toMatchObject({ kind: 'union', unionId: null, partnerIds: ['p_a', 'p_b'] })
    expect(edgeIds(graph)).toContain('couple:p_a+p_b->person:p_c')
  })

  it('dzieci dwóch związków wychodzą z właściwych węzłów', () => {
    const graph = buildTreeGraph(
      buildFamily({
        persons: ids('a', 'b', 'x', 'c', 'd'),
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
      }),
    )
    expect(edgeIds(graph)).toContain('union:u_1->person:p_c')
    expect(edgeIds(graph)).toContain('union:u_2->person:p_d')
    expect(edgeIds(graph)).not.toContain('union:u_2->person:p_c')
  })

  it('każda relacja rodzic–dziecko ma krawędź', () => {
    const connected = (graph: TreeGraph, parent: string, child: string) => {
      const direct = graph.edges.some(
        (e) => e.source === `person:${parent}` && e.target === `person:${child}`,
      )
      const viaUnion = graph.nodes.some(
        (n) =>
          n.kind === 'union' &&
          n.partnerIds.includes(parent) &&
          graph.edges.some((e) => e.source === n.id && e.target === `person:${child}`),
      )
      return direct || viaUnion
    }
    const demo = familyDataSchema.parse(seed)
    const triple = buildFamily({
      persons: ids('a', 'b', 'x', 'c'),
      parentChild: [
        ['p_a', 'p_c', 'biological'],
        ['p_b', 'p_c', 'biological'],
        ['p_x', 'p_c', 'adoptive'],
      ],
      unions: [['p_a', 'p_b']],
    })
    for (const data of [demo, triple]) {
      const graph = buildTreeGraph(data)
      for (const { parentId, childId } of data.parentChild) {
        expect([parentId, childId, connected(graph, parentId, childId)]).toEqual([
          parentId,
          childId,
          true,
        ])
      }
    }
    expect(edgeIds(buildTreeGraph(triple))).toContain('person:p_x->person:p_c')
  })

  it('dane demo dają 20 osób i 7 związków', () => {
    const graph = buildTreeGraph(familyDataSchema.parse(seed))
    expect(graph.nodes.filter((n) => n.kind === 'person')).toHaveLength(20)
    expect(graph.nodes.filter((n) => n.kind === 'union' && n.unionId !== null)).toHaveLength(7)
  })

  it('nie zależy od kolejności tablic', () => {
    const data = familyDataSchema.parse(seed)
    const reversed = {
      ...data,
      persons: [...data.persons].reverse(),
      parentChild: [...data.parentChild].reverse(),
      unions: [...data.unions].reverse(),
    }
    expect(buildTreeGraph(reversed)).toEqual(buildTreeGraph(data))
  })
})
