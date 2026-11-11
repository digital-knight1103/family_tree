import {
  canAddParent,
  canAddUnion,
  MISSING_PERSON_MESSAGE,
  type CanResult,
} from './relation-rules.ts'
import { unionsOf } from './relations.ts'
import type { EndFact, FamilyData, Fact, ParentChild, Person, Sex, Union } from './schema.ts'

export type IdSource = () => string

export interface NewPersonInput {
  givenNames: string
  surname: string
  maidenName?: string
  sex: Sex
}

export type RelativeKind = 'parent' | 'partner' | 'child' | 'sibling'
export type RelativeTarget =
  { kind: 'new'; person: NewPersonInput } | { kind: 'existing'; personId: string }
export type CoParent = { kind: 'union'; unionId: string } | { kind: 'none' }

export interface AddRelativeOptions {
  coParent?: CoParent
  source?: IdSource
}

export const CO_PARENT_CHOICE_MESSAGE = 'Wybierz drugiego rodzica.'
export const UNKNOWN_UNION_MESSAGE = 'Wybrany związek nie należy do tej osoby.'

export const MISSING_RELATION_MESSAGE = 'Wskazana relacja nie istnieje.'
export const MISSING_UNION_MESSAGE = 'Wskazany związek nie istnieje.'
const TOO_MANY_BIOLOGICAL_MESSAGE = 'Osoba może mieć najwyżej dwoje rodziców biologicznych.'

const ID_LENGTH = 10
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const UNKNOWN_PERSON: NewPersonInput = { givenNames: '', surname: '', sex: 'unknown' }

const randomSource: IdSource = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('')
}

export function createId(
  prefix: 'p' | 'u',
  taken: Set<string>,
  source: IdSource = randomSource,
): string {
  let id = `${prefix}_${source()}`
  while (taken.has(id)) id = `${prefix}_${source()}`
  taken.add(id)
  return id
}

function takenIds(data: FamilyData): Set<string> {
  return new Set([...data.persons.map((p) => p.id), ...data.unions.map((u) => u.id)])
}

function makePerson(id: string, input: NewPersonInput, living = true): Person {
  const person: Person = {
    id,
    givenNames: input.givenNames,
    surname: input.surname,
    sex: input.sex,
    living,
  }
  if (input.maidenName !== undefined && input.maidenName.trim() !== '') {
    person.maidenName = input.maidenName
  }
  return person
}

export function addPerson(
  draft: FamilyData,
  person: NewPersonInput,
  opts: { self?: boolean; source?: IdSource } = {},
): string {
  const id = createId('p', takenIds(draft), opts.source)
  draft.persons.push(makePerson(id, person))
  if (opts.self === true) draft.settings.selfPersonId = id
  return id
}

export function needsCoParentChoice(data: FamilyData, anchorId: string): boolean {
  return unionsOf(data, anchorId).length >= 2
}

function fail(reason: string): never {
  throw new Error(reason)
}

function ensure(result: CanResult): void {
  if (!result.ok) fail(result.reason)
}

// Mutating steps on a scratch copy: every step checks the rules first and throws on a violation.
function link(work: FamilyData, childId: string, parentId: string, type: ParentChild['type']) {
  ensure(canAddParent(work, childId, parentId, type))
  work.parentChild.push({ parentId, childId, type })
}

function join(work: FamilyData, aId: string, bId: string, taken: Set<string>, source?: IdSource) {
  ensure(canAddUnion(work, aId, bId))
  work.unions.push({ id: createId('u', taken, source), partnerIds: [aId, bId], type: 'marriage' })
}

function resolveTarget(
  work: FamilyData,
  target: RelativeTarget,
  taken: Set<string>,
  source?: IdSource,
): string {
  if (target.kind === 'existing') return target.personId
  const id = createId('p', taken, source)
  work.persons.push(makePerson(id, target.person, target.person !== UNKNOWN_PERSON))
  return id
}

function applyParent(
  work: FamilyData,
  anchorId: string,
  parentId: string,
  taken: Set<string>,
  source?: IdSource,
) {
  const existing = work.parentChild.filter((r) => r.childId === anchorId)
  link(work, anchorId, parentId, 'biological')
  const [only] = existing
  if (existing.length !== 1 || only === undefined) return
  const otherId = only.parentId
  if (unionsOf(work, otherId).length === 0) join(work, otherId, parentId, taken, source)
}

function applyChild(
  work: FamilyData,
  anchorId: string,
  childId: string,
  coParent: CoParent | undefined,
) {
  const unions = unionsOf(work, anchorId)
  let partnerIds: string[] = []
  if (coParent?.kind === 'union') {
    const union = unions.find((u) => u.id === coParent.unionId)
    if (union === undefined) fail(UNKNOWN_UNION_MESSAGE)
    partnerIds = union.partnerIds.filter((id) => id !== anchorId)
  } else if (coParent === undefined) {
    if (unions.length >= 2) fail(CO_PARENT_CHOICE_MESSAGE)
    partnerIds = unions.flatMap((u) => u.partnerIds.filter((id) => id !== anchorId))
  }
  link(work, childId, anchorId, 'biological')
  // An existing child may already have the co-parent: that edge stays as it is.
  for (const parentId of partnerIds) {
    if (!hasEdge(work, parentId, childId)) link(work, childId, parentId, 'biological')
  }
}

function hasEdge(work: FamilyData, parentId: string, childId: string): boolean {
  return work.parentChild.some((r) => r.parentId === parentId && r.childId === childId)
}

function applySibling(
  work: FamilyData,
  anchorId: string,
  siblingId: string,
  taken: Set<string>,
  source?: IdSource,
) {
  if (siblingId === anchorId) ensure(canAddParent(work, anchorId, anchorId, 'biological'))
  let edges = work.parentChild.filter((r) => r.childId === anchorId).map((r) => ({ ...r }))
  if (edges.length === 0) {
    const parentId = resolveTarget(work, { kind: 'new', person: UNKNOWN_PERSON }, taken, source)
    link(work, anchorId, parentId, 'biological')
    edges = [{ parentId, childId: anchorId, type: 'biological' }]
  }
  // Parents the sibling already shares are skipped; sharing all of them adds nothing, so linking
  // them all again reports the duplicate relation.
  const missing = edges.filter((e) => !hasEdge(work, e.parentId, siblingId))
  for (const edge of missing.length > 0 ? missing : edges) {
    link(work, siblingId, edge.parentId, edge.type)
  }
}

function applyRelative(
  work: FamilyData,
  anchorId: string,
  kind: RelativeKind,
  target: RelativeTarget,
  coParent: CoParent | undefined,
  source?: IdSource,
): string {
  if (!work.persons.some((p) => p.id === anchorId)) fail(MISSING_PERSON_MESSAGE)
  const taken = takenIds(work)
  const targetId = resolveTarget(work, target, taken, source)
  if (kind === 'parent') applyParent(work, anchorId, targetId, taken, source)
  else if (kind === 'partner') join(work, anchorId, targetId, taken, source)
  else if (kind === 'child') applyChild(work, anchorId, targetId, coParent)
  else applySibling(work, anchorId, targetId, taken, source)
  return targetId
}

function scratchCopy(data: FamilyData): FamilyData {
  return JSON.parse(JSON.stringify(data)) as FamilyData
}

export function canAddRelative(
  data: FamilyData,
  anchorId: string,
  kind: RelativeKind,
  target: RelativeTarget = { kind: 'new', person: UNKNOWN_PERSON },
  coParent?: CoParent,
): CanResult {
  // Without a chosen co-parent the choice is still open, so the rules are checked for the anchor alone.
  const effective =
    coParent ?? (needsCoParentChoice(data, anchorId) ? { kind: 'none' as const } : undefined)
  try {
    // Scratch copy only: the helpers append and never reorder (addRelative relies on this).
    applyRelative(scratchCopy(data), anchorId, kind, target, effective)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

export function addRelative(
  draft: FamilyData,
  anchorId: string,
  kind: RelativeKind,
  target: RelativeTarget,
  opts: AddRelativeOptions = {},
): string {
  const work = scratchCopy(draft)
  const id = applyRelative(work, anchorId, kind, target, opts.coParent, opts.source)
  // The scratch helpers only append, so entries past the draft's lengths are exactly the new ones.
  draft.persons.push(...work.persons.slice(draft.persons.length))
  draft.parentChild.push(...work.parentChild.slice(draft.parentChild.length))
  draft.unions.push(...work.unions.slice(draft.unions.length))
  return id
}

export type PersonPatch = Partial<Omit<Person, 'id' | 'birth' | 'death'>>
export type FactKey = 'birth' | 'death'

const CLEARED_WHEN_EMPTY = new Set<string>(['maidenName', 'bio', 'researchNotes'])

function findPerson(draft: FamilyData, personId: string): Person {
  const person = draft.persons.find((p) => p.id === personId)
  if (person === undefined) fail(MISSING_PERSON_MESSAGE)
  return person
}

function findUnion(draft: FamilyData, unionId: string): Union {
  const union = draft.unions.find((u) => u.id === unionId)
  if (union === undefined) fail(MISSING_UNION_MESSAGE)
  return union
}

export function updatePerson(draft: FamilyData, personId: string, patch: PersonPatch): void {
  const person = findPerson(draft, personId)
  const target = person as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || (value === '' && CLEARED_WHEN_EMPTY.has(key))) delete target[key]
    else target[key] = value
  }
}

// Merges a patch into a fact; undefined, an empty place and unconfirmed=false drop the key.
function mergeFact<T extends Fact>(current: T | undefined, patch: Partial<T>): T | undefined {
  const next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '' || value === false) delete next[key]
    else next[key] = value
  }
  return Object.keys(next).length === 0 ? undefined : (next as T)
}

function assignOptional<T extends object, K extends keyof T>(
  holder: T,
  key: K,
  value: T[K] | undefined,
) {
  if (value === undefined) delete holder[key]
  else holder[key] = value
}

export function updateFact(
  draft: FamilyData,
  personId: string,
  key: FactKey,
  patch: Partial<Fact>,
): void {
  const person = findPerson(draft, personId)
  assignOptional(person, key, mergeFact(person[key], patch))
}

export function setSelf(draft: FamilyData, personId: string | undefined): void {
  if (personId === undefined) {
    delete draft.settings.selfPersonId
    return
  }
  findPerson(draft, personId)
  draft.settings.selfPersonId = personId
}

function findEdge(draft: FamilyData, parentId: string, childId: string): ParentChild {
  const edge = draft.parentChild.find((r) => r.parentId === parentId && r.childId === childId)
  if (edge === undefined) fail(MISSING_RELATION_MESSAGE)
  return edge
}

export function setParentChildType(
  draft: FamilyData,
  parentId: string,
  childId: string,
  type: ParentChild['type'],
): void {
  const edge = findEdge(draft, parentId, childId)
  if (type === 'biological' && edge.type !== 'biological') {
    const count = draft.parentChild.filter(
      (r) => r.childId === childId && r.type === 'biological',
    ).length
    if (count >= 2) fail(TOO_MANY_BIOLOGICAL_MESSAGE)
  }
  edge.type = type
}

export function removeParentChild(draft: FamilyData, parentId: string, childId: string): void {
  const edge = findEdge(draft, parentId, childId)
  draft.parentChild.splice(draft.parentChild.indexOf(edge), 1)
}

export function updateUnion(
  draft: FamilyData,
  unionId: string,
  patch: { type?: Union['type']; start?: Partial<Fact>; end?: Partial<EndFact> },
): void {
  const union = findUnion(draft, unionId)
  if (patch.type !== undefined) union.type = patch.type
  if (patch.start !== undefined) assignOptional(union, 'start', mergeFact(union.start, patch.start))
  if (patch.end !== undefined) assignOptional(union, 'end', mergeFact(union.end, patch.end))
}

export function removeUnion(draft: FamilyData, unionId: string): void {
  const union = findUnion(draft, unionId)
  draft.unions.splice(draft.unions.indexOf(union), 1)
}

export function relationCount(data: FamilyData, personId: string): number {
  const edges = data.parentChild.filter((r) => r.parentId === personId || r.childId === personId)
  return edges.length + data.unions.filter((u) => u.partnerIds.includes(personId)).length
}

export function deletePerson(draft: FamilyData, personId: string): { photo?: string } {
  const person = findPerson(draft, personId)
  const photo = person.photo
  draft.persons.splice(draft.persons.indexOf(person), 1)
  draft.parentChild = draft.parentChild.filter(
    (r) => r.parentId !== personId && r.childId !== personId,
  )
  draft.unions = draft.unions.filter((u) => !u.partnerIds.includes(personId))
  if (draft.settings.selfPersonId === personId) delete draft.settings.selfPersonId
  return photo === undefined ? {} : { photo }
}
