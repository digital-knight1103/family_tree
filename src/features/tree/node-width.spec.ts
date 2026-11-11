import { describe, expect, it } from 'vitest'
import { PERSON_NODE } from '@/domain/tree-layout'
import type { Person } from '@/domain/schema'
import { personNodeWidth, type MeasureText } from './node-width'
import { personNodeView } from './person-node-view'

const perChar: MeasureText = (text) => text.length * 10

function view(overrides: Partial<Person> = {}) {
  return personNodeView({
    id: 'p_a',
    givenNames: 'Jan',
    surname: 'Nowak',
    sex: 'male',
    living: true,
    ...overrides,
  })
}

describe('personNodeWidth', () => {
  it('krótka treść daje szerokość minimalną', () => {
    expect(personNodeWidth(view(), perChar)).toBe(PERSON_NODE.width)
  })

  it('długie imiona poszerzają węzeł o tyle, ile trzeba', () => {
    const short = personNodeWidth(view({ givenNames: 'Maria Magdalena Antonina' }), perChar)
    const long = personNodeWidth(
      view({ givenNames: 'Maria Magdalena Antonina Franciszka' }),
      perChar,
    )
    expect(short).toBeGreaterThan(PERSON_NODE.width)
    expect(long - short).toBe(110)
  })

  it('najszersza z trzech linii decyduje, także nazwisko rodowe i daty', () => {
    const maiden = personNodeWidth(
      view({ surname: 'Nowak', maidenName: 'Szczepańska-Wiśniewska', sex: 'female' }),
      perChar,
    )
    expect(maiden).toBeGreaterThan(PERSON_NODE.width)
  })

  it('bez przekazanego pomiaru działa przybliżenie', () => {
    expect(personNodeWidth(view())).toBeGreaterThanOrEqual(PERSON_NODE.width)
  })
})
