import type { DateQualifier, GenDate } from './schema'

export type { DateQualifier, GenDate }

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

const MONTHS_GENITIVE = [
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

const MONTHS_NOMINATIVE = [
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

// "przed marcem 1921"
const MONTHS_INSTRUMENTAL = [
  'styczniem',
  'lutym',
  'marcem',
  'kwietniem',
  'majem',
  'czerwcem',
  'lipcem',
  'sierpniem',
  'wrześniem',
  'październikiem',
  'listopadem',
  'grudniem',
]

// "po marcu 1921"
const MONTHS_LOCATIVE = [
  'styczniu',
  'lutym',
  'marcu',
  'kwietniu',
  'maju',
  'czerwcu',
  'lipcu',
  'sierpniu',
  'wrześniu',
  'październiku',
  'listopadzie',
  'grudniu',
]

// Each qualifier governs a different case of a bare month name: "ok. marca", "przed marcem", "po marcu".
const MONTHS_AFTER_QUALIFIER: Record<DateQualifier, string[]> = {
  about: MONTHS_GENITIVE,
  before: MONTHS_INSTRUMENTAL,
  after: MONTHS_LOCATIVE,
}

const QUALIFIER_LABEL: Record<DateQualifier, string> = {
  about: 'ok.',
  before: 'przed',
  after: 'po',
}

function withQualifier(text: string, qualifier: DateQualifier | undefined): string {
  return qualifier ? `${QUALIFIER_LABEL[qualifier]} ${text}` : text
}

export function formatGenDate(d: GenDate): string {
  let text = String(d.year)
  if (d.month !== undefined && d.day !== undefined) {
    text = `${d.day} ${MONTHS_GENITIVE[d.month - 1]} ${d.year}`
  } else if (d.month !== undefined) {
    const months = d.qualifier ? MONTHS_AFTER_QUALIFIER[d.qualifier] : MONTHS_NOMINATIVE
    text = `${months[d.month - 1]} ${d.year}`
  }
  return withQualifier(text, d.qualifier)
}

export function formatGenDateInput(d: GenDate): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  let text = String(d.year)
  if (d.month !== undefined) text = `${pad(d.month)}.${text}`
  if (d.month !== undefined && d.day !== undefined) text = `${pad(d.day)}.${text}`
  return withQualifier(text, d.qualifier)
}

function formatYear(d: GenDate): string {
  return withQualifier(String(d.year), d.qualifier)
}

export function formatLifeSpan(birth?: GenDate, death?: GenDate, deceased = false): string {
  if (death) return `${birth ? formatYear(birth) : '?'} – ${formatYear(death)}`
  if (!birth) return ''
  return deceased ? `${formatYear(birth)} – ?` : formatYear(birth)
}

export function genDateSortKey(d: GenDate | undefined): number {
  if (!d) return Number.POSITIVE_INFINITY
  return d.year * 10000 + (d.month ?? 1) * 100 + (d.day ?? 1)
}
