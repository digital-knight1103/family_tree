import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeForSearch } from './person-search.ts'
import type { Person } from './schema.ts'

function person(givenNames: string, surname: string, maidenName?: string): Person {
  return { id: 'p_a', givenNames, surname, maidenName, sex: 'unknown', living: false }
}

describe('normalizeForSearch', () => {
  it('zamienia na małe litery i usuwa polskie znaki', () => {
    expect(normalizeForSearch('ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż')).toBe('acelnoszz acelnoszz')
  })
})

describe('matchesQuery', () => {
  it('ignoruje wielkość liter i polskie znaki', () => {
    expect(matchesQuery(person('Anna', 'Wiśniewska'), 'wisniewska')).toBe(true)
  })

  it('każde słowo zapytania jest początkiem słowa osoby', () => {
    expect(matchesQuery(person('Jan', 'Kowalczyk'), 'jan kow')).toBe(true)
    expect(matchesQuery(person('Jan', 'Kowalczyk'), 'kow jan')).toBe(true)
    expect(matchesQuery(person('Jan', 'Kowalczyk'), 'jan nowak')).toBe(false)
  })

  it('środek słowa nie pasuje', () => {
    expect(matchesQuery(person('Jan', 'Kowalczyk'), 'owal')).toBe(false)
  })

  it('szuka też po drugim imieniu i nazwisku rodowym', () => {
    expect(matchesQuery(person('Anna Maria', 'Nowak', 'Łukasik'), 'mar')).toBe(true)
    expect(matchesQuery(person('Anna', 'Nowak', 'Łukasik'), 'luk')).toBe(true)
  })

  it('puste zapytanie nic nie znajduje', () => {
    expect(matchesQuery(person('Jan', 'Kowalczyk'), '  ')).toBe(false)
  })
})
