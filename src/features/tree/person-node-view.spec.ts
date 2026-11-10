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

  it('zaznacza fakty do potwierdzenia', () => {
    expect(
      personNodeView(person({ birth: { date: { year: 1890 }, unconfirmed: true } })).unconfirmed,
    ).toBe(true)
    expect(personNodeView(person({ death: { unconfirmed: true } })).unconfirmed).toBe(true)
  })
})
