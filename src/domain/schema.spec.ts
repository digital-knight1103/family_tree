import { describe, expect, it } from 'vitest'
import { emptyFamilyData, familyDataSchema, type FamilyData } from '@/domain/schema'

const MINIMAL_PERSON = { id: 'p_1', givenNames: '', surname: '', sex: 'unknown', living: false }
const SECOND_PERSON = { ...MINIMAL_PERSON, id: 'p_2' }

function withData(overrides: Record<string, unknown>): unknown {
  return { ...emptyFamilyData(), ...overrides }
}

function firstIssuePath(data: unknown): PropertyKey[] {
  const result = familyDataSchema.safeParse(data)
  expect(result.success).toBe(false)
  return result.success ? [] : result.error.issues[0]!.path
}

describe('familyDataSchema', () => {
  it('akceptuje puste dane', () => {
    const data: FamilyData = emptyFamilyData()
    expect(data.revision).toBe(0)
    expect(familyDataSchema.safeParse(data).success).toBe(true)
  })

  it('akceptuje minimalną osobę', () => {
    expect(familyDataSchema.safeParse(withData({ persons: [MINIMAL_PERSON] })).success).toBe(true)
  })

  it('akceptuje pełne dane z relacjami i faktami', () => {
    const data = withData({
      settings: { selfPersonId: 'p_1' },
      persons: [
        {
          ...MINIMAL_PERSON,
          givenNames: 'Józef',
          surname: 'Nowak',
          maidenName: '',
          sex: 'male',
          birth: { date: { year: 1890, qualifier: 'about' }, place: 'Lwów', unconfirmed: true },
          death: { date: { year: 1958, month: 3, day: 12 } },
          bio: 'opis',
          researchNotes: 'notatki',
          photo: 'p_1.webp',
        },
        SECOND_PERSON,
      ],
      parentChild: [{ parentId: 'p_1', childId: 'p_2', type: 'biological' }],
      unions: [
        {
          id: 'u_1',
          partnerIds: ['p_1', 'p_2'],
          type: 'marriage',
          start: { date: { year: 1920 } },
          end: { date: { year: 1950 } },
        },
      ],
    })
    expect(familyDataSchema.safeParse(data).success).toBe(true)
  })

  it('odrzuca nieznaną płeć', () => {
    expect(firstIssuePath(withData({ persons: [{ ...MINIMAL_PERSON, sex: 'x' }] }))).toEqual([
      'persons',
      0,
      'sex',
    ])
  })

  it('odrzuca niepoprawną datę urodzenia', () => {
    const person = { ...MINIMAL_PERSON, birth: { date: { year: 1921, day: 5 } } }
    expect(firstIssuePath(withData({ persons: [person] }))).toContain('date')
  })

  it('odrzuca nieznany klucz', () => {
    const person = { ...MINIMAL_PERSON, nazwisko: 'Nowak' }
    expect(firstIssuePath(withData({ persons: [person] }))).toEqual(['persons', 0])
  })

  it('opisuje wbudowane błędy po polsku', () => {
    const person = { ...MINIMAL_PERSON, sex: 'x', nazwisko: 'Nowak' }
    const result = familyDataSchema.safeParse(withData({ persons: [person], revision: '5' }))
    expect(result.success).toBe(false)
    const messages = result.success ? [] : result.error.issues.map((i) => i.message)
    expect(messages.some((m) => m.includes('nazwisko') && /Nierozpoznan/.test(m))).toBe(true)
    for (const message of messages) expect(message).not.toMatch(/Invalid|Unrecognized|expected/)
  })

  it('odrzuca inną wersję schematu', () => {
    expect(firstIssuePath(withData({ version: 2 }))).toEqual(['version'])
  })

  it('odrzuca ujemną rewizję', () => {
    expect(firstIssuePath(withData({ revision: -1 }))).toEqual(['revision'])
  })

  it('odrzuca związek z jednym partnerem', () => {
    const union = { id: 'u_1', partnerIds: ['p_1'], type: 'marriage' }
    expect(firstIssuePath(withData({ unions: [union] }))).toEqual(['unions', 0, 'partnerIds'])
  })

  it('odrzuca niepoprawny identyfikator osoby', () => {
    const person = { ...MINIMAL_PERSON, id: 'osoba 1' }
    expect(firstIssuePath(withData({ persons: [person] }))).toEqual(['persons', 0, 'id'])
  })

  it('odrzuca niepoprawny identyfikator związku', () => {
    const union = { id: 'x_1', partnerIds: ['p_1', 'p_2'], type: 'marriage' }
    expect(firstIssuePath(withData({ unions: [union] }))).toEqual(['unions', 0, 'id'])
  })

  it('odrzuca nazwę zdjęcia ze ścieżką', () => {
    const person = { ...MINIMAL_PERSON, photo: '../x.webp' }
    expect(firstIssuePath(withData({ persons: [person] }))).toEqual(['persons', 0, 'photo'])
  })

  it.each(['CON.webp', 'x.webp'])('odrzuca nazwę zdjęcia %s bez prefiksu p_', (photo) => {
    const person = { ...MINIMAL_PERSON, photo }
    expect(firstIssuePath(withData({ persons: [person] }))).toEqual(['persons', 0, 'photo'])
  })
})
