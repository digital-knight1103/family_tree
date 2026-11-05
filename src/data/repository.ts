import type { FamilyData } from '@/domain/schema'
import { validateFamilyData, type ValidationError } from '@/domain/validate'

export type LoadResult =
  | {
      kind: 'ok'
      data: FamilyData
      source: 'user' | 'demo'
      readOnly: boolean
      filePath?: string
    }
  | { kind: 'invalid'; filePath: string; errors: ValidationError[] }

export type SaveResult =
  { kind: 'ok'; revision: number } | { kind: 'conflict' } | { kind: 'error'; message: string }

export interface FamilyRepository {
  load(): Promise<LoadResult>
  save(data: FamilyData, baseRevision: number, opts?: { keepalive?: boolean }): Promise<SaveResult>
  createNew(): Promise<LoadResult>
  uploadPhoto(personId: string, file: Blob): Promise<string>
  deletePhoto(personId: string): Promise<void>
  photoUrl(photo: string): string
}

const SEED_FILE_PATH = 'data/seed/demo-family.json'

export async function loadSeed(): Promise<LoadResult> {
  const seed = (await import('@seed/demo-family.json')).default
  const result = validateFamilyData(seed)
  if (!result.ok) return { kind: 'invalid', filePath: SEED_FILE_PATH, errors: result.errors }
  return { kind: 'ok', data: result.data, source: 'demo', readOnly: true }
}
