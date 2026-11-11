import { isUnknownPerson } from './relations.ts'
import type { Fact, FamilyData, Union } from './schema.ts'

export type ReviewReason =
  | { kind: 'unknown' }
  | { kind: 'fact'; fact: 'birth' | 'death'; hasDate: boolean; hasPlace: boolean }
  | { kind: 'union'; unionId: string; partnerId: string; unionType: Union['type'] }

export interface ReviewEntry {
  personId: string
  reasons: ReviewReason[]
}

function factReason(name: 'birth' | 'death', fact: Fact | undefined): ReviewReason | null {
  if (fact?.unconfirmed !== true) return null
  return {
    kind: 'fact',
    fact: name,
    hasDate: fact.date !== undefined,
    hasPlace: (fact.place ?? '').trim() !== '',
  }
}

export function reviewEntries(data: FamilyData): ReviewEntry[] {
  const personIds = new Set(data.persons.map((p) => p.id))
  const entries: ReviewEntry[] = []
  for (const person of data.persons) {
    const reasons: ReviewReason[] = []
    if (isUnknownPerson(person)) reasons.push({ kind: 'unknown' })
    for (const reason of [factReason('birth', person.birth), factReason('death', person.death)]) {
      if (reason) reasons.push(reason)
    }
    for (const union of data.unions) {
      if (union.start?.unconfirmed !== true) continue
      const [first, second] = union.partnerIds
      if (person.id !== first && person.id !== second) continue
      const partnerId = person.id === first ? second : first
      if (!personIds.has(partnerId)) continue
      reasons.push({ kind: 'union', unionId: union.id, partnerId, unionType: union.type })
    }
    if (reasons.length > 0) entries.push({ personId: person.id, reasons })
  }
  return entries
}
