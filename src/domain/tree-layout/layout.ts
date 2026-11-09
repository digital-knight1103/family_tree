import ELK, { type ElkNode, type ElkPort } from 'elkjs/lib/elk.bundled.js'
import type { TreeEdge, TreeGraph, TreeNode } from './graph'
import { orderNodes } from './row-order'

export const PERSON_NODE = { width: 200, height: 64 }
export const UNION_NODE = { width: 8, height: 8 }

export interface Point {
  x: number
  y: number
}

/** `x`, `y` are the top-left corner. */
export interface PositionedNode {
  id: string
  kind: 'person' | 'union'
  x: number
  y: number
  width: number
  height: number
}

export interface RoutedEdge {
  id: string
  kind: 'partner' | 'child'
  source: string
  target: string
  points: Point[]
}

export interface TreeLayout {
  nodes: PositionedNode[]
  edges: RoutedEdge[]
  width: number
  height: number
}

const NODE_SPACING = 32

/**
 * Rows come from partitions (person row 2g, union row 2g + 1). The left-to-right order inside
 * each row is computed by `orderNodes` and handed to ELK as positions: semi-interactive crossing
 * minimisation keeps the order of real nodes and only arranges the bends of long edges.
 */
const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '1',
  'elk.partitioning.activate': 'true',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.spacing.nodeNode': String(NODE_SPACING),
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
}

/**
 * Inside ELK a union is a bar as wide as the distance between the centres of two neighbouring
 * people, with fixed ports: partners enter at its ends, children leave from its middle. Straight
 * partner edges then put the middle of the bar halfway between the partners. In the result the
 * union is a small node in the middle of the bar, and each partner edge runs along its half.
 */
const BAR = { width: PERSON_NODE.width + NODE_SPACING, height: UNION_NODE.height }
type BarEnd = 'left' | 'right' | 'children'
const port = (unionId: string, end: BarEnd) => `${unionId}:${end}`

const elk = new ELK()

const rowOf = (node: TreeNode) => 2 * node.generation + (node.kind === 'union' ? 1 : 0)

function unionPorts(unionId: string): ElkPort[] {
  const at = (end: BarEnd, x: number, y: number, side: string): ElkPort => ({
    id: port(unionId, end),
    x,
    y,
    width: 0,
    height: 0,
    layoutOptions: { 'elk.port.side': side },
  })
  return [
    at('left', 0, 0, 'NORTH'),
    at('right', BAR.width, 0, 'NORTH'),
    at('children', BAR.width / 2, BAR.height, 'SOUTH'),
  ]
}

export async function layoutTree(graph: TreeGraph): Promise<TreeLayout> {
  const ordered = orderNodes(graph)
  const indexInRow = new Map<string, number>()
  const rowSizes = new Map<number, number>()
  for (const node of ordered) {
    const row = rowOf(node)
    const index = rowSizes.get(row) ?? 0
    indexInRow.set(node.id, index)
    rowSizes.set(row, index + 1)
  }

  const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]))
  const leftPartner = new Map<string, string>()
  for (const node of graph.nodes) {
    if (node.kind !== 'union') continue
    const [a, b] = node.partnerIds.map((id) => `person:${id}`) as [string, string]
    leftPartner.set(node.id, indexInRow.get(a)! <= indexInRow.get(b)! ? a : b)
  }
  const sourceOf = (edge: TreeEdge) =>
    kindOf.get(edge.source) === 'union' ? port(edge.source, 'children') : edge.source
  const targetOf = (edge: TreeEdge) =>
    edge.kind === 'partner'
      ? port(edge.target, leftPartner.get(edge.target) === edge.source ? 'left' : 'right')
      : edge.target

  const root: ElkNode = {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
    children: ordered.map((node) => ({
      id: node.id,
      ...(node.kind === 'person' ? PERSON_NODE : { ...BAR, ports: unionPorts(node.id) }),
      layoutOptions: {
        'elk.partitioning.partition': String(rowOf(node)),
        'elk.position': `(${indexInRow.get(node.id)! * PERSON_NODE.width}, ${rowOf(node)})`,
        ...(node.kind === 'union' ? { 'elk.portConstraints': 'FIXED_POS' } : {}),
      },
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [sourceOf(edge)],
      targets: [targetOf(edge)],
    })),
  }
  const result = await elk.layout(root)

  const positioned = new Map((result.children ?? []).map((child) => [child.id, child]))
  const nodes = graph.nodes.map((node): PositionedNode => {
    const { x = 0, y = 0 } = positioned.get(node.id)!
    return node.kind === 'person'
      ? { id: node.id, kind: node.kind, x, y, ...PERSON_NODE }
      : {
          id: node.id,
          kind: node.kind,
          x: x + BAR.width / 2 - UNION_NODE.width / 2,
          y,
          ...UNION_NODE,
        }
  })

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const routed = new Map((result.edges ?? []).map((edge) => [edge.id, edge]))
  const edges = graph.edges.map((edge): RoutedEdge => {
    const section = routed.get(edge.id)?.sections?.[0]
    const points = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(({ x, y }) => ({
          x,
          y,
        }))
      : []
    const end = points[points.length - 1]
    if (edge.kind === 'partner' && end) {
      // From the end of the bar along its middle line to the union node.
      const union = nodeById.get(edge.target)!
      const middle = union.y + union.height / 2
      const side = end.x < union.x ? union.x : union.x + union.width
      points.push({ x: end.x, y: middle }, { x: side, y: middle })
    }
    return { ...edge, points }
  })
  return { nodes, edges, width: result.width ?? 0, height: result.height ?? 0 }
}
