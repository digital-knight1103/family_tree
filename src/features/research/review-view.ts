import { comparePersonsByName } from '@/domain/person-search'
import { reviewEntries, type ReviewReason } from '@/domain/review'
import type { FamilyData, Person, Union } from '@/domain/schema'
import { personNodeView } from '@/features/tree'

export interface ReviewItemView {
  personId: string
  displayName: string
  lifeSpan: string
  reasons: string[]
  note: string
}

const FACT_WORDS = {
  birth: { genitive: 'urodzenia', noun: 'urodzenie' },
  death: { genitive: 'śmierci', noun: 'śmierć' },
} as const

const UNION_WORDS: Record<Union['type'], string> = {
  marriage: 'małżeństwo',
  partnership: 'związek',
}

function reasonText(reason: ReviewReason, persons: Map<string, Person>): string {
  switch (reason.kind) {
    case 'unknown':
      return 'brak imienia i nazwiska'
    case 'fact': {
      const { genitive, noun } = FACT_WORDS[reason.fact]
      if (reason.hasDate && reason.hasPlace) return `data i miejsce ${genitive} do potwierdzenia`
      if (reason.hasDate) return `data ${genitive} do potwierdzenia`
      if (reason.hasPlace) return `miejsce ${genitive} do potwierdzenia`
      return `${noun} do potwierdzenia`
    }
    case 'union': {
      const partner = persons.get(reason.partnerId)
      const name = partner ? personNodeView(partner).displayName : ''
      return `${UNION_WORDS[reason.unionType]} do potwierdzenia (${name})`
    }
  }
}

function firstLine(text: string | undefined): string {
  return (
    (text ?? '')
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  )
}

export function reviewView(data: FamilyData): ReviewItemView[] {
  const persons = new Map(data.persons.map((p) => [p.id, p]))
  return reviewEntries(data)
    .flatMap((entry) => {
      const person = persons.get(entry.personId)
      return person ? [{ person, reasons: entry.reasons }] : []
    })
    .sort((a, b) => comparePersonsByName(a.person, b.person))
    .map(({ person, reasons }) => {
      const { personId, displayName, lifeSpan } = personNodeView(person)
      return {
        personId,
        displayName,
        lifeSpan,
        reasons: reasons.map((reason) => reasonText(reason, persons)),
        note: firstLine(person.researchNotes),
      }
    })
}
