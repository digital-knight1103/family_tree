import ELK, { type ElkNode, type ElkPort } from 'elkjs/lib/elk.bundled.js'
import { connectedComponents } from './components'
import type { TreeEdge, TreeGraph, TreeNode } from './graph'
import { placeRows } from './placement'
import { orderNodes } from './row-order'

/** Smallest (and default) person node; `LayoutOptions` can make it wider and taller. */
export const PERSON_NODE = { width: 200, height: 72 }
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

export interface LayoutOptions {
  /** Width of a person's node (e.g. measured from its text); never less than `PERSON_NODE.width`. */
  personWidth?: (personId: string) => number
  /** Height of a person's node (e.g. with a wrapped birth place); never less than `PERSON_NODE.height`. */
  personHeight?: (personId: string) => number
}

/** Room for the "+" buttons beside a node (91 px and 68 px wide, 4 px from it). */
const NODE_SPACING = 104
const COMPONENT_SPACING = 2 * NODE_SPACING
/** How much lower the partner line of each further partner of the same person runs. */
const LEVEL_STEP = 12

/**
 * Rows come from partitions (person row 2g, union row 2g + 1). The order inside each row comes
 * from `orderNodes` and the horizontal positions from `placeRows`; ELK keeps both (semi-interactive
 * crossing minimisation keeps the order, interactive node placement the positions) and routes the
 * lines orthogonally between the rows. Every line gets its own node in each row it passes, at a
 * free spot chosen here, so ELK has nothing left to place: it would put the bends of long edges
 * at the end of the row. `placeRows` keeps the spacing between nodes, ELK needs only a little.
 * Partitions already fix the layers, so the cheap longest-path layering is enough; the default
 * network simplex layering took about 90% of the time (over 3 s for ~300 persons).
 * Connected groups stay in one ELK graph (`separateConnectedComponents: false`), so their rows
 * line up; `separateGroups` then moves them apart horizontally.
 */
const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '1',
  'elk.partitioning.activate': 'true',
  'elk.separateConnectedComponents': 'false',
  'elk.layered.layering.strategy': 'LONGEST_PATH',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
  'elk.spacing.nodeNode': '8',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
}

const port = (nodeId: string, end: 'in' | 'out') => `${nodeId}:${end}`

const elk = new ELK()

const rowOf = (node: TreeNode) => 2 * node.generation + (node.kind === 'union' ? 1 : 0)

/**
 * An ELK node a line passes through, centred at `centre`, with fixed ports in the middle of its
 * top side (in) and bottom side (out). Union points are such nodes too: children leave at the
 * bottom, a partner from another row enters at the top (partners within a row are drawn here).
 */
function passNode(id: string, centre: number, row: number, width: number, height: number): ElkNode {
  const x = centre - width / 2
  const at = (end: 'in' | 'out', y: number, side: string): ElkPort => ({
    id: port(id, end),
    x: width / 2,
    y,
    width: 0,
    height: 0,
    layoutOptions: { 'elk.port.side': side },
  })
  return {
    id,
    x,
    y: 0,
    width,
    height,
    ports: [at('in', 0, 'NORTH'), at('out', height, 'SOUTH')],
    layoutOptions: {
      'elk.partitioning.partition': String(row),
      'elk.position': `(${x}, ${row})`,
      'elk.portConstraints': 'FIXED_POS',
    },
  }
}

const nearest = (spots: number[] | undefined, x: number) =>
  spots?.reduce((best, spot) => (Math.abs(spot - x) < Math.abs(best - x) ? spot : best)) ?? x

/** Drops the points in the middle of a straight run (where a line passes through its nodes). */
function straighten(points: Point[]): Point[] {
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-6
  return points.filter((point, i) => {
    const before = points[i - 1]
    const after = points[i + 1]
    if (!before || !after) return true
    return !(
      (same(before.x, point.x) && same(point.x, after.x)) ||
      (same(before.y, point.y) && same(point.y, after.y))
    )
  })
}

export async function layoutTree(
  graph: TreeGraph,
  options: LayoutOptions = {},
): Promise<TreeLayout> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const sizeOf = (nodeId: string, measure: LayoutOptions['personWidth'], least: number) => {
    const node = byId.get(nodeId)!
    const size = node.kind === 'person' ? measure?.(node.personId) : undefined
    return size !== undefined && Number.isFinite(size) && size > least ? size : least
  }
  const widthOf = (nodeId: string) => sizeOf(nodeId, options.personWidth, PERSON_NODE.width)
  const personHeightOf = (nodeId: string) =>
    sizeOf(nodeId, options.personHeight, PERSON_NODE.height)
  const ordered = orderNodes(graph)
  const placement = placeRows(graph, ordered, widthOf, NODE_SPACING)
  const centreOf = (nodeId: string) =>
    placement.personX.get(nodeId) ?? placement.unions.get(nodeId)!.x

  // A person row is as tall as its tallest person: ELK gets every node of the row at that height,
  // so the row's tops line up and the union row (with the partner lines) lies below all of them.
  // A union row is as tall as its lowest partner line needs.
  const personRowHeight = new Map<number, number>()
  const unionHeight = new Map<number, number>()
  for (const node of graph.nodes) {
    const [heights, height] =
      node.kind === 'person'
        ? [personRowHeight, personHeightOf(node.id)]
        : [unionHeight, UNION_NODE.height + placement.unions.get(node.id)!.level * LEVEL_STEP]
    heights.set(node.generation, Math.max(heights.get(node.generation) ?? 0, height))
  }
  const heightOf = (row: number) =>
    row % 2 === 0
      ? (personRowHeight.get(row / 2) ?? PERSON_NODE.height)
      : (unionHeight.get((row - 1) / 2) ?? UNION_NODE.height)

  /** Partner edges within a row are drawn along the union's partner line, not routed by ELK. */
  const drawnHere = (edge: TreeEdge) =>
    edge.kind === 'partner' &&
    byId.get(edge.source)!.generation === byId.get(edge.target)!.generation

  const children = ordered.map((node): ElkNode => {
    if (node.kind === 'union') {
      const row = rowOf(node)
      return passNode(node.id, centreOf(node.id), row, UNION_NODE.width, heightOf(row))
    }
    const width = widthOf(node.id)
    const x = centreOf(node.id) - width / 2
    return {
      id: node.id,
      x,
      y: 0,
      width,
      height: heightOf(rowOf(node)),
      layoutOptions: {
        'elk.partitioning.partition': String(rowOf(node)),
        'elk.position': `(${x}, ${rowOf(node)})`,
      },
    }
  })

  /**
   * Each routed edge becomes a chain of ELK edges through one node per row between its ends. A
   * line from a person (to a child of a single parent, or to a partner in a lower row) first goes
   * straight down to a node below the person in its union row. In a person row a line passes at
   * the free spot nearest to where it starts, and in the union row below at the same place.
   */
  const passNodes = new Set<string>()
  const pass = (id: string, centre: number, row: number) => {
    if (passNodes.has(id)) return id
    passNodes.add(id)
    children.push(passNode(id, centre, row, row % 2 === 0 ? 0 : UNION_NODE.width, heightOf(row)))
    return id
  }
  const chains = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (drawnHere(edge)) continue
    const source = byId.get(edge.source)!
    const start = centreOf(edge.source)
    const first =
      source.kind === 'union' ? edge.source : pass(`${edge.source}:below`, start, rowOf(source) + 1)
    const chain = [first]
    let x = start
    for (let row = 2 * source.generation + 2; row < rowOf(byId.get(edge.target)!); row++) {
      if (row % 2 === 0) x = nearest(placement.freeSpots.get(row / 2), start)
      chain.push(pass(`${edge.id}:${row}`, x, row))
    }
    chains.set(edge.id, chain)
  }
  // Model order follows the positions inside each row.
  const partitionOf = (child: ElkNode) => Number(child.layoutOptions!['elk.partitioning.partition'])
  children.sort((a, b) => partitionOf(a) - partitionOf(b) || a.x! - b.x!)

  const part = (edgeId: string, i: number) => `${edgeId}#${i}`
  const elkEdges = graph.edges.flatMap((edge) => {
    const chain = chains.get(edge.id)
    if (!chain) return []
    const end = edge.kind === 'partner' ? port(edge.target, 'in') : edge.target
    return chain.map((nodeId, i) => ({
      id: part(edge.id, i),
      sources: [port(nodeId, 'out')],
      targets: [i + 1 < chain.length ? port(chain[i + 1]!, 'in') : end],
    }))
  })
  const root: ElkNode = { id: 'root', layoutOptions: LAYOUT_OPTIONS, children, edges: elkEdges }
  const result = await elk.layout(root)

  const positioned = new Map((result.children ?? []).map((child) => [child.id, child]))
  const nodes = graph.nodes.map((node): PositionedNode => {
    const { x = 0, y = 0 } = positioned.get(node.id)!
    return node.kind === 'person'
      ? {
          id: node.id,
          kind: node.kind,
          x,
          y,
          width: widthOf(node.id),
          height: personHeightOf(node.id),
        }
      : {
          id: node.id,
          kind: node.kind,
          x,
          y: y + placement.unions.get(node.id)!.level * LEVEL_STEP,
          ...UNION_NODE,
        }
  })

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const routed = new Map((result.edges ?? []).map((edge) => [edge.id, edge]))
  const edges = graph.edges.map((edge): RoutedEdge => {
    const chain = chains.get(edge.id)
    if (!chain) return { ...edge, points: partnerLine(nodeById, edge) }
    const points = chain.flatMap((_, i) => {
      const section = routed.get(part(edge.id, i))?.sections?.[0]
      return section
        ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(({ x, y }) => ({
            x,
            y,
          }))
        : []
    })
    // ELK starts the line at the bottom of the first node of the chain. It runs straight down
    // from there, so it can start higher: at the union point (moved down for a lower partner
    // line) or at the person itself (shorter than its row).
    const source = nodeById.get(edge.source)!
    if (points[0]) points[0].y = source.y + source.height
    return { ...edge, points: straighten(points) }
  })
  const width = separateGroups(graph, nodes, edges)
  return { nodes, edges, width, height: result.height ?? 0 }
}

/** Down from the middle of the person to the union's partner line, then along it to the union. */
function partnerLine(nodes: Map<string, PositionedNode>, edge: TreeEdge): Point[] {
  const person = nodes.get(edge.source)!
  const union = nodes.get(edge.target)!
  const x = person.x + person.width / 2
  const start = { x, y: person.y + person.height }
  if (Math.abs(x - (union.x + union.width / 2)) <= 0.5) return [start, { x, y: union.y }]
  const middle = union.y + union.height / 2
  const side = x < union.x ? union.x : union.x + union.width
  return [start, { x, y: middle }, { x: side, y: middle }]
}

/**
 * ELK keeps the order inside each row, but packs separate groups into each other's columns. Each
 * group (in the order of `connectedComponents`, main tree first) is shifted to start right of the
 * previous one; groups share no edges, so the shift changes nothing inside a group. Returns the
 * new width, keeping ELK's padding on both sides.
 */
function separateGroups(graph: TreeGraph, nodes: PositionedNode[], edges: RoutedEdge[]): number {
  const componentOf = connectedComponents(graph)
  const extents = new Map<number, { left: number; right: number }>()
  const extend = (component: number, left: number, right: number) => {
    const extent = extents.get(component) ?? { left, right }
    extents.set(component, {
      left: Math.min(extent.left, left),
      right: Math.max(extent.right, right),
    })
  }
  for (const node of nodes) extend(componentOf.get(node.id)!, node.x, node.x + node.width)
  for (const edge of edges) {
    for (const { x } of edge.points) extend(componentOf.get(edge.source)!, x, x)
  }
  const components = [...extents.keys()].sort((a, b) => a - b)
  if (components.length === 0) return 0
  const padding = extents.get(components[0]!)!.left
  const shift = new Map<number, number>()
  let cursor = padding
  for (const component of components) {
    const { left, right } = extents.get(component)!
    shift.set(component, cursor - left)
    cursor += right - left + COMPONENT_SPACING
  }
  for (const node of nodes) node.x += shift.get(componentOf.get(node.id)!)!
  for (const edge of edges) {
    const dx = shift.get(componentOf.get(edge.source)!)!
    for (const point of edge.points) point.x += dx
  }
  return cursor - COMPONENT_SPACING + padding
}
