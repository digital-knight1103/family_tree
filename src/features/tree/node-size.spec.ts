import { describe, expect, it } from 'vitest'
import { PERSON_NODE } from '@/domain/tree-layout'
import type { Person } from '@/domain/schema'
import { nodeTextWidth, personNodeSize, type MeasureText } from './node-size'
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

describe('personNodeSize', () => {
  it('krótka treść bez miejscowości daje rozmiar minimalny', () => {
    expect(personNodeSize(view(), perChar)).toEqual(PERSON_NODE)
  })

  it('długie imiona poszerzają węzeł o tyle, ile trzeba', () => {
    const short = personNodeSize(view({ givenNames: 'Maria Magdalena Antonina' }), perChar)
    const long = personNodeSize(
      view({ givenNames: 'Maria Magdalena Antonina Franciszka' }),
      perChar,
    )
    expect(short.width).toBeGreaterThan(PERSON_NODE.width)
    expect(long.width - short.width).toBe(110)
  })

  it('najszersza z trzech linii decyduje, także nazwisko rodowe', () => {
    const maiden = personNodeSize(
      view({ surname: 'Nowak', maidenName: 'Szczepańska-Wiśniewska', sex: 'female' }),
      perChar,
    )
    expect(maiden.width).toBeGreaterThan(PERSON_NODE.width)
  })

  it('miejscowość nie poszerza węzła, tylko dodaje linie', () => {
    const one = personNodeSize(view({ birth: { place: 'Górki' } }), perChar)
    expect(one).toEqual({ width: PERSON_NODE.width, height: PERSON_NODE.height + 14 })

    const area = nodeTextWidth(PERSON_NODE.width) - 16
    const words = Math.floor(area / 10 / 6)
    const place = Array.from({ length: words * 3 }, () => 'Abcde').join(' ')
    const wrapped = personNodeSize(view({ birth: { place } }), perChar)
    expect(wrapped.width).toBe(PERSON_NODE.width)
    expect(wrapped.height).toBeGreaterThanOrEqual(PERSON_NODE.height + 3 * 14)
  })

  it('bardzo długie słowo w miejscowości łamie się na kilka linii', () => {
    const area = nodeTextWidth(PERSON_NODE.width) - 16
    const place = 'x'.repeat(Math.ceil((area * 2.5) / 10))
    expect(personNodeSize(view({ birth: { place } }), perChar).height).toBe(
      PERSON_NODE.height + 3 * 14,
    )
  })

  it('bez przekazanego pomiaru działa przybliżenie', () => {
    expect(personNodeSize(view()).width).toBeGreaterThanOrEqual(PERSON_NODE.width)
  })
})
