import { connectedComponents } from './components'
import type { TreeGraph, TreeNode } from './graph'

const SWEEPS = 4

interface Row {
  /** Person node ids, left to right. */
  order: string[]
  /** Groups of partners that must stand next to each other, each in left-to-right order. */
  blocks: string[][]
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const compareNumbers = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0)

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/**
 * Orders the nodes of every row left to right, so that partners stand next to each other (the
 * partner with parents in the tree on the left, see `anchoredOrder`), siblings follow their birth
 * order and lines cross as little as possible (barycentre sweeps over blocks of partners).
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
  /** Blocks whose left-to-right order is fixed by `anchoredOrder`; the sweeps never flip them. */
  const fixed = new Set<string[]>()

  const rows = new Map<number, Row>()
  for (const node of graph.nodes) {
    if (node.kind !== 'person') continue
    const row = rows.get(node.generation) ?? { order: [], blocks: [] }
    row.order.push(node.id)
    rows.set(node.generation, row)
  }
  for (const [generation, row] of rows) row.blocks = partnerBlocks(row.order, generation)

  function partnerBlocks(order: string[], generation: number): string[][] {
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
    const blocks: string[][] = []
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
      if (anchored) fixed.add(anchored)
      blocks.push(anchored ?? walk)
    }
    return blocks

    /**
     * A block in which someone with parents in the tree has a partner without them: each such
     * partner stands to the right of the person with parents (a person with several partners has
     * all of them on the right, in the order of the unions, then by birth). Partners on the same
     * footing (both with parents or both without) take the free side, the left one first.
     * Returns `undefined` for other blocks, which the sweeps orient freely.
     */
    function anchoredOrder(members: string[]): string[] | undefined {
      const root = members.find(
        (id) => hasParents(id) && links.get(id)!.some((partner) => !hasParents(partner)),
      )
      if (!root) return undefined
      const left = new Map<string, string[]>(members.map((id) => [id, []]))
      const right = new Map<string, string[]>(members.map((id) => [id, []]))
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
          const toRight =
            hasParents(id) !== hasParents(partner) ? hasParents(id) : left.get(id)!.length > 0
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

  function reorder(row: Row, keyOf: (id: string) => number | undefined) {
    const keyed = row.blocks.map((block) => {
      const current = block.map((id) => position.get(id)!)
      let members = block
      if (!fixed.has(block)) {
        if (current[0]! > current[current.length - 1]!) members = [...block].reverse()
        const keys = members.map(keyOf)
        let trend = 0
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            if (keys[i] !== undefined && keys[j] !== undefined)
              trend += Math.sign(keys[j]! - keys[i]!)
          }
        }
        if (trend < 0) members = [...members].reverse()
      }
      const keys = members.map(keyOf)
      const known = keys.filter((k): k is number => k !== undefined)
      return {
        members,
        key: known.length > 0 ? mean(known) : mean(current),
        rank: Math.min(...members.map((id) => rank.get(id)!)),
        component: componentOf.get(members[0]!)!,
      }
    })
    keyed.sort((a, b) => a.component - b.component || a.key - b.key || a.rank - b.rank)
    row.blocks = enforceSiblingOrder(keyed.map((k) => k.members))
    row.order = row.blocks.flat()
    refresh(row)
  }

  /** Blocks holding children of one family are permuted among their slots into birth order. */
  function enforceSiblingOrder(blocks: string[][]): string[][] {
    const families = [...childrenOf.keys()].sort((a, b) => rank.get(a)! - rank.get(b)!)
    const result = [...blocks]
    for (let round = 0; round < blocks.length; round++) {
      let changed = false
      for (const family of families) {
        const children = new Set(childrenOf.get(family))
        const firstChild = (block: string[]) =>
          Math.min(...block.filter((id) => children.has(id)).map((id) => rank.get(id)!))
        const slots = result
          .map((block, i) => (block.some((id) => children.has(id)) ? i : -1))
          .filter((i) => i >= 0)
        if (slots.length < 2) continue
        const sorted = slots.map((i) => result[i]!).sort((a, b) => firstChild(a) - firstChild(b))
        slots.forEach((slot, i) => {
          if (result[slot] !== sorted[i]) changed = true
          result[slot] = sorted[i]!
        })
      }
      if (!changed) break
    }
    return result
  }

  const generations = [...rows.keys()].sort((a, b) => a - b)
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (const g of generations.slice(1)) reorder(rows.get(g)!, parentKey)
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
