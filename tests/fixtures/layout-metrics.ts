import type { FamilyData } from '@/domain/schema'
import type { Point, PositionedNode, RoutedEdge, TreeLayout } from '@/domain/tree-layout'

const EPS = 0.5

export function segments(edge: RoutedEdge): [Point, Point][] {
  const result: [Point, Point][] = []
  for (let i = 1; i < edge.points.length; i++) result.push([edge.points[i - 1]!, edge.points[i]!])
  return result
}

export function centerX(node: PositionedNode): number {
  return node.x + node.width / 2
}

const cross = (o: Point, a: Point, b: Point) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** Proper crossing: the segments meet at a single point inside both of them. */
function properlyCross([a, b]: [Point, Point], [c, d]: [Point, Point]): boolean {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  )
}

/** Collinear segments sharing a stretch of positive length. */
function overlap([a, b]: [Point, Point], [c, d]: [Point, Point]): boolean {
  if (Math.abs(cross(a, b, c)) > EPS || Math.abs(cross(a, b, d)) > EPS) return false
  const horizontal = Math.abs(a.y - b.y) <= EPS && Math.abs(c.y - d.y) <= EPS
  const [p1, p2, q1, q2] = horizontal ? [a.x, b.x, c.x, d.x] : [a.y, b.y, c.y, d.y]
  const lo = Math.max(Math.min(p1, p2), Math.min(q1, q2))
  const hi = Math.min(Math.max(p1, p2), Math.max(q1, q2))
  return hi - lo > EPS
}

const shareNode = (e: RoutedEdge, f: RoutedEdge) =>
  e.source === f.source || e.source === f.target || e.target === f.source || e.target === f.target

/**
 * Counts interior intersections between segments of different edges. Touching at end points does
 * not count; overlapping stretches count only for edges that do not share a node (edges leaving
 * the same node may share a trunk).
 */
export function countCrossings(edges: RoutedEdge[]): number {
  let count = 0
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i]!
      const f = edges[j]!
      for (const s of segments(e)) {
        for (const t of segments(f)) {
          if (properlyCross(s, t)) count++
          else if (!shareNode(e, f) && overlap(s, t)) count++
        }
      }
    }
  }
  return count
}

const isHorizontal = ([a, b]: [Point, Point]) => Math.abs(a.y - b.y) <= EPS

/** Children of every family (a union point or a single parent), by the family's node id. */
function familiesOf(layout: TreeLayout): Map<string, string[]> {
  const families = new Map<string, string[]>()
  for (const edge of layout.edges) {
    if (edge.kind === 'child')
      families.set(edge.source, [...(families.get(edge.source) ?? []), edge.target])
  }
  return families
}

/**
 * Violations of sibling-block rule 1 (spec §6.4): in each row, between the outermost children of a
 * family stand only their siblings and the siblings' partners.
 */
export function siblingBlocksContiguous(layout: TreeLayout, data: FamilyData): string[] {
  const nodes = new Map(layout.nodes.map((n) => [n.id, n]))
  const partners = new Map<string, Set<string>>()
  for (const { partnerIds } of data.unions) {
    const [a, b] = partnerIds.map((id) => `person:${id}`) as [string, string]
    partners.set(a, (partners.get(a) ?? new Set()).add(b))
    partners.set(b, (partners.get(b) ?? new Set()).add(a))
  }
  const people = layout.nodes.filter((n) => n.kind === 'person')
  const violations: string[] = []
  for (const [family, children] of familiesOf(layout)) {
    const rows = new Map<number, PositionedNode[]>()
    for (const child of children) {
      const node = nodes.get(child)!
      rows.set(node.y, [...(rows.get(node.y) ?? []), node])
    }
    for (const [y, row] of rows) {
      const left = Math.min(...row.map((n) => n.x))
      const right = Math.max(...row.map((n) => n.x))
      for (const n of people) {
        if (Math.abs(n.y - y) > EPS || n.x <= left || n.x >= right) continue
        if (children.includes(n.id)) continue
        if (children.some((c) => partners.get(c)?.has(n.id))) continue
        violations.push(`${family}: ${n.id} stoi między rodzeństwem`)
      }
    }
  }
  return violations
}

/**
 * Violations of sibling-block rule 3 (spec §6.4): a horizontal stretch of one family's line to
 * its children shares a stretch with another family's horizontal at the same height, or crosses
 * any part of another family's line to its children.
 */
export function siblingLinesOverlap(layout: TreeLayout): string[] {
  const edges = layout.edges.filter((e) => e.kind === 'child')
  const violations = new Set<string>()
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i]!
      const f = edges[j]!
      if (e.source === f.source) continue
      for (const s of segments(e)) {
        for (const t of segments(f)) {
          const sameHeight = isHorizontal(s) && isHorizontal(t) && overlap(s, t)
          const crossing = (isHorizontal(s) || isHorizontal(t)) && properlyCross(s, t)
          if (sameHeight || crossing) {
            violations.add(
              `${e.source} i ${f.source}: ${sameHeight ? 'nakładają się' : 'przecinają się'}`,
            )
          }
        }
      }
    }
  }
  return [...violations]
}

/**
 * Sibling-block rule 4 (spec §6.4): for every family (by node id), how far its union point or
 * single parent stands from the middle of its outermost children.
 */
export function familyCentreDeviation(layout: TreeLayout): Map<string, number> {
  const nodes = new Map(layout.nodes.map((n) => [n.id, n]))
  const deviation = new Map<string, number>()
  for (const [family, children] of familiesOf(layout)) {
    const xs = children.map((c) => centerX(nodes.get(c)!))
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2
    deviation.set(family, Math.abs(centerX(nodes.get(family)!) - middle))
  }
  return deviation
}
