import * as z from 'zod'
import { pl } from 'zod/locales'
import { isValidGenDate } from './dates.ts'

// The app is Polish-only, so Zod's built-in messages (unknown key, wrong type…) are shown in Polish.
z.config(pl())

export const SCHEMA_VERSION = 1

export const PERSON_ID_PATTERN = /^p_[A-Za-z0-9_-]+$/
const UNION_ID = /^u_[A-Za-z0-9_-]+$/
export const PHOTO_FILE_PATTERN = /^p_[A-Za-z0-9_-]+\.webp$/

const personId = z.string().regex(PERSON_ID_PATTERN, { error: 'Niepoprawny identyfikator osoby' })

const dateQualifierSchema = z.enum(['about', 'before', 'after'])

// The shape without the calendar check, so GenDate can be inferred before isValidGenDate refines it.
const genDateShape = z.strictObject({
  year: z.int().min(1),
  month: z.int().min(1).max(12).optional(),
  day: z.int().min(1).max(31).optional(),
  qualifier: dateQualifierSchema.optional(),
})

export type DateQualifier = z.infer<typeof dateQualifierSchema>
export type GenDate = z.infer<typeof genDateShape>

export const genDateSchema = genDateShape.refine(isValidGenDate, { error: 'Niepoprawna data' })

export const factSchema = z.strictObject({
  date: genDateSchema.optional(),
  place: z.string().optional(),
  unconfirmed: z.boolean().optional(),
})

export const endFactSchema = z.strictObject({
  date: genDateSchema.optional(),
})

export const personSchema = z.strictObject({
  id: personId,
  givenNames: z.string(),
  surname: z.string(),
  maidenName: z.string().optional(),
  sex: z.enum(['male', 'female', 'unknown']),
  birth: factSchema.optional(),
  death: factSchema.optional(),
  bio: z.string().optional(),
  researchNotes: z.string().optional(),
  photo: z
    .string()
    .regex(PHOTO_FILE_PATTERN, { error: 'Niepoprawna nazwa pliku zdjęcia' })
    .optional(),
  living: z.boolean(),
})

export const parentChildSchema = z.strictObject({
  parentId: personId,
  childId: personId,
  type: z.enum(['biological', 'adoptive']),
})

export const unionSchema = z.strictObject({
  id: z.string().regex(UNION_ID, { error: 'Niepoprawny identyfikator związku' }),
  partnerIds: z.tuple([personId, personId]),
  type: z.enum(['marriage', 'partnership']),
  start: factSchema.optional(),
  end: endFactSchema.optional(),
})

export const familyDataSchema = z.strictObject({
  version: z.literal(SCHEMA_VERSION),
  revision: z.int().nonnegative(),
  settings: z.strictObject({
    selfPersonId: personId.optional(),
  }),
  persons: z.array(personSchema),
  parentChild: z.array(parentChildSchema),
  unions: z.array(unionSchema),
})

export type Fact = z.infer<typeof factSchema>
export type EndFact = z.infer<typeof endFactSchema>
export type Person = z.infer<typeof personSchema>
export type Sex = Person['sex']
export type ParentChild = z.infer<typeof parentChildSchema>
export type Union = z.infer<typeof unionSchema>
export type FamilyData = z.infer<typeof familyDataSchema>

export function emptyFamilyData(): FamilyData {
  return {
    version: SCHEMA_VERSION,
    revision: 0,
    settings: {},
    persons: [],
    parentChild: [],
    unions: [],
  }
}
