import { formatGenDate } from '@/domain/dates'
import { childrenOf, parentsOf, partnersOf, siblingsOf, unionsOf } from '@/domain/relations'
import type { Fact, FamilyData, Person, Union } from '@/domain/schema'
import { personNodeView } from '@/features/tree'
import { renderMarkdown } from '@/shared/utils/markdown'

export interface PersonLink {
  personId: string
  displayName: string
  lifeSpan: string
}

export interface FactView {
  date: string
  place: string
  unconfirmed: boolean
}

export interface PartnerView extends PersonLink {
  unionId: string
  unionType: string
  start?: FactView
  end?: string
}

export interface PersonCardView {
  personId: string
  displayName: string
  maidenLine: string
  photo?: string
  birth?: FactView
  death?: FactView
  parents: PersonLink[]
  partners: PartnerView[]
  children: PersonLink[]
  siblings: PersonLink[]
  bioHtml: string
  researchNotes: string
}

const UNION_TYPE_LABELS: Record<Union['type'], string> = {
  marriage: 'małżeństwo',
  partnership: 'związek',
}

function factView(fact: Fact | undefined): FactView | undefined {
  if (!fact) return undefined
  return {
    date: fact.date ? formatGenDate(fact.date) : '',
    place: fact.place?.trim() ?? '',
    unconfirmed: fact.unconfirmed === true,
  }
}

function personLink(person: Person): PersonLink {
  const { personId, displayName, lifeSpan } = personNodeView(person)
  return { personId, displayName, lifeSpan }
}

function partnerViews(data: FamilyData, personId: string): PartnerView[] {
  const partners = new Map(partnersOf(data, personId).map((p) => [p.id, p]))
  return unionsOf(data, personId).flatMap((union) => {
    const partner = partners.get(union.partnerIds.find((id) => id !== personId) ?? '')
    if (!partner) return []
    return [
      {
        ...personLink(partner),
        unionId: union.id,
        unionType: UNION_TYPE_LABELS[union.type],
        start: factView(union.start),
        end: union.end?.date ? formatGenDate(union.end.date) : undefined,
      },
    ]
  })
}

export function personCardView(data: FamilyData, personId: string): PersonCardView | null {
  const person = data.persons.find((p) => p.id === personId)
  if (!person) return null
  const node = personNodeView(person)
  return {
    personId,
    displayName: node.displayName,
    maidenLine: node.maidenLine,
    photo: person.photo,
    birth: factView(person.birth),
    death: factView(person.death),
    parents: parentsOf(data, personId).map(personLink),
    partners: partnerViews(data, personId),
    children: childrenOf(data, personId).map(personLink),
    siblings: siblingsOf(data, personId).map(personLink),
    bioHtml: renderMarkdown(person.bio ?? ''),
    researchNotes: person.researchNotes?.trim() ?? '',
  }
}
