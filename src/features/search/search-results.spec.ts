import { describe, expect, it } from 'vitest'
import { buildFamily } from '@tests/fixtures/build-family'
import { searchResults } from './search-results'

const data = buildFamily({
  persons: [
    {
      id: 'p_ewa',
      givenNames: 'Ewa',
      surname: 'Wiśniewska',
      birth: { date: { year: 1950 } },
      death: { date: { year: 2010 } },
    },
    { id: 'p_jan', givenNames: 'Jan', surname: 'Łukasik' },
    { id: 'p_adam', givenNames: 'Adam', surname: 'Łukasik' },
    { id: 'p_anna', givenNames: 'Anna', surname: 'Lis' },
  ],
})

describe('searchResults', () => {
  it('ignoruje wielkość liter i polskie znaki', () => {
    for (const query of ['wisniewska', 'Wiśniewska', 'WIŚNIEWSKA']) {
      expect(searchResults(data, query)).toEqual([
        { personId: 'p_ewa', displayName: 'Ewa Wiśniewska', lifeSpan: '1950 – 2010' },
      ])
    }
  })

  it('„lukasik” znajduje „Łukasik”, wyniki po nazwisku i imionach', () => {
    expect(searchResults(data, 'lukasik').map((r) => r.personId)).toEqual(['p_adam', 'p_jan'])
    expect(searchResults(data, 'l').map((r) => r.personId)).toEqual(['p_anna', 'p_adam', 'p_jan'])
  })

  it('zapytanie bez liter nic nie znajduje', () => {
    expect(searchResults(data, '   ')).toEqual([])
    expect(searchResults(data, ' - ')).toEqual([])
  })

  it('zwraca najwyżej 10 wyników', () => {
    const many = buildFamily({
      persons: Array.from({ length: 12 }, (_, i) => ({ id: `p_${i}`, surname: 'Nowak' })),
    })
    expect(searchResults(many, 'nowak')).toHaveLength(10)
  })
})
