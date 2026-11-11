import { comparePersonsByName, matchesQuery } from '@/domain/person-search'
import type { FamilyData } from '@/domain/schema'
import { personNodeView } from '@/features/tree'

export interface PersonLinkResult {
  personId: string
  displayName: string
  lifeSpan: string
}

export const MAX_SEARCH_RESULTS = 10

export function searchResults(
  data: FamilyData,
  query: string,
  limit = MAX_SEARCH_RESULTS,
): PersonLinkResult[] {
  return data.persons
    .filter((person) => matchesQuery(person, query))
    .sort(comparePersonsByName)
    .slice(0, limit)
    .map((person) => {
      const { personId, displayName, lifeSpan } = personNodeView(person)
      return { personId, displayName, lifeSpan }
    })
}
