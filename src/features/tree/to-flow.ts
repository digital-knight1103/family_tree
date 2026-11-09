import type { Edge, Node } from '@vue-flow/core'
import type { Point, TreeLayout } from '@/domain/tree-layout'

export interface ElkEdgeData {
  points: Point[]
}

export function toFlow(layout: TreeLayout): { nodes: Node[]; edges: Edge<ElkEdgeData>[] } {
  const nodes: Node[] = layout.nodes.map((node) => ({
    id: node.id,
    type: node.kind,
    position: { x: node.x, y: node.y },
    data: node.kind === 'person' ? { personId: node.id.slice('person:'.length) } : {},
  }))
  const edges: Edge<ElkEdgeData>[] = layout.edges.map((edge) => ({
    id: edge.id,
    type: 'elk',
    source: edge.source,
    target: edge.target,
    data: { points: edge.points },
  }))
  return { nodes, edges }
}
