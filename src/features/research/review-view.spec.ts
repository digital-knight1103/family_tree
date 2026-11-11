import { describe, expect, it } from 'vitest'
import { buildFamily } from '@tests/fixtures/build-family'
import type { Fact } from '@/domain/schema'
import { reviewView } from './review-view'

function reasonsFor(birth: Fact) {
  const data = buildFamily({ persons: [{ id: 'p_1', birth }] })
  return reviewView(data)[0]?.reasons
}

describe('reviewView', () => {
  it('opisuje niepotwierdzone urodzenie według tego, co jest znane', () => {
    expect(reasonsFor({ date: { year: 1890 }, place: 'Górka', unconfirmed: true })).toEqual([
      'data i miejsce urodzenia do potwierdzenia',
    ])
    expect(reasonsFor({ date: { year: 1890 }, unconfirmed: true })).toEqual([
      'data urodzenia do potwierdzenia',
    ])
    expect(reasonsFor({ place: 'Górka', unconfirmed: true })).toEqual([
      'miejsce urodzenia do potwierdzenia',
    ])
    expect(reasonsFor({ unconfirmed: true })).toEqual(['urodzenie do potwierdzenia'])
  })

  it('opisuje śmierć, nieznaną osobę i związki', () => {
    const data = buildFamily({
      persons: [
        { id: 'p_a', givenNames: 'Jan', surname: 'Lis', death: { unconfirmed: true } },
        { id: 'p_b', givenNames: 'Ewa', surname: 'Lis' },
        { id: 'p_c', givenNames: '', surname: '', sex: 'female' },
      ],
      unions: [
        ['p_a', 'p_b'],
        ['p_a', 'p_c'],
      ],
    })
    data.unions[0]!.start = { unconfirmed: true }
    data.unions[1]!.type = 'partnership'
    data.unions[1]!.start = { unconfirmed: true }

    expect(reviewView(data).map((item) => [item.displayName, item.reasons])).toEqual([
      ['Ewa Lis', ['małżeństwo do potwierdzenia (Jan Lis)']],
      [
        'Jan Lis',
        [
          'śmierć do potwierdzenia',
          'małżeństwo do potwierdzenia (Ewa Lis)',
          'związek do potwierdzenia (Nieznana)',
        ],
      ],
      ['Nieznana', ['brak imienia i nazwiska', 'związek do potwierdzenia (Jan Lis)']],
    ])
  })

  it('notatka to pierwsza niepusta linia notatek badawczych', () => {
    const data = buildFamily({
      persons: [
        {
          id: 'p_1',
          birth: { unconfirmed: true },
          researchNotes: '\n  Sprawdzić księgi.\nDruga linia',
        },
        { id: 'p_2', birth: { unconfirmed: true } },
      ],
    })
    expect(reviewView(data).map((item) => item.note)).toEqual(['Sprawdzić księgi.', ''])
  })

  it('osoby bez powodów nie trafiają na listę', () => {
    const data = buildFamily({ persons: [{ id: 'p_1', birth: { unconfirmed: false } }] })
    expect(reviewView(data)).toEqual([])
  })
})
