import type { Edge, Node } from '@vue-flow/core'
import type { FamilyData, Person } from '@/domain/schema'
import type { Point, TreeLayout } from '@/domain/tree-layout'
import { closestRelatives, focusNodeIds, type NodeHighlight } from './highlight'
import { personNodeView, type PersonNodeView } from './person-node-view'

export interface ElkEdgeData {
  points: Point[]
  dimmed: boolean
}

export interface PersonNodeData {
  view: PersonNodeView
  width: number
  height: number
  highlight: NodeHighlight
  photoUrl?: string
}

export interface UnionNodeData {
  dimmed: boolean
}

export function toFlow(
  layout: TreeLayout,
  data: FamilyData,
  photoUrl: (person: Person) => string | undefined,
  selectedPersonId: string | null = null,
): { nodes: Node[]; edges: Edge<ElkEdgeData>[] } {
  const persons = new Map(data.persons.map((person) => [person.id, person]))
  const selected =
    selectedPersonId !== null && persons.has(selectedPersonId) ? selectedPersonId : null
  const relatives = selected ? closestRelatives(data, selected) : new Map()
  const focus = selected ? focusNodeIds(layout.edges, selected) : new Set<string>()
  const dimmed = (id: string) => selected !== null && !focus.has(id)

  function highlightOf(personId: string): NodeHighlight {
    if (selected === null || personId === selected) return undefined
    return relatives.get(personId) ?? 'dimmed'
  }

  const nodes: Node[] = layout.nodes.map((node) => {
    const person = node.kind === 'person' ? persons.get(node.id.slice('person:'.length)) : undefined
    const url = person ? photoUrl(person) : undefined
    const nodeData: PersonNodeData | UnionNodeData = person
      ? {
          view: personNodeView(person),
          width: node.width,
          height: node.height,
          highlight: highlightOf(person.id),
          ...(url ? { photoUrl: url } : {}),
        }
      : { dimmed: dimmed(node.id) }
    return { id: node.id, type: node.kind, position: { x: node.x, y: node.y }, data: nodeData }
  })
  const edges: Edge<ElkEdgeData>[] = layout.edges.map((edge) => ({
    id: edge.id,
    type: 'elk',
    source: edge.source,
    target: edge.target,
    data: { points: edge.points, dimmed: dimmed(edge.source) && dimmed(edge.target) },
  }))
  return { nodes, edges }
}
