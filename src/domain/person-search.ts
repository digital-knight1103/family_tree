import type { Person } from './schema.ts'
import { isUnknownPerson } from './relations.ts'

export function normalizeForSearch(text: string): string {
  return text
    .toLocaleLowerCase('pl')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function words(text: string): string[] {
  return normalizeForSearch(text)
    .split(/[\s-]+/)
    .filter(Boolean)
}

export function matchesQuery(person: Person, query: string): boolean {
  const queryWords = words(query)
  if (queryWords.length === 0) return false
  const personWords = [person.givenNames, person.surname, person.maidenName ?? ''].flatMap(words)
  return queryWords.every((q) => personWords.some((w) => w.startsWith(q)))
}

function compareText(a: string, b: string): number {
  return a.trim().localeCompare(b.trim(), 'pl', { sensitivity: 'base' })
}

export function comparePersonsByName(a: Person, b: Person): number {
  const unknownA = isUnknownPerson(a)
  const unknownB = isUnknownPerson(b)
  if (unknownA !== unknownB) return unknownA ? 1 : -1
  return (
    compareText(a.surname, b.surname) ||
    compareText(a.givenNames, b.givenNames) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}
