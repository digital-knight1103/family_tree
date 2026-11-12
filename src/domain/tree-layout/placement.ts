import { connectedComponents } from './components'
import type { TreeGraph, TreeNode } from './graph'

/** Where a union point stands relative to its partners. */
export interface UnionPlacement {
  /** Centre of the union point. */
  x: number
  /**
   * Number of people standing between the partners: 0 for partners side by side. A union whose
   * partners are further apart draws its partner line that many steps lower, below the others.
   */
  level: number
}

export interface Placement {
  /** Centre of every person node. */
  personX: Map<string, number>
  unions: Map<string, UnionPlacement>
  /**
   * For each person row (by generation), left to right: free spots where a line can pass the row,
   * in the middle of every gap except between partners, and one spacing beyond each end.
   */
  freeSpots: Map<number, number[]>
}

const MAX_ITERATIONS = 20_000
const TOLERANCE = 1e-6
/**
 * Weight of the wish that neighbours in a row stand close, against 1 for a family above the
 * middle of its children: it keeps the layout compact and shifts a family by well under 1 px.
 */
const COMPACT_WEIGHT = 1e-5

interface Term {
  unit: number
  coefficient: number
}

/** A linear expression in the unit positions. */
interface Expression {
  terms: Term[]
  constant: number
}

/**
 * Horizontal positions for the rows ordered by `orderNodes` (the order is kept). Partners side
 * by side stand `partnerSpacing` apart, every other neighbour at least `spacing` apart (between
 * the partners of one union, neighbours who are not a couple stand exactly `spacing` apart). Each
 * family (a union point or a single parent) should stand above the middle of its children:
 * halfway between the centres of the leftmost and the rightmost child in the nearest row, their
 * partners not counted. Where the rows leave no room for that, the sum of squared deviations is
 * the smallest possible. Positions are rounded to 0.01 px.
 *
 * Partners standing next to each other form a rigid unit; the unit positions are found by
 * accelerated projected gradient descent (FISTA with restarts), the projection onto the spacing
 * constraints of a row being an isotonic regression (pool adjacent violators). It starts from
 * packed rows, and a much weaker pull between neighbours of one connected group (`COMPACT_WEIGHT`)
 * closes the gaps that no family needs. Everything runs in a fixed order, so the result is
 * deterministic.
 */
export function placeRows(
  graph: TreeGraph,
  ordered: TreeNode[],
  widthOf: (personNodeId: string) => number,
  spacing: number,
  partnerSpacing: number,
): Placement {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const rows = new Map<number, string[]>()
  for (const node of ordered) {
    if (node.kind !== 'person') continue
    rows.set(node.generation, [...(rows.get(node.generation) ?? []), node.id])
  }
  const indexInRow = new Map<string, number>()
  for (const row of rows.values()) row.forEach((id, i) => indexInRow.set(id, i))

  // Unions with both partners in one row lock the gaps between them.
  const rigid = new Map<number, Set<number>>()
  const couples = new Set<string>()
  const couple = (a: string, b: string) => [a, b].sort().join(' ')
  const sameRow = (union: Extract<TreeNode, { kind: 'union' }>) => {
    const [a, b] = union.partnerIds.map((id) => `person:${id}`) as [string, string]
    return byId.get(a)!.generation === byId.get(b)!.generation ? ([a, b] as const) : undefined
  }
  for (const node of ordered) {
    if (node.kind !== 'union') continue
    const partners = sameRow(node)
    if (!partners) continue
    couples.add(couple(...partners))
    const [lo, hi] = partners.map((id) => indexInRow.get(id)!).sort((x, y) => x - y) as [
      number,
      number,
    ]
    const generation = byId.get(partners[0])!.generation
    const locked = rigid.get(generation) ?? new Set<number>()
    for (let i = lo; i < hi; i++) locked.add(i)
    rigid.set(generation, locked)
  }

  // Units: runs of people locked together. `offset` is a person's centre relative to its unit.
  const unitOf = new Map<string, number>()
  const offset = new Map<string, number>()
  const rowUnits: Array<{ units: number[]; gaps: number[] }> = []
  /** The connected group of each unit (see `connectedComponents`). */
  const componentOf = connectedComponents(graph)
  const unitComponent: number[] = []
  /** The gap a locked person keeps to the one on its left. */
  const lockedGap = new Map<string, number>()
  let unitCount = 0
  const initial: number[] = []
  for (const [generation, row] of [...rows].sort(([a], [b]) => a - b)) {
    const locked = rigid.get(generation) ?? new Set<number>()
    const units: number[] = []
    const gaps: number[] = []
    let cursor = 0
    row.forEach((id, i) => {
      const width = widthOf(id)
      if (i > 0 && locked.has(i - 1)) {
        const previous = row[i - 1]!
        const gap = couples.has(couple(previous, id)) ? partnerSpacing : spacing
        lockedGap.set(id, gap)
        offset.set(id, offset.get(previous)! + (widthOf(previous) + width) / 2 + gap)
        unitOf.set(id, unitOf.get(previous)!)
        cursor += width + gap
        return
      }
      if (i > 0) {
        const previous = row[i - 1]!
        gaps.push(offset.get(previous)! + (widthOf(previous) + width) / 2 + spacing)
        cursor += spacing
      }
      unitOf.set(id, unitCount)
      offset.set(id, 0)
      units.push(unitCount)
      unitComponent.push(componentOf.get(id)!)
      initial.push(cursor + width / 2)
      cursor += width
      unitCount++
    })
    rowUnits.push({ units, gaps })
  }

  const centreOf = (id: string, z: number[]) => z[unitOf.get(id)!]! + offset.get(id)!
  const at = (id: string, shift = 0): Expression => ({
    terms: [{ unit: unitOf.get(id)!, coefficient: 1 }],
    constant: offset.get(id)! + shift,
  })

  /** The union point: halfway between partners side by side, else in the gap left of the right one. */
  const unionPoints = new Map<string, { expression: Expression; level: number }>()
  for (const node of ordered) {
    if (node.kind !== 'union') continue
    const partners = sameRow(node)
    if (!partners) {
      const own = node.partnerIds
        .map((id) => `person:${id}`)
        .find((id) => byId.get(id)!.generation === node.generation)!
      unionPoints.set(node.id, { expression: at(own), level: 0 })
      continue
    }
    const [left, right] = [...partners].sort((x, y) => indexInRow.get(x)! - indexInRow.get(y)!) as [
      string,
      string,
    ]
    const between = indexInRow.get(right)! - indexInRow.get(left)! - 1
    const expression =
      between === 0
        ? at(left, (offset.get(right)! - offset.get(left)!) / 2)
        : at(right, -widthOf(right) / 2 - lockedGap.get(right)! / 2)
    unionPoints.set(node.id, { expression, level: between })
  }

  // Families: residual = family position - middle of its outermost children in the nearest row
  // (a child can stand lower, next to a partner from a younger generation).
  const childrenOf = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.kind === 'child') {
      childrenOf.set(edge.source, [...(childrenOf.get(edge.source) ?? []), edge.target])
    }
  }
  const residuals: Expression[] = []
  for (const [source, children] of childrenOf) {
    const head = unionPoints.get(source)?.expression ?? at(source)
    const nearest = Math.min(...children.map((id) => byId.get(id)!.generation))
    const byIndex = children
      .filter((id) => byId.get(id)!.generation === nearest)
      .sort((a, b) => indexInRow.get(a)! - indexInRow.get(b)!)
    const first = byIndex[0]!
    const last = byIndex[byIndex.length - 1]!
    residuals.push({
      terms: [
        ...head.terms,
        { unit: unitOf.get(first)!, coefficient: -0.5 },
        { unit: unitOf.get(last)!, coefficient: -0.5 },
      ],
      constant: head.constant - (offset.get(first)! + offset.get(last)!) / 2,
    })
  }
  // Much weaker: neighbours of one group in a row stand close together (equal gaps where they
  // have room). Separate groups do not pull at each other, `layoutTree` moves them apart.
  const scale = Math.sqrt(COMPACT_WEIGHT)
  for (const { units } of rowUnits) {
    for (let j = 1; j < units.length; j++) {
      if (unitComponent[units[j]!] !== unitComponent[units[j - 1]!]) continue
      residuals.push({
        terms: [
          { unit: units[j]!, coefficient: scale },
          { unit: units[j - 1]!, coefficient: -scale },
        ],
        constant: 0,
      })
    }
  }

  const z = solve(initial, residuals, rowUnits)
  const personX = new Map<string, number>()
  for (const row of rows.values()) for (const id of row) personX.set(id, roundPx(centreOf(id, z)))
  const unions = new Map<string, UnionPlacement>()
  for (const [id, { expression, level }] of unionPoints) {
    unions.set(id, { x: roundPx(evaluate(expression, z)), level })
  }
  const freeSpots = new Map<number, number[]>()
  for (const [generation, row] of rows) {
    const locked = rigid.get(generation) ?? new Set<number>()
    const side = (id: string, direction: 1 | -1) => personX.get(id)! + (direction * widthOf(id)) / 2
    const spots = [side(row[0]!, -1) - spacing]
    for (let i = 0; i + 1 < row.length; i++) {
      if (!locked.has(i)) spots.push((side(row[i]!, 1) + side(row[i + 1]!, -1)) / 2)
    }
    spots.push(side(row[row.length - 1]!, 1) + spacing)
    freeSpots.set(generation, spots.map(roundPx))
  }
  return { personX, unions, freeSpots }
}

/** To 0.01 px: the solver (and ELK's arithmetic) leaves noise such as `227.9999977905`. */
export const roundPx = (value: number) => Math.round(value * 100) / 100

function evaluate({ terms, constant }: Expression, z: number[]): number {
  let value = constant
  for (const { unit, coefficient } of terms) value += coefficient * z[unit]!
  return value
}

/** Minimises the sum of squared residuals over unit positions that keep every row's gaps. */
function solve(
  initial: number[],
  residuals: Expression[],
  rows: Array<{ units: number[]; gaps: number[] }>,
): number[] {
  const columnSums = new Array<number>(initial.length).fill(0)
  let rowSum = 0
  for (const { terms } of residuals) {
    rowSum = Math.max(
      rowSum,
      terms.reduce((sum, t) => sum + Math.abs(t.coefficient), 0),
    )
    for (const { unit, coefficient } of terms) columnSums[unit]! += Math.abs(coefficient)
  }
  const lipschitz = 2 * rowSum * Math.max(0, ...columnSums)
  let z = project(initial, rows)
  if (lipschitz === 0) return z
  const step = 1 / lipschitz

  const gradient = (point: number[]) => {
    const g = new Array<number>(point.length).fill(0)
    for (const residual of residuals) {
      const r = evaluate(residual, point)
      for (const { unit, coefficient } of residual.terms) g[unit]! += 2 * coefficient * r
    }
    return g
  }

  let y = z
  let t = 1
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const g = gradient(y)
    const next = project(
      y.map((value, i) => value - step * g[i]!),
      rows,
    )
    let change = 0
    let ascent = 0
    for (let i = 0; i < next.length; i++) {
      change = Math.max(change, Math.abs(next[i]! - z[i]!))
      ascent += g[i]! * (next[i]! - z[i]!)
    }
    const tNext = ascent > 0 ? 1 : (1 + Math.sqrt(1 + 4 * t * t)) / 2
    const momentum = ascent > 0 ? 0 : (t - 1) / tNext
    y = next.map((value, i) => value + momentum * (value - z[i]!))
    z = next
    t = tNext
    if (change < TOLERANCE) break
  }
  return z
}

/** Nearest unit positions (least squares) in which every row keeps its minimal gaps. */
function project(point: number[], rows: Array<{ units: number[]; gaps: number[] }>): number[] {
  const result = [...point]
  for (const { units, gaps } of rows) {
    const prefix: number[] = []
    let total = 0
    units.forEach((_, j) => {
      prefix.push(total)
      total += gaps[j] ?? 0
    })
    // Pool adjacent violators: non-decreasing fit of the positions with the gaps removed.
    const blocks: Array<{ sum: number; count: number }> = []
    units.forEach((unit, j) => {
      blocks.push({ sum: point[unit]! - prefix[j]!, count: 1 })
      while (blocks.length > 1) {
        const top = blocks[blocks.length - 1]!
        const below = blocks[blocks.length - 2]!
        if (below.sum / below.count <= top.sum / top.count) break
        blocks.pop()
        below.sum += top.sum
        below.count += top.count
      }
    })
    let j = 0
    for (const { sum, count } of blocks) {
      for (let k = 0; k < count; k++, j++) result[units[j]!] = sum / count + prefix[j]!
    }
  }
  return result
}
