import type { TreeGraph } from './graph'

/**
 * Numbers the connected groups of the graph, which are laid out left to right in that order: the
 * group with the most people first (the main tree), ties by the earliest node in graph order,
 * which does not depend on the order of the input arrays.
 */
export function connectedComponents(graph: TreeGraph): Map<string, number> {
  const parent = new Map(graph.nodes.map((n) => [n.id, n.id]))
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    for (let at = id; at !== root;) {
      const next = parent.get(at)!
      parent.set(at, root)
      at = next
    }
    return root
  }
  for (const edge of graph.edges) parent.set(find(edge.source), find(edge.target))

  const groups = new Map<string, { people: number; first: number; ids: string[] }>()
  graph.nodes.forEach((node, index) => {
    const root = find(node.id)
    const group = groups.get(root) ?? { people: 0, first: index, ids: [] }
    group.ids.push(node.id)
    if (node.kind === 'person') group.people++
    groups.set(root, group)
  })
  const ordered = [...groups.values()].sort((a, b) => b.people - a.people || a.first - b.first)
  const result = new Map<string, number>()
  ordered.forEach((group, index) => group.ids.forEach((id) => result.set(id, index)))
  return result
}
