import { descendantIds } from './relations.ts'
import type { FamilyData, ParentChild } from './schema.ts'

export interface RuleViolation {
  path: string
  message: string
}

export type CanResult = { ok: true } | { ok: false; reason: string }

const MAX_BIOLOGICAL_PARENTS = 2

const MSG = {
  duplicatePersonId: 'Identyfikator osoby się powtarza.',
  duplicateUnionId: 'Identyfikator związku się powtarza.',
  missingPerson: 'Wskazana osoba nie istnieje.',
  selfParent: 'Osoba nie może być swoim rodzicem.',
  duplicateParentChild: 'Ta relacja rodzic–dziecko już istnieje.',
  tooManyBiologicalParents: 'Osoba może mieć najwyżej dwoje rodziców biologicznych.',
  cycle: 'Osoba nie może być swoim własnym przodkiem.',
  selfUnion: 'Związek musi łączyć dwie różne osoby.',
  duplicateUnion: 'Ta para ma już związek.',
} as const

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const edgeKey = (r: Pick<ParentChild, 'parentId' | 'childId'>) => `${r.parentId}|${r.childId}`

export function hasParentEdge(data: FamilyData, parentId: string, childId: string): boolean {
  return data.parentChild.some((r) => r.parentId === parentId && r.childId === childId)
}

function duplicateIdViolations(
  ids: string[],
  collection: string,
  message: string,
): RuleViolation[] {
  const seen = new Set<string>()
  const violations: RuleViolation[] = []
  ids.forEach((id, i) => {
    if (seen.has(id)) violations.push({ path: `${collection}[${i}].id`, message })
    seen.add(id)
  })
  return violations
}

function parentChildViolations(data: FamilyData, personIds: Set<string>): RuleViolation[] {
  const violations: RuleViolation[] = []
  const seenEdges = new Set<string>()
  const biologicalCount = new Map<string, number>()

  data.parentChild.forEach((r, i) => {
    const path = `parentChild[${i}]`
    const before = violations.length
    if (!personIds.has(r.parentId))
      violations.push({ path: `${path}.parentId`, message: MSG.missingPerson })
    if (!personIds.has(r.childId))
      violations.push({ path: `${path}.childId`, message: MSG.missingPerson })
    if (violations.length > before) return

    if (r.parentId === r.childId) {
      violations.push({ path, message: MSG.selfParent })
      return
    }
    if (seenEdges.has(edgeKey(r))) {
      violations.push({ path, message: MSG.duplicateParentChild })
      return
    }
    seenEdges.add(edgeKey(r))

    if (r.type === 'biological') {
      const count = (biologicalCount.get(r.childId) ?? 0) + 1
      biologicalCount.set(r.childId, count)
      if (count > MAX_BIOLOGICAL_PARENTS)
        violations.push({ path, message: MSG.tooManyBiologicalParents })
    }
  })

  return violations
}

// Depth-first search with white/gray/black colouring; an edge into a gray node closes a cycle.
function cycleViolations(data: FamilyData): RuleViolation[] {
  const edgesByParent = new Map<string, Array<{ childId: string; index: number }>>()
  data.parentChild.forEach((r, index) => {
    if (r.parentId === r.childId) return
    const edges = edgesByParent.get(r.parentId) ?? []
    edges.push({ childId: r.childId, index })
    edgesByParent.set(r.parentId, edges)
  })

  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  const violations: RuleViolation[] = []

  const visit = (id: string) => {
    color.set(id, GRAY)
    for (const edge of edgesByParent.get(id) ?? []) {
      const state = color.get(edge.childId)
      if (state === GRAY) {
        violations.push({ path: `parentChild[${edge.index}]`, message: MSG.cycle })
      } else if (state === undefined) {
        visit(edge.childId)
      }
    }
    color.set(id, BLACK)
  }

  for (const id of edgesByParent.keys()) {
    if (!color.has(id)) visit(id)
  }
  return violations
}

function unionViolations(data: FamilyData, personIds: Set<string>): RuleViolation[] {
  const violations: RuleViolation[] = []
  const seenPairs = new Set<string>()

  data.unions.forEach((u, i) => {
    const path = `unions[${i}]`
    const before = violations.length
    u.partnerIds.forEach((id, k) => {
      if (!personIds.has(id))
        violations.push({ path: `${path}.partnerIds[${k}]`, message: MSG.missingPerson })
    })
    if (violations.length > before) return

    const [a, b] = u.partnerIds
    if (a === b) {
      violations.push({ path: `${path}.partnerIds`, message: MSG.selfUnion })
      return
    }
    if (seenPairs.has(pairKey(a, b))) {
      violations.push({ path, message: MSG.duplicateUnion })
      return
    }
    seenPairs.add(pairKey(a, b))
  })

  return violations
}

export function checkRelationRules(data: FamilyData): RuleViolation[] {
  const personIds = new Set(data.persons.map((p) => p.id))
  const violations = [
    ...duplicateIdViolations(
      data.persons.map((p) => p.id),
      'persons',
      MSG.duplicatePersonId,
    ),
    ...duplicateIdViolations(
      data.unions.map((u) => u.id),
      'unions',
      MSG.duplicateUnionId,
    ),
    ...parentChildViolations(data, personIds),
    ...cycleViolations(data),
    ...unionViolations(data, personIds),
  ]
  const selfId = data.settings.selfPersonId
  if (selfId !== undefined && !personIds.has(selfId)) {
    violations.push({ path: 'settings.selfPersonId', message: MSG.missingPerson })
  }
  return violations
}

export function canAddParent(
  data: FamilyData,
  childId: string,
  parentId: string,
  type: ParentChild['type'],
): CanResult {
  const personIds = new Set(data.persons.map((p) => p.id))
  if (!personIds.has(childId) || !personIds.has(parentId)) {
    return { ok: false, reason: MSG.missingPerson }
  }
  if (childId === parentId) return { ok: false, reason: MSG.selfParent }
  if (hasParentEdge(data, parentId, childId)) {
    return { ok: false, reason: MSG.duplicateParentChild }
  }
  if (descendantIds(data, childId).has(parentId)) return { ok: false, reason: MSG.cycle }
  if (type === 'biological') {
    const count = data.parentChild.filter(
      (r) => r.childId === childId && r.type === 'biological',
    ).length
    if (count >= MAX_BIOLOGICAL_PARENTS) {
      return { ok: false, reason: MSG.tooManyBiologicalParents }
    }
  }
  return { ok: true }
}

export function canAddUnion(data: FamilyData, aId: string, bId: string): CanResult {
  const personIds = new Set(data.persons.map((p) => p.id))
  if (!personIds.has(aId) || !personIds.has(bId)) return { ok: false, reason: MSG.missingPerson }
  if (aId === bId) return { ok: false, reason: MSG.selfUnion }
  const key = pairKey(aId, bId)
  if (data.unions.some((u) => pairKey(...u.partnerIds) === key)) {
    return { ok: false, reason: MSG.duplicateUnion }
  }
  return { ok: true }
}

export const MISSING_PERSON_MESSAGE = MSG.missingPerson
export const SIBLING_ALREADY_LINKED_MESSAGE = MSG.duplicateParentChild
