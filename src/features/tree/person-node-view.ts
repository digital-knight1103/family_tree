import { formatGenDateInput, formatLifeSpan, type GenDate } from '@/domain/dates'
import { isUnknownPerson } from '@/domain/relations'
import type { Person, Sex } from '@/domain/schema'

export interface PersonNodeView {
  personId: string
  displayName: string
  lifeSpan: string
  /** Tree node lines: given names (or the unknown label), surname with the maiden name, full dates. */
  nameLine: string
  surnameLine: string
  dates: string
  maidenLine: string
  initials: string
  sex: Sex
  unknown: boolean
  unconfirmed: boolean
}

const UNKNOWN_LABELS: Record<Sex, string> = {
  male: 'Nieznany',
  female: 'Nieznana',
  unknown: 'Osoba nieznana',
}

function firstLetter(text: string): string {
  return text.trim().charAt(0).toLocaleUpperCase('pl')
}

/** Like `formatLifeSpan`, with full short dates ("12.03.1990 – 05.11.2020") instead of years. */
function fullLifeSpan(birth?: GenDate, death?: GenDate, deceased = false): string {
  const short = (d: GenDate | undefined) => (d ? formatGenDateInput(d) : '?')
  if (death) return `${short(birth)} – ${short(death)}`
  if (!birth) return ''
  return deceased ? `${short(birth)} – ?` : short(birth)
}

export function personNodeView(person: Person): PersonNodeView {
  const unknown = isUnknownPerson(person)
  const givenNames = person.givenNames.trim()
  const surname = person.surname.trim()
  const maiden = person.maidenName?.trim() ?? ''
  const maidenLine = maiden !== '' && maiden !== surname ? `z d. ${maiden}` : ''
  return {
    personId: person.id,
    displayName: unknown ? UNKNOWN_LABELS[person.sex] : `${givenNames} ${surname}`.trim(),
    lifeSpan: formatLifeSpan(person.birth?.date, person.death?.date, !person.living),
    nameLine: unknown ? UNKNOWN_LABELS[person.sex] : givenNames,
    surnameLine: unknown ? '' : [surname, maidenLine].filter((part) => part !== '').join(' '),
    dates: fullLifeSpan(person.birth?.date, person.death?.date, !person.living),
    maidenLine,
    initials: unknown
      ? '?'
      : `${firstLetter(givenNames.split(/\s+/)[0] ?? '')}${firstLetter(surname)}`,
    sex: person.sex,
    unknown,
    unconfirmed: Boolean(person.birth?.unconfirmed || person.death?.unconfirmed),
  }
}
