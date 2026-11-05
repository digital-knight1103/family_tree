import { HttpFamilyRepository } from './http-repository'
import type { FamilyRepository } from './repository'
import { StaticFamilyRepository } from './static-repository'

export type { FamilyRepository, LoadResult, SaveResult } from './repository'

export { createSaveQueue, type SaveQueue, type SaveStatus } from './save-queue'

let instance: FamilyRepository | undefined

export function getRepository(): FamilyRepository {
  instance ??= import.meta.env.DEV ? new HttpFamilyRepository() : new StaticFamilyRepository()
  return instance
}
