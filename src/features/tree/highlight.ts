import { childrenOf, parentsOf, partnersOf, siblingsOf } from '@/domain/relations'
import type { FamilyData } from '@/domain/schema'
import type { RoutedEdge } from '@/domain/tree-layout'

export type RelativeGroup = 'parent' | 'sibling' | 'partner' | 'child'

/** How a node looks while someone is selected; `undefined` means as usual. */
export type NodeHighlight = RelativeGroup | 'dimmed' | undefined

/** The closest relatives of a person by group; a person in two groups keeps the first one. */
export function closestRelatives(data: FamilyData, personId: string): Map<string, RelativeGroup> {
  const groups = new Map<string, RelativeGroup>()
  const add = (group: RelativeGroup, people: Array<{ id: string }>) => {
    for (const person of people) if (!groups.has(person.id)) groups.set(person.id, group)
  }
  add('parent', parentsOf(data, personId))
  add('partner', partnersOf(data, personId))
  add('child', childrenOf(data, personId))
  add('sibling', siblingsOf(data, personId))
  groups.delete(personId)
  return groups
}

/**
 * Layout nodes that stay bright around the selected person: the person, the family nodes it
 * comes from, its own union nodes and the other unions of its parents that have children (the
 * lines to half-siblings). Edges touching one of them stay bright too.
 */
export function focusNodeIds(edges: RoutedEdge[], personId: string): Set<string> {
  const self = `person:${personId}`
  const ids = new Set([self])
  const origins = new Set<string>()
  for (const edge of edges) {
    if (edge.kind === 'child' && edge.target === self) origins.add(edge.source)
    if (edge.kind === 'partner' && edge.source === self) ids.add(edge.target)
  }
  const parents = new Set([...origins].filter((id) => id.startsWith('person:')))
  for (const edge of edges) {
    if (edge.kind === 'partner' && origins.has(edge.target)) parents.add(edge.source)
  }
  const families = new Set(edges.filter((edge) => edge.kind === 'child').map((e) => e.source))
  for (const edge of edges) {
    if (edge.kind === 'partner' && parents.has(edge.source) && families.has(edge.target)) {
      ids.add(edge.target)
    }
  }
  for (const id of origins) ids.add(id)
  return ids
}
