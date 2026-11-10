import type { Edge, Node } from '@vue-flow/core'
import type { FamilyData, Person } from '@/domain/schema'
import type { Point, TreeLayout } from '@/domain/tree-layout'
import { personNodeView, type PersonNodeView } from './person-node-view'

export interface ElkEdgeData {
  points: Point[]
}

export interface PersonNodeData {
  view: PersonNodeView
  photoUrl?: string
}

function personData(
  person: Person,
  photoUrl: (person: Person) => string | undefined,
): PersonNodeData {
  const url = photoUrl(person)
  return { view: personNodeView(person), ...(url ? { photoUrl: url } : {}) }
}

export function toFlow(
  layout: TreeLayout,
  data: FamilyData,
  photoUrl: (person: Person) => string | undefined,
): { nodes: Node[]; edges: Edge<ElkEdgeData>[] } {
  const persons = new Map(data.persons.map((person) => [person.id, person]))
  const nodes: Node[] = layout.nodes.map((node) => {
    const person = node.kind === 'person' ? persons.get(node.id.slice('person:'.length)) : undefined
    return {
      id: node.id,
      type: node.kind,
      position: { x: node.x, y: node.y },
      data: person ? personData(person, photoUrl) : {},
    }
  })
  const edges: Edge<ElkEdgeData>[] = layout.edges.map((edge) => ({
    id: edge.id,
    type: 'elk',
    source: edge.source,
    target: edge.target,
    data: { points: edge.points },
  }))
  return { nodes, edges }
}
