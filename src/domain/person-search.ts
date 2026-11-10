import type { Person } from './schema.ts'

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
