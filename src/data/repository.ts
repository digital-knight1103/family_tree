import type { FamilyData } from '@/domain/schema'
import { validateFamilyData, type ValidationError } from '@/domain/validate'

export type LoadResult =
  | {
      kind: 'ok'
      data: FamilyData
      source: 'user'
      readOnly: false
      filePath?: string
      hash: string
    }
  // filePath: where the dev server looked for the missing user data file.
  | { kind: 'ok'; data: FamilyData; source: 'demo'; readOnly: true; filePath?: string }
  | { kind: 'invalid'; filePath: string; errors: ValidationError[] }

// The file state a save builds on: its revision and the sha256 of its raw bytes.
export interface SaveBase {
  revision: number
  hash: string
}

export type SaveResult =
  | { kind: 'ok'; revision: number; hash: string }
  | { kind: 'conflict' }
  | { kind: 'error'; message: string }

// The exact body of a save request; the save queue measures it to pick keepalive.
export function saveRequestBody(data: FamilyData, base: SaveBase): string {
  return JSON.stringify({ data, baseRevision: base.revision, baseHash: base.hash })
}

export interface FamilyRepository {
  load(): Promise<LoadResult>
  save(data: FamilyData, base: SaveBase, opts?: { keepalive?: boolean }): Promise<SaveResult>
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
