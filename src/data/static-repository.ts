import { loadSeed, type FamilyRepository, type LoadResult, type SaveResult } from './repository'

const READ_ONLY_MESSAGE = 'Edycja niedostępna w wersji tylko do odczytu'

export class StaticFamilyRepository implements FamilyRepository {
  load(): Promise<LoadResult> {
    return loadSeed()
  }

  save(): Promise<SaveResult> {
    return Promise.reject(new Error(READ_ONLY_MESSAGE))
  }

  createNew(): Promise<LoadResult> {
    return Promise.reject(new Error(READ_ONLY_MESSAGE))
  }

  uploadPhoto(): Promise<string> {
    return Promise.reject(new Error(READ_ONLY_MESSAGE))
  }

  deletePhoto(): Promise<void> {
    return Promise.reject(new Error(READ_ONLY_MESSAGE))
  }

  photoUrl(): string {
    return ''
  }
}
