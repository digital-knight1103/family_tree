import { genDateSortKey } from './dates'
import type { FamilyData, Person, Union } from './schema'

function personsByIds(data: FamilyData, ids: Iterable<string>): Person[] {
  const wanted = new Set(ids)
  return data.persons.filter((p) => wanted.has(p.id))
}

function byBirthThenId(a: Person, b: Person): number {
  const diff = genDateSortKey(a.birth?.date) - genDateSortKey(b.birth?.date)
  if (diff !== 0 && !Number.isNaN(diff)) return diff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function parentIdsOf(data: FamilyData, personId: string): string[] {
  return data.parentChild.filter((r) => r.childId === personId).map((r) => r.parentId)
}

function childIdsOf(data: FamilyData, personId: string): string[] {
  return data.parentChild.filter((r) => r.parentId === personId).map((r) => r.childId)
}

function reachableIds(start: string, next: (personId: string) => string[]): Set<string> {
  const visited = new Set<string>()
  const queue = next(start)
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    queue.push(...next(id))
  }
  return visited
}

export function parentsOf(data: FamilyData, personId: string): Person[] {
  return personsByIds(data, parentIdsOf(data, personId))
}

export function childrenOf(data: FamilyData, personId: string): Person[] {
  return personsByIds(data, childIdsOf(data, personId)).sort(byBirthThenId)
}

export function unionsOf(data: FamilyData, personId: string): Union[] {
  return data.unions.filter((u) => u.partnerIds.includes(personId))
}

export function partnersOf(data: FamilyData, personId: string): Person[] {
  const partnerIds = unionsOf(data, personId).flatMap((u) =>
    u.partnerIds.filter((id) => id !== personId),
  )
  return personsByIds(data, partnerIds)
}

export function siblingsOf(data: FamilyData, personId: string): Person[] {
  const siblingIds = parentIdsOf(data, personId)
    .flatMap((parentId) => childIdsOf(data, parentId))
    .filter((id) => id !== personId)
  return personsByIds(data, siblingIds).sort(byBirthThenId)
}

export function ancestorIds(data: FamilyData, personId: string): Set<string> {
  return reachableIds(personId, (id) => parentIdsOf(data, id))
}

export function descendantIds(data: FamilyData, personId: string): Set<string> {
  return reachableIds(personId, (id) => childIdsOf(data, id))
}

export function isUnknownPerson(p: Person): boolean {
  return p.givenNames.trim() === '' && p.surname.trim() === ''
}
