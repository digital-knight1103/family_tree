import type { FamilyData } from '@/domain/schema'

interface Neighbour {
  id: string
  delta: number
}

/**
 * Assigns a generation number to every person: parents are one generation above their children,
 * partners share a generation. Each connected group is shifted so its oldest generation is 0.
 */
export function assignGenerations(data: FamilyData): Map<string, number> {
  const ids = data.persons.map((p) => p.id).sort()
  const known = new Set(ids)
  const parentsOf = new Map<string, string[]>()
  const adjacency = new Map<string, Neighbour[]>()
  for (const id of ids) adjacency.set(id, [])

  for (const { parentId, childId } of data.parentChild) {
    if (!known.has(parentId) || !known.has(childId)) continue
    parentsOf.set(childId, [...(parentsOf.get(childId) ?? []), parentId])
    adjacency.get(parentId)!.push({ id: childId, delta: 1 })
    adjacency.get(childId)!.push({ id: parentId, delta: -1 })
  }
  const unions: Array<[string, string]> = []
  for (const { partnerIds } of data.unions) {
    const [a, b] = partnerIds
    if (!known.has(a) || !known.has(b)) continue
    unions.push(a < b ? [a, b] : [b, a])
    adjacency.get(a)!.push({ id: b, delta: 0 })
    adjacency.get(b)!.push({ id: a, delta: 0 })
  }

  unions.sort(([a1, b1], [a2, b2]) => (a1 === a2 ? compare(b1, b2) : compare(a1, a2)))

  const result = new Map<string, number>()
  for (const start of ids) {
    if (result.has(start)) continue
    const group = collectGroup(start, adjacency, result)
    relax(group, parentsOf, unions, result)
    const min = Math.min(...group.map((id) => result.get(id)!))
    for (const id of group) result.set(id, result.get(id)! - min)
  }
  return result
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// Breadth-first from `start`; the first assignment of a person wins.
function collectGroup(
  start: string,
  adjacency: Map<string, Neighbour[]>,
  result: Map<string, number>,
): string[] {
  const group = [start]
  result.set(start, 0)
  for (let i = 0; i < group.length; i++) {
    const current = group[i]!
    const neighbours = [...adjacency.get(current)!].sort((x, y) => compare(x.id, y.id))
    for (const { id, delta } of neighbours) {
      if (result.has(id)) continue
      result.set(id, result.get(current)! + delta)
      group.push(id)
    }
  }
  return group.sort()
}

function relax(
  group: string[],
  parentsOf: Map<string, string[]>,
  unions: Array<[string, string]>,
  result: Map<string, number>,
): void {
  const members = new Set(group)
  const groupUnions = unions.filter(([a]) => members.has(a))

  const liftChildren = (): boolean => {
    let changed = false
    for (const id of group) {
      const parents = parentsOf.get(id)
      if (!parents) continue
      const needed = Math.max(...parents.map((p) => result.get(p)!)) + 1
      if (result.get(id)! < needed) {
        result.set(id, needed)
        changed = true
      }
    }
    return changed
  }

  const alignPartners = (): boolean => {
    let changed = false
    for (const [a, b] of groupUnions) {
      const top = Math.max(result.get(a)!, result.get(b)!)
      if (result.get(a)! !== top || result.get(b)! !== top) {
        result.set(a, top)
        result.set(b, top)
        changed = true
      }
    }
    return changed
  }

  // A union with a descendant has no fixed point, so the number of passes is capped.
  const limit = group.length + 1
  for (let pass = 0; pass < limit; pass++) {
    const lifted = liftChildren()
    const aligned = alignPartners()
    if (!lifted && !aligned) return
  }
  // The parent-child rule takes precedence over the partner rule.
  for (let pass = 0; pass < limit; pass++) {
    if (!liftChildren()) break
  }
}
