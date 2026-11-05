export type DateQualifier = 'about' | 'before' | 'after'

export interface GenDate {
  year: number
  month?: number
  day?: number
  qualifier?: DateQualifier
}

export type ParseResult = { ok: true; value: GenDate } | { ok: false; error: string }

const QUALIFIER_PREFIX = /^(około|ok\.?|przed\.?|po)\s*/
const DAY_MONTH_YEAR = /^(\d{1,2})\.(\d{1,2})\.(\d{1,4})$/
const MONTH_YEAR = /^(\d{1,2})\.(\d{1,4})$/
const YEAR = /^(\d{1,4})$/
const ISO_FULL = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/
const ISO_MONTH = /^(\d{1,4})-(\d{1,2})$/

const ERROR_EMPTY = 'Wpisz datę, np. 12.03.1921, 03.1921 albo 1921.'
const ERROR_FORMAT = 'Nieznany format daty. Użyj np. 12.03.1921, 03.1921, 1921 lub „ok. 1890”.'
const ERROR_INVALID = 'Taka data nie istnieje w kalendarzu.'

function qualifierFor(prefix: string): DateQualifier {
  if (prefix.startsWith('przed')) return 'before'
  if (prefix.startsWith('po')) return 'after'
  return 'about'
}

function matchDate(text: string): GenDate | null {
  let m = DAY_MONTH_YEAR.exec(text)
  if (m) return { year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) }
  m = ISO_FULL.exec(text)
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  m = MONTH_YEAR.exec(text)
  if (m) return { year: Number(m[2]), month: Number(m[1]) }
  m = ISO_MONTH.exec(text)
  if (m) return { year: Number(m[1]), month: Number(m[2]) }
  m = YEAR.exec(text)
  if (m) return { year: Number(m[1]) }
  return null
}

export function parseGenDate(input: string): ParseResult {
  let text = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (text === '') return { ok: false, error: ERROR_EMPTY }

  let qualifier: DateQualifier | undefined
  const prefix = QUALIFIER_PREFIX.exec(text)
  if (prefix) {
    qualifier = qualifierFor(prefix[1]!)
    text = text.slice(prefix[0].length)
  }

  const date = matchDate(text)
  if (!date) return { ok: false, error: ERROR_FORMAT }
  if (!isValidGenDate(date)) return { ok: false, error: ERROR_INVALID }

  return { ok: true, value: qualifier ? { ...date, qualifier } : date }
}

export function isValidGenDate(d: GenDate): boolean {
  if (!Number.isInteger(d.year) || d.year < 1) return false
  if (d.month === undefined) return d.day === undefined
  if (!Number.isInteger(d.month) || d.month < 1 || d.month > 12) return false
  if (d.day === undefined) return true
  if (!Number.isInteger(d.day) || d.day < 1) return false

  const date = new Date(Date.UTC(2000, d.month - 1, d.day))
  date.setUTCFullYear(d.year)
  return date.getUTCMonth() === d.month - 1 && date.getUTCDate() === d.day
}
