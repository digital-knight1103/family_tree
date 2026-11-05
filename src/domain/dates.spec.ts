import { describe, expect, it } from 'vitest'
import { isValidGenDate, parseGenDate, type GenDate } from '@/domain/dates'

describe('parseGenDate', () => {
  it.each<[string, GenDate]>([
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
  ])('parsuje %j', (input, expected) => {
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
