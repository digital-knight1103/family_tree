import { describe, expect, it } from 'vitest'
import type { Person } from '@/domain/schema'
import { personNodeView } from './person-node-view'

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p_a',
    givenNames: 'Jan',
    surname: 'Kowalczyk',
    sex: 'male',
    living: false,
    ...overrides,
  }
}

describe('personNodeView', () => {
  it('składa imię z nazwiskiem, lata i inicjały', () => {
    const view = personNodeView(
      person({
        birth: { date: { year: 1890 } },
        death: { date: { year: 1958 } },
      }),
    )
    expect(view).toMatchObject({
      personId: 'p_a',
      displayName: 'Jan Kowalczyk',
      lifeSpan: '1890 – 1958',
      initials: 'JK',
      sex: 'male',
      unknown: false,
      unconfirmed: false,
      maidenLine: '',
    })
  })

  it.each([
    ['male', 'Nieznany'],
    ['female', 'Nieznana'],
    ['unknown', 'Osoba nieznana'],
  ] as const)('osoba nieznana (%s) ma etykietę %s i inicjał ?', (sex, label) => {
    const view = personNodeView(person({ givenNames: '', surname: '', sex }))
    expect(view.displayName).toBe(label)
    expect(view.initials).toBe('?')
    expect(view.unknown).toBe(true)
  })

  it('podaje nazwisko rodowe, o ile różni się od nazwiska', () => {
    expect(personNodeView(person({ maidenName: 'Lis' })).maidenLine).toBe('z d. Lis')
    expect(personNodeView(person({ maidenName: 'Kowalczyk' })).maidenLine).toBe('')
    expect(personNodeView(person()).maidenLine).toBe('')
  })

  it('daje inicjał z samego imienia', () => {
    const view = personNodeView(person({ givenNames: 'Józef Marian', surname: '' }))
    expect(view.displayName).toBe('Józef Marian')
    expect(view.initials).toBe('J')
  })

  describe('linie węzła', () => {
    it('imiona w pierwszej linii, nazwisko z nazwiskiem rodowym w drugiej', () => {
      const view = personNodeView(
        person({ givenNames: 'Anna Maria', surname: 'Nowak', maidenName: 'Lis', sex: 'female' }),
      )
      expect([view.nameLine, view.surnameLine]).toEqual(['Anna Maria', 'Nowak z d. Lis'])
      expect(personNodeView(person({ surname: '', maidenName: 'Lis' })).surnameLine).toBe(
        'z d. Lis',
      )
    })

    it('osoba nieznana ma etykietę w pierwszej linii i pustą drugą', () => {
      const view = personNodeView(person({ givenNames: '', surname: '' }))
      expect([view.nameLine, view.surnameLine]).toEqual(['Nieznany', ''])
    })

    it.each([
      [
        { year: 1990, month: 3, day: 12 },
        { year: 2020, month: 11, day: 5 },
        '12.03.1990 – 05.11.2020',
      ],
      [{ year: 1890, qualifier: 'about' as const }, undefined, 'ok. 1890 – ?'],
      [{ year: 1921, month: 3 }, { year: 1980 }, '03.1921 – 1980'],
      [undefined, { year: 1950, qualifier: 'before' as const }, '? – przed 1950'],
    ])('daty w krótkim formacie: %o, %o → %s', (birth, death, expected) => {
      const view = personNodeView(
        person({
          ...(birth ? { birth: { date: birth } } : {}),
          ...(death ? { death: { date: death } } : {}),
        }),
      )
      expect(view.dates).toBe(expected)
    })

    it('osoba żyjąca z datą urodzenia ma samą datę urodzenia', () => {
      const view = personNodeView(
        person({ living: true, birth: { date: { year: 1990, month: 3, day: 12 } } }),
      )
      expect(view.dates).toBe('12.03.1990')
    })
  })

  it('zaznacza fakty do potwierdzenia', () => {
    expect(
      personNodeView(person({ birth: { date: { year: 1890 }, unconfirmed: true } })).unconfirmed,
    ).toBe(true)
    expect(personNodeView(person({ death: { unconfirmed: true } })).unconfirmed).toBe(true)
  })
})
