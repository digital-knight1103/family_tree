import type { Point, PositionedNode, RoutedEdge } from '@/domain/tree-layout'

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
