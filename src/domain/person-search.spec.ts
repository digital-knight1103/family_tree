import { describe, expect, it } from 'vitest'
import { comparePersonsByName, matchesQuery, normalizeForSearch } from './person-search.ts'
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

describe('comparePersonsByName', () => {
  function named(id: string, givenNames: string, surname: string): Person {
    return { id, givenNames, surname, sex: 'unknown', living: false }
  }
  const sorted = (list: Person[]) => [...list].sort(comparePersonsByName).map((p) => p.id)

  it('remis rozstrzyga porównanie id po kodach znaków, nie według locale', () => {
    const list = [
      named('p_a', 'A', 'Nowak'),
      named('p__', 'A', 'Nowak'),
      named('p_B', 'A', 'Nowak'),
      named('p_1', 'A', 'Nowak'),
    ]
    expect(sorted(list)).toEqual(['p_1', 'p_B', 'p__', 'p_a'])
  })

  it('sortuje po nazwisku, ł po l', () => {
    const list = [
      named('p_3', 'A', 'Mazur'),
      named('p_2', 'A', 'Łukasik'),
      named('p_1', 'A', 'Lis'),
    ]
    expect(sorted(list)).toEqual(['p_1', 'p_2', 'p_3'])
  })

  it('to samo nazwisko sortuje po imionach', () => {
    const list = [named('p_1', 'Jan', 'Nowak'), named('p_2', 'Anna', 'Nowak')]
    expect(sorted(list)).toEqual(['p_2', 'p_1'])
  })

  it('wielkość liter nie ma znaczenia', () => {
    const list = [named('p_1', 'a', 'nowak'), named('p_2', 'B', 'Nowak')]
    expect(sorted(list)).toEqual(['p_1', 'p_2'])
  })

  it('nieznana osoba jest po wszystkich', () => {
    const list = [named('p_1', '', ''), named('p_2', 'Zofia', 'Żak')]
    expect(sorted(list)).toEqual(['p_2', 'p_1'])
  })

  it('remis rozstrzyga id', () => {
    const list = [named('p_2', 'Jan', 'Nowak'), named('p_1', 'Jan', 'Nowak')]
    expect(sorted(list)).toEqual(['p_1', 'p_2'])
  })
})
