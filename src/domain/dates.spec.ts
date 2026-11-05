import { describe, expect, it } from 'vitest'
import {
  formatGenDate,
  formatGenDateInput,
  formatLifeSpan,
  genDateSortKey,
  isValidGenDate,
  parseGenDate,
  type GenDate,
} from '@/domain/dates'

const VALID_INPUTS: [string, GenDate][] = [
  ['1890', { year: 1890 }],
  ['987', { year: 987 }],
  ['03.1921', { year: 1921, month: 3 }],
  ['3.1921', { year: 1921, month: 3 }],
  ['1921-03', { year: 1921, month: 3 }],
  ['12.03.1921', { year: 1921, month: 3, day: 12 }],
  ['1921-03-12', { year: 1921, month: 3, day: 12 }],
  ['29.02.2000', { year: 2000, month: 2, day: 29 }],
  ['ok. 1890', { year: 1890, qualifier: 'about' }],
  ['ok.1890', { year: 1890, qualifier: 'about' }],
  ['około 1890', { year: 1890, qualifier: 'about' }],
  ['OK 1890', { year: 1890, qualifier: 'about' }],
  ['  przed   1939 ', { year: 1939, qualifier: 'before' }],
  ['przed. 1939', { year: 1939, qualifier: 'before' }],
  ['po 1945', { year: 1945, qualifier: 'after' }],
  ['ok. 03.1921', { year: 1921, month: 3, qualifier: 'about' }],
]

describe('parseGenDate', () => {
  it.each(VALID_INPUTS)('parsuje %j', (input, expected) => {
    expect(parseGenDate(input)).toEqual({ ok: true, value: expected })
  })

  it.each([
    '',
    'abc',
    '29.02.1900',
    '31.04.2000',
    '00.1921',
    '13.1921',
    '1921-13',
    'po',
    '12.1921.5',
  ])('odrzuca %j z polskim komunikatem', (input) => {
    const result = parseGenDate(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0)
  })
})

describe('isValidGenDate', () => {
  it('odrzuca dzień bez miesiąca', () => {
    expect(isValidGenDate({ year: 1921, day: 5 })).toBe(false)
  })

  it('odrzuca rok mniejszy niż 1', () => {
    expect(isValidGenDate({ year: 0 })).toBe(false)
  })

  it('akceptuje pełną poprawną datę', () => {
    expect(isValidGenDate({ year: 1921, month: 3, day: 12 })).toBe(true)
  })
})

const GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
]
const NOMINATIVE = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
]

describe('formatGenDate', () => {
  it.each<[GenDate, string]>([
    [{ year: 1921, month: 3, day: 12 }, '12 marca 1921'],
    [{ year: 1921, month: 3 }, 'marzec 1921'],
    [{ year: 1921 }, '1921'],
    [{ year: 1890, qualifier: 'about' }, 'ok. 1890'],
    [{ year: 1939, qualifier: 'before' }, 'przed 1939'],
    [{ year: 1945, qualifier: 'after' }, 'po 1945'],
    [{ year: 1921, month: 3, qualifier: 'about' }, 'ok. marca 1921'],
    [{ year: 1921, month: 3, day: 12, qualifier: 'before' }, 'przed 12 marca 1921'],
    [{ year: 1921, month: 3, qualifier: 'before' }, 'przed marcem 1921'],
    [{ year: 1921, month: 3, qualifier: 'after' }, 'po marcu 1921'],
    [{ year: 1921, month: 11, qualifier: 'after' }, 'po listopadzie 1921'],
    [{ year: 1921, month: 2, qualifier: 'before' }, 'przed lutym 1921'],
  ])('formatuje %j jako %j', (date, expected) => {
    expect(formatGenDate(date)).toBe(expected)
  })

  it('zna wszystkie miesiące w dopełniaczu i mianowniku', () => {
    for (let month = 1; month <= 12; month++) {
      expect(formatGenDate({ year: 1921, month, day: 1 })).toBe(`1 ${GENITIVE[month - 1]} 1921`)
      expect(formatGenDate({ year: 1921, month })).toBe(`${NOMINATIVE[month - 1]} 1921`)
    }
  })
})

describe('formatLifeSpan', () => {
  it('pokazuje lata urodzenia i śmierci z kwalifikatorem', () => {
    expect(formatLifeSpan({ year: 1890, qualifier: 'about' }, { year: 1958 })).toBe(
      'ok. 1890 – 1958',
    )
  })

  it('pokazuje sam rok urodzenia, gdy brak daty śmierci', () => {
    expect(formatLifeSpan({ year: 1939, qualifier: 'before' }, undefined)).toBe('przed 1939')
  })

  it('pokazuje znak zapytania dla zmarłej osoby bez daty śmierci', () => {
    expect(formatLifeSpan({ year: 1939, qualifier: 'before' }, undefined, true)).toBe(
      'przed 1939 – ?',
    )
  })

  it('pokazuje znak zapytania zamiast nieznanej daty urodzenia', () => {
    expect(formatLifeSpan(undefined, { year: 1958 })).toBe('? – 1958')
  })

  it('zwraca pusty tekst bez dat', () => {
    expect(formatLifeSpan(undefined, undefined)).toBe('')
  })

  it('zwraca pusty tekst bez dat także dla osoby zmarłej', () => {
    expect(formatLifeSpan(undefined, undefined, true)).toBe('')
  })

  it('pomija dzień i miesiąc', () => {
    expect(formatLifeSpan({ year: 1921, month: 3, day: 12 }, { year: 1990, month: 1 })).toBe(
      '1921 – 1990',
    )
  })
})

describe('formatGenDateInput', () => {
  it.each(VALID_INPUTS)('wraca do tej samej wartości po parsowaniu %j', (_input, value) => {
    expect(parseGenDate(formatGenDateInput(value))).toEqual({ ok: true, value })
  })
})

describe('genDateSortKey', () => {
  it('sortuje datę niepełną według najwcześniejszego możliwego dnia', () => {
    expect(genDateSortKey({ year: 1921 })).toBeLessThan(genDateSortKey({ year: 1921, month: 3 }))
    expect(genDateSortKey({ year: 1921, month: 3 })).toBeLessThan(
      genDateSortKey({ year: 1921, month: 3, day: 12 }),
    )
    expect(genDateSortKey({ year: 1921, month: 12, day: 31 })).toBeLessThan(
      genDateSortKey({ year: 1922 }),
    )
  })

  it('ignoruje kwalifikator', () => {
    expect(genDateSortKey({ year: 1920, qualifier: 'before' })).toBe(genDateSortKey({ year: 1920 }))
  })

  it('stawia brak daty na końcu', () => {
    expect(genDateSortKey(undefined)).toBe(Number.POSITIVE_INFINITY)
  })
})
