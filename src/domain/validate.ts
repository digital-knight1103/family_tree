import { checkRelationRules } from '@/domain/relation-rules'
import { familyDataSchema, type FamilyData } from '@/domain/schema'

export interface ValidationError {
  path: string
  message: string
}

export type ValidationResult =
  { ok: true; data: FamilyData } | { ok: false; errors: ValidationError[] }

const BOM = String.fromCharCode(0xfeff)

// Turns ['persons', 3, 'birth', 'date', 'month'] into 'persons[3].birth.date.month'.
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, key) => {
    if (typeof key === 'number') return `${text}[${key}]`
    return text === '' ? String(key) : `${text}.${String(key)}`
  }, '')
}

export function validateFamilyData(input: unknown): ValidationResult {
  const parsed = familyDataSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    }
  }
  const violations = checkRelationRules(parsed.data)
  if (violations.length > 0) return { ok: false, errors: violations }
  return { ok: true, data: parsed.data }
}

export function parseFamilyJson(text: string): ValidationResult {
  const content = text.startsWith(BOM) ? text.slice(BOM.length) : text
  if (content.trim() === '') {
    return { ok: false, errors: [{ path: '', message: 'Plik danych jest pusty.' }] }
  }
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : ''
    return {
      ok: false,
      errors: [{ path: '', message: `Plik danych nie jest poprawnym JSON-em${detail}.` }],
    }
  }
  return validateFamilyData(json)
}
