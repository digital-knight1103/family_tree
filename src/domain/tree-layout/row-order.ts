import { connectedComponents } from './components'
import type { TreeGraph, TreeNode } from './graph'

const SWEEPS = 4

/** A group of partners that must stand next to each other. */
interface Unit {
  /** Person node ids in their current left-to-right order. */
  members: string[]
  /** The order is fixed by `anchoredOrder`; the sweeps never flip it. */
  fixed: boolean
  /** The members' own families (see `familyOf`), without repeats, in the order of `members`. */
  families: string[]
}

/**
 * Units that stand together in one stretch of the row: the children of a family (with their
 * partners), and every family joined to it by a couple whose partners both have parents in it.
 */
interface Cluster {
  units: Unit[]
  /** The joined families in the order their blocks stand, before a possible mirroring. */
  families: string[]
}

interface Row {
  /** Person node ids, left to right. */
  order: string[]
  clusters: Cluster[]
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const compareNumbers = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0)

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/**
 * Orders the nodes of every row left to right, so that partners stand next to each other (the
 * partner with parents in the tree on the left, see `anchoredOrder`), siblings stand in one
 * unbroken block in their birth order, a couple joining two such blocks stands at their seam (see
 * `arrange`), and lines cross as little as possible (barycentre sweeps over the clusters).
 * Connected groups never interleave: each row holds the main tree first,
 * then the smaller groups in the order of `connectedComponents`.
 * Returns the graph nodes in that order; the layout engine keeps it.
 */
export function orderNodes(graph: TreeGraph): TreeNode[] {
  const rank = new Map(graph.nodes.map((n, i) => [n.id, i]))
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const componentOf = connectedComponents(graph)
  const generationOf = (id: string) => byId.get(id)!.generation

  // Families: a union node or a single parent, with its children.
  const childrenOf = new Map<string, string[]>()
  const familiesOf = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.kind !== 'child') continue
    childrenOf.set(edge.source, [...(childrenOf.get(edge.source) ?? []), edge.target])
    familiesOf.set(edge.target, [...(familiesOf.get(edge.target) ?? []), edge.source])
  }
  const unions = graph.nodes.filter(
    (n): n is Extract<TreeNode, { kind: 'union' }> => n.kind === 'union',
  )
  /** The people heading a family: both partners of a union node, or the single parent. */
  const parentsIn = (familyId: string) => {
    const node = byId.get(familyId)!
    return node.kind === 'union' ? node.partnerIds.map((id) => `person:${id}`) : [familyId]
  }
  const ownFamilies = new Map<string, string[]>()
  for (const union of unions) {
    for (const partner of parentsIn(union.id)) {
      ownFamilies.set(partner, [...(ownFamilies.get(partner) ?? []), union.id])
    }
  }
  for (const source of childrenOf.keys()) {
    if (byId.get(source)!.kind === 'person') {
      ownFamilies.set(source, [...(ownFamilies.get(source) ?? []), source])
    }
  }

  const hasParents = (id: string) => familiesOf.has(id)
  /**
   * The family whose sibling block a person belongs to: the couple of parents if there is one
   * (a further single parent, e.g. adoptive, does not hold the person in its block), else the
   * first single parent.
   */
  const familyOf = new Map<string, string>()
  for (const [child, families] of familiesOf) {
    const [own] = [...families].sort(
      (a, b) =>
        Number(byId.get(a)!.kind !== 'union') - Number(byId.get(b)!.kind !== 'union') ||
        rank.get(a)! - rank.get(b)!,
    )
    familyOf.set(child, own!)
  }

  const rowOrders = new Map<number, string[]>()
  for (const node of graph.nodes) {
    if (node.kind !== 'person') continue
    rowOrders.set(node.generation, [...(rowOrders.get(node.generation) ?? []), node.id])
  }
  const rows = new Map<number, Row>()
  for (const [generation, order] of rowOrders) {
    rows.set(generation, { order, clusters: clustersOf(partnerBlocks(order, generation)) })
  }

  function partnerBlocks(order: string[], generation: number): Unit[] {
    const links = new Map<string, string[]>(order.map((id) => [id, []]))
    const startOf = new Map<string, number>()
    const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
    for (const union of unions) {
      const [a, b] = parentsIn(union.id)
      if (!a || !b || a === b) continue
      if (generationOf(a) !== generation || generationOf(b) !== generation) continue
      const key = pair(a, b)
      if (!startOf.has(key)) {
        links.get(a)!.push(b)
        links.get(b)!.push(a)
      }
      startOf.set(key, Math.min(startOf.get(key) ?? Number.POSITIVE_INFINITY, union.startKey))
    }
    for (const list of links.values()) list.sort((x, y) => rank.get(x)! - rank.get(y)!)
    const seen = new Set<string>()
    const blocks: Unit[] = []
    for (const start of order) {
      if (seen.has(start)) continue
      const component: string[] = []
      const stack = [start]
      seen.add(start)
      while (stack.length > 0) {
        const id = stack.pop()!
        component.push(id)
        for (const next of links.get(id)!) {
          if (!seen.has(next)) {
            seen.add(next)
            stack.push(next)
          }
        }
      }
      // Walk the chain from an end (a partner with one link), so neighbours stay adjacent.
      component.sort((x, y) => rank.get(x)! - rank.get(y)!)
      const first = component.find((id) => links.get(id)!.length <= 1) ?? component[0]!
      const walk: string[] = []
      const visited = new Set<string>()
      const visit = (id: string) => {
        visited.add(id)
        walk.push(id)
        for (const next of links.get(id)!) if (!visited.has(next)) visit(next)
      }
      visit(first)
      const anchored = anchoredOrder(component)
      const members = anchored ?? walk
      const families = [
        ...new Set(members.flatMap((id) => (familyOf.has(id) ? [familyOf.get(id)!] : []))),
      ]
      blocks.push({ members, fixed: anchored !== undefined, families })
    }
    return blocks

    /**
     * A block in which someone with parents in the tree has a partner without them: each such
     * partner stands to the right of the person with parents (a person with several partners has
     * all of them on the right, in the order of the unions, then by birth). Partners on the same
     * footing (both with parents or both without) take the free side, the left one first.
     * A partner of a partner stands on the outer side, so a couple is never split.
     * Returns `undefined` for other blocks, which the sweeps orient freely.
     */
    function anchoredOrder(members: string[]): string[] | undefined {
      const root = members.find(
        (id) => hasParents(id) && links.get(id)!.some((partner) => !hasParents(partner)),
      )
      if (!root) return undefined
      const left = new Map<string, string[]>(members.map((id) => [id, []]))
      const right = new Map<string, string[]>(members.map((id) => [id, []]))
      /** The side each placed partner took next to the person it was attached to. */
      const sideOf = new Map<string, 'left' | 'right'>()
      const queue = [root]
      const placed = new Set(queue)
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i]!
        const partners = links
          .get(id)!
          .filter((partner) => !placed.has(partner))
          .sort(
            (x, y) =>
              compareNumbers(startOf.get(pair(id, x))!, startOf.get(pair(id, y))!) ||
              rank.get(x)! - rank.get(y)!,
          )
        for (const partner of partners) {
          placed.add(partner)
          queue.push(partner)
          // The side facing the person `id` was attached to is taken, so its partners go outward.
          const outward = sideOf.get(id)
          const toRight = outward
            ? outward === 'right'
            : hasParents(id) !== hasParents(partner)
              ? hasParents(id)
              : left.get(id)!.length > 0
          sideOf.set(partner, toRight ? 'right' : 'left')
          ;(toRight ? right : left).get(id)!.push(partner)
        }
      }
      const render = (id: string): string[] => [
        ...[...left.get(id)!].reverse().flatMap(render),
        id,
        ...right.get(id)!.flatMap(render),
      ]
      return render(root)
    }
  }

  /**
   * Groups the units of a row into clusters: units sharing a family belong together, and a unit
   * holding children of several families (a couple whose partners both have parents in the tree)
   * joins those families into one cluster. Within a cluster the families are lined up by a
   * depth-first walk over "partners from two families stand next to each other", starting from an
   * end of that chain (the one whose parents come first, `rank`), so in a chain of families each
   * joining couple can stand at the seam of two neighbouring blocks.
   */
  function clustersOf(units: Unit[]): Cluster[] {
    const root = new Map<string, string>()
    const find = (family: string): string => {
      const parent = root.get(family)!
      return parent === family ? family : find(parent)
    }
    for (const unit of units) for (const family of unit.families) root.set(family, family)
    const neighbours = new Map<string, Set<string>>()
    for (const unit of units) {
      for (const family of unit.families.slice(1)) root.set(find(family), find(unit.families[0]!))
      const joined = unit.members.flatMap((id) => (familyOf.has(id) ? [familyOf.get(id)!] : []))
      for (let i = 1; i < joined.length; i++) {
        const [a, b] = [joined[i - 1]!, joined[i]!]
        if (a === b) continue
        neighbours.set(a, (neighbours.get(a) ?? new Set()).add(b))
        neighbours.set(b, (neighbours.get(b) ?? new Set()).add(a))
      }
    }
    const byRank = (a: string, b: string) => rank.get(a)! - rank.get(b)!
    const clusters: Cluster[] = []
    const clusterOf = new Map<string, Cluster>()
    for (const unit of units) {
      if (unit.families.length === 0) {
        clusters.push({ units: [unit], families: [] })
        continue
      }
      const key = find(unit.families[0]!)
      let cluster = clusterOf.get(key)
      if (!cluster) {
        cluster = { units: [], families: [] }
        clusterOf.set(key, cluster)
        clusters.push(cluster)
      }
      cluster.units.push(unit)
    }
    for (const cluster of clusters) {
      const families = [...new Set(cluster.units.flatMap((u) => u.families))].sort(byRank)
      const degree = (family: string) => neighbours.get(family)?.size ?? 0
      const start = families.find((family) => degree(family) <= 1) ?? families[0]
      const visit = (family: string) => {
        cluster.families.push(family)
        for (const next of [...(neighbours.get(family) ?? [])].sort(byRank)) {
          if (!cluster.families.includes(next)) visit(next)
        }
      }
      if (start) visit(start)
    }
    return clusters
  }

  const position = new Map<string, number>()
  const refresh = (row: Row) => row.order.forEach((id, i) => position.set(id, i))
  for (const row of rows.values()) refresh(row)

  /** Position of a family: the middle of its partners, or the single parent. */
  const familyPosition = (familyId: string) =>
    mean(parentsIn(familyId).map((p) => position.get(p)!))
  const parentKey = (personId: string) => {
    const families = familiesOf.get(personId) ?? []
    return families.length > 0 ? mean(families.map(familyPosition)) : undefined
  }
  const childKey = (personId: string) => {
    const keys = (ownFamilies.get(personId) ?? [])
      .map((f) => childrenOf.get(f) ?? [])
      .filter((children) => children.length > 0)
      .map((children) => mean(children.map((c) => position.get(c)!)))
    return keys.length > 0 ? mean(keys) : undefined
  }

  type KeyOf = (id: string) => number | undefined

  /** Mean of the members' keys, or of their current positions when none of them has a key. */
  const keyOfAll = (members: string[], keyOf: KeyOf) => {
    const known = members.map(keyOf).filter((k): k is number => k !== undefined)
    return known.length > 0 ? mean(known) : mean(members.map((id) => position.get(id)!))
  }

  /** A free unit keeps its current orientation unless its keys run the other way. */
  function orient(unit: Unit, keyOf: KeyOf) {
    if (unit.fixed) return
    const current = unit.members.map((id) => position.get(id)!)
    if (current[0]! > current[current.length - 1]!) unit.members = [...unit.members].reverse()
    const keys = unit.members.map(keyOf)
    let trend = 0
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (keys[i] !== undefined && keys[j] !== undefined) trend += Math.sign(keys[j]! - keys[i]!)
      }
    }
    if (trend < 0) unit.members = [...unit.members].reverse()
  }

  /** A unit with the order its members take. */
  type Placed = { unit: Unit; members: string[] }

  /**
   * The units of a cluster left to right (spec §6.4, sibling-block rules 1 and 2), each with its
   * members in their new order. Every family in `cluster.families` gets one run of units in the
   * birth order of its children in them, except that the units it shares with the next family in
   * the walk stand at the run's end facing that family, so a joining couple stands at the seam.
   * The runs go left to right or, mirrored, right to left (each run keeping its birth order).
   * The direction comes from the first fixed-order unit joining two neighbouring families, else
   * (with `preferBirthOrder`) from whichever direction leaves fewer siblings out of birth order,
   * else from the keys of the first and the last family. A free joining unit turns so each
   * partner faces their own family. Where one row cannot keep every family whole (a person
   * joined to two other families, or a family joined to three), the walk's earlier families do.
   */
  function arrange(cluster: Cluster, keyOf: KeyOf, preferBirthOrder: boolean): Placed[] {
    const families = cluster.families
    if (families.length === 0) return cluster.units.map((unit) => ({ unit, members: unit.members }))
    const birthIn = (unit: Unit, family: string) =>
      Math.min(
        ...unit.members.filter((id) => familyOf.get(id) === family).map((id) => rank.get(id)!),
      )
    const placed = new Set<Unit>()
    const runs = families.map((family, i) => {
      const next = families[i + 1]
      const own = cluster.units
        .filter((unit) => !placed.has(unit) && unit.families.includes(family))
        .sort((a, b) => birthIn(a, family) - birthIn(b, family))
      for (const unit of own) placed.add(unit)
      const toNext = own.filter((unit) => next !== undefined && unit.families.includes(next))
      return { rest: own.filter((unit) => !toNext.includes(unit)), toNext }
    })

    const lineUp = (mirror: boolean) => {
      const units = mirror
        ? [...runs].reverse().flatMap((run) => [...run.toNext, ...run.rest])
        : runs.flatMap((run) => [...run.rest, ...run.toNext])
      const sideOf = new Map(families.map((family, i) => [family, mirror ? -i : i]))
      return units.map((unit) => {
        if (unit.fixed || unit.families.length < 2) return { unit, members: unit.members }
        const sides = unit.members.flatMap((id) =>
          familyOf.has(id) ? [sideOf.get(familyOf.get(id)!)!] : [],
        )
        const turned = sides[0]! > sides[sides.length - 1]!
        return { unit, members: turned ? [...unit.members].reverse() : unit.members }
      })
    }
    /** Pairs of siblings standing against their birth order. */
    const inversions = (placed: Placed[]) => {
      const order = placed.flatMap((p) => p.members).filter((id) => familyOf.has(id))
      let count = 0
      for (let i = 0; i < order.length; i++) {
        for (let j = i + 1; j < order.length; j++) {
          const [a, b] = [order[i]!, order[j]!]
          if (familyOf.get(a) === familyOf.get(b) && rank.get(a)! > rank.get(b)!) count++
        }
      }
      return count
    }

    let mirror = anchoredDirection(cluster)
    if (mirror === undefined && preferBirthOrder) {
      const [forward, backward] = [inversions(lineUp(false)), inversions(lineUp(true))]
      if (forward !== backward) mirror = backward < forward
    }
    if (mirror === undefined) {
      const keyOfFamily = (family: string) =>
        keyOfAll(
          cluster.units.flatMap((unit) => unit.members.filter((id) => familyOf.get(id) === family)),
          keyOf,
        )
      mirror = keyOfFamily(families[0]!) > keyOfFamily(families[families.length - 1]!)
    }
    return lineUp(mirror)
  }

  /**
   * Whether the first unit with a fixed order that joins two neighbouring families of the walk
   * has them the other way round; `undefined` without such a unit.
   */
  function anchoredDirection(cluster: Cluster): boolean | undefined {
    const families = cluster.families
    for (let i = 1; i < families.length; i++) {
      const [left, right] = [families[i - 1]!, families[i]!]
      const anchor = cluster.units.find(
        (unit) => unit.fixed && unit.families.includes(left) && unit.families.includes(right),
      )
      if (!anchor) continue
      const at = (family: string) => anchor.members.findIndex((id) => familyOf.get(id) === family)
      return at(left) > at(right)
    }
    return undefined
  }

  function reorder(row: Row, keyOf: KeyOf, preferBirthOrder = false) {
    for (const cluster of row.clusters) for (const unit of cluster.units) orient(unit, keyOf)
    const keyed = row.clusters.map((cluster) => {
      const placed = arrange(cluster, keyOf, preferBirthOrder)
      for (const { unit, members } of placed) unit.members = members
      const members = placed.flatMap((p) => p.members)
      return {
        members,
        key: keyOfAll(members, keyOf),
        rank: Math.min(...members.map((id) => rank.get(id)!)),
        component: componentOf.get(members[0]!)!,
      }
    })
    keyed.sort((a, b) => a.component - b.component || a.key - b.key || a.rank - b.rank)
    row.order = keyed.flatMap((k) => k.members)
    refresh(row)
  }

  const generations = [...rows.keys()].sort((a, b) => a - b)
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    // The first pass may turn a cluster to keep birth order; the parents then follow it.
    for (const g of generations.slice(1)) reorder(rows.get(g)!, parentKey, sweep === 0)
    for (const g of generations.slice(0, -1).reverse()) reorder(rows.get(g)!, childKey)
  }
  for (const g of generations.slice(1)) reorder(rows.get(g)!, parentKey)

  const order = new Map<string, number>()
  for (const row of rows.values()) row.order.forEach((id, i) => order.set(id, i))
  for (const union of unions) order.set(union.id, familyPosition(union.id))
  return [...graph.nodes].sort(
    (a, b) =>
      a.generation - b.generation ||
      Number(a.kind === 'union') - Number(b.kind === 'union') ||
      componentOf.get(a.id)! - componentOf.get(b.id)! ||
      order.get(a.id)! - order.get(b.id)! ||
      compare(a.id, b.id),
  )
}
