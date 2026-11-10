import { formatLifeSpan } from '@/domain/dates'
import { isUnknownPerson } from '@/domain/relations'
import type { Person, Sex } from '@/domain/schema'

export interface PersonNodeView {
  personId: string
  displayName: string
  lifeSpan: string
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

export function personNodeView(person: Person): PersonNodeView {
  const unknown = isUnknownPerson(person)
  const givenNames = person.givenNames.trim()
  const surname = person.surname.trim()
  const maiden = person.maidenName?.trim() ?? ''
  return {
    personId: person.id,
    displayName: unknown ? UNKNOWN_LABELS[person.sex] : `${givenNames} ${surname}`.trim(),
    lifeSpan: formatLifeSpan(person.birth?.date, person.death?.date, !person.living),
    maidenLine: maiden !== '' && maiden !== surname ? `z d. ${maiden}` : '',
    initials: unknown
      ? '?'
      : `${firstLetter(givenNames.split(/\s+/)[0] ?? '')}${firstLetter(surname)}`,
    sex: person.sex,
    unknown,
    unconfirmed: Boolean(person.birth?.unconfirmed || person.death?.unconfirmed),
  }
}
