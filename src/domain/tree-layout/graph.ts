import { genDateSortKey } from '@/domain/dates'
import type { FamilyData } from '@/domain/schema'
import { assignGenerations } from './generations'

export type TreeNode =
  | { id: string; kind: 'person'; personId: string; generation: number }
  | {
      id: string
      kind: 'union'
      unionId: string | null
      partnerIds: [string, string]
      /** Sort key of the union start date (`genDateSortKey`), infinite when unknown. */
      startKey: number
      generation: number
    }

export interface TreeEdge {
  id: string
  kind: 'partner' | 'child'
  source: string
  target: string
}

export interface TreeGraph {
  nodes: TreeNode[]
  edges: TreeEdge[]
}

type UnionNode = Extract<TreeNode, { kind: 'union' }>

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const personNodeId = (id: string) => `person:${id}`

/**
 * Builds the graph the layout engine consumes: person nodes, one node per union (or per pair of
 * parents without a union record), partner edges into union nodes and child edges out of them.
 * The output order does not depend on the order of the input arrays.
 */
export function buildTreeGraph(data: FamilyData): TreeGraph {
  const generations = assignGenerations(data)
  const people = [...data.persons].sort(
    (a, b) => genDateSortKey(a.birth?.date) - genDateSortKey(b.birth?.date) || compare(a.id, b.id),
  )
  const rank = new Map(people.map((p, i) => [p.id, i]))

  const unionNodes = new Map<string, UnionNode>()
  const unionByPair = new Map<string, UnionNode>()
  const pairKey = (a: string, b: string) => `${a}+${b}`
  const sortedPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a])

  const addUnionNode = (
    id: string,
    unionId: string | null,
    a: string,
    b: string,
    startKey = Number.POSITIVE_INFINITY,
  ): UnionNode => {
    const node: UnionNode = {
      id,
      kind: 'union',
      unionId,
      partnerIds: sortedPair(a, b),
      startKey,
      generation: Math.max(generations.get(a)!, generations.get(b)!),
    }
    unionNodes.set(id, node)
    return node
  }

  const unions = [...data.unions].sort((a, b) => compare(a.id, b.id))
  for (const { id, partnerIds, start } of unions) {
    const [a, b] = sortedPair(...partnerIds)
    if (!rank.has(a) || !rank.has(b)) continue
    const key = pairKey(a, b)
    // The union with the smallest id represents the pair.
    const node = addUnionNode(`union:${id}`, id, a, b, genDateSortKey(start?.date))
    if (!unionByPair.has(key)) unionByPair.set(key, node)
  }

  const edges = new Map<string, TreeEdge>()
  const addEdge = (kind: TreeEdge['kind'], source: string, target: string) => {
    const id = `${source}->${target}`
    if (!edges.has(id)) edges.set(id, { id, kind, source, target })
  }

  const parentsOf = new Map<string, Map<string, 'biological' | 'adoptive'>>()
  for (const { parentId, childId, type } of data.parentChild) {
    if (!rank.has(parentId) || !rank.has(childId)) continue
    const parents = parentsOf.get(childId) ?? new Map()
    if (parents.get(parentId) !== 'biological') parents.set(parentId, type)
    parentsOf.set(childId, parents)
  }

  for (const [childId, parentTypes] of parentsOf) {
    const parents = [...parentTypes.keys()].sort(
      (a, b) =>
        Number(parentTypes.get(a) === 'adoptive') - Number(parentTypes.get(b) === 'adoptive') ||
        compare(a, b),
    )
    // Among pairs with a union record: fewest adoptive partners first, then the smallest union id.
    const adoptiveIn = (node: UnionNode) =>
      node.partnerIds.filter((id) => parentTypes.get(id) === 'adoptive').length
    const better = (a: UnionNode, b: UnionNode) =>
      (adoptiveIn(a) - adoptiveIn(b) || compare(a.unionId!, b.unionId!)) < 0
    let pair: UnionNode | undefined
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const found = unionByPair.get(pairKey(...sortedPair(parents[i]!, parents[j]!)))
        if (found && (!pair || better(found, pair))) pair = found
      }
    }
    if (!pair && parents.length >= 2) {
      const [a, b] = sortedPair(parents[0]!, parents[1]!)
      const id = `couple:${a}+${b}`
      pair = unionNodes.get(id) ?? addUnionNode(id, null, a, b)
    }
    const target = personNodeId(childId)
    if (pair) addEdge('child', pair.id, target)
    for (const parentId of parents) {
      if (pair && pair.partnerIds.includes(parentId)) continue
      addEdge('child', personNodeId(parentId), target)
    }
  }

  const unionRank = (n: UnionNode) => Math.min(...n.partnerIds.map((id) => rank.get(id)!))
  for (const node of unionNodes.values()) {
    for (const partnerId of node.partnerIds) addEdge('partner', personNodeId(partnerId), node.id)
  }

  const nodes: TreeNode[] = [
    ...people.map((p): TreeNode => ({
      id: personNodeId(p.id),
      kind: 'person',
      personId: p.id,
      generation: generations.get(p.id)!,
    })),
    ...unionNodes.values(),
  ]
  const nodeKey = (n: TreeNode) => (n.kind === 'person' ? rank.get(n.personId)! : unionRank(n))
  nodes.sort(
    (a, b) =>
      a.generation - b.generation ||
      Number(a.kind === 'union') - Number(b.kind === 'union') ||
      nodeKey(a) - nodeKey(b) ||
      compare(a.id, b.id),
  )

  // Partner edges first (by partner), then child edges (by child); ties broken by id.
  const personRank = (nodeId: string) => rank.get(nodeId.slice('person:'.length)) ?? -1
  const edgeKey = (e: TreeEdge) =>
    e.kind === 'partner' ? personRank(e.source) : personRank(e.target)
  const sortedEdges = [...edges.values()].sort(
    (a, b) =>
      Number(a.kind === 'child') - Number(b.kind === 'child') ||
      edgeKey(a) - edgeKey(b) ||
      compare(a.id, b.id),
  )
  return { nodes, edges: sortedEdges }
}
