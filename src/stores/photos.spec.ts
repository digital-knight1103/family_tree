import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { FamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'
import { buildFamily } from '@tests/fixtures/build-family'
import { usePhotoStore } from './photos'

const repository = vi.hoisted(() => ({
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  photoUrl: vi.fn((photo: string) => `/__data/photos/${photo}`),
}))

vi.mock('@/data', () => ({ getRepository: () => repository }))

function setup(data: FamilyData) {
  const family = useFamilyStore()
  family.status = 'ready'
  family.source = 'user'
  family.data = data
  family.update = (mutator) => {
    const draft = structuredClone(family.data!)
    mutator(draft)
    family.data = draft
  }
  return family
}

describe('usePhotoStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    repository.uploadPhoto.mockReset()
    repository.deletePhoto.mockReset()
  })

  it('urlFor zwraca undefined bez zdjęcia i adres ze zdjęciem', () => {
    const family = setup(
      buildFamily({ persons: [{ id: 'p_a' }, { id: 'p_b', photo: 'p_b.webp' }] }),
    )
    const photos = usePhotoStore()
    expect(photos.urlFor(family.data!.persons[0]!)).toBeUndefined()
    expect(photos.urlFor(family.data!.persons[1]!)).toBe('/__data/photos/p_b.webp')
  })

  it('pusty adres repozytorium (demo) oznacza brak zdjęcia', () => {
    repository.photoUrl.mockReturnValueOnce('')
    const family = setup(buildFamily({ persons: [{ id: 'p_a', photo: 'p_a.webp' }] }))
    expect(usePhotoStore().urlFor(family.data!.persons[0]!)).toBeUndefined()
  })

  it('podmiana zdjęcia zmienia adres (inny ?v=)', async () => {
    repository.uploadPhoto.mockResolvedValue('p_a.webp')
    const family = setup(buildFamily({ persons: [{ id: 'p_a', photo: 'p_a.webp' }] }))
    const photos = usePhotoStore()
    const before = photos.urlFor(family.data!.persons[0]!)
    await photos.upload('p_a', new File(['x'], 'a.png', { type: 'image/png' }))
    const first = photos.urlFor(family.data!.persons[0]!)
    await photos.upload('p_a', new File(['x'], 'a.png', { type: 'image/png' }))
    const second = photos.urlFor(family.data!.persons[0]!)
    expect(first).toMatch(/\?v=\d+$/)
    expect(new Set([before, first, second]).size).toBe(3)
  })

  it('odrzucony upload nie zmienia photo i ustawia błąd', async () => {
    repository.uploadPhoto.mockRejectedValue(new Error('Nie udało się zapisać zdjęcia.'))
    const family = setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const photos = usePhotoStore()
    await photos.upload('p_a', new File(['x'], 'a.png', { type: 'image/png' }))
    expect(family.data!.persons[0]!.photo).toBeUndefined()
    expect(photos.error).toBe('Nie udało się zapisać zdjęcia.')
  })

  it('remove czyści photo i woła deletePhoto', async () => {
    repository.deletePhoto.mockResolvedValue(undefined)
    const family = setup(buildFamily({ persons: [{ id: 'p_a', photo: 'p_a.webp' }] }))
    const photos = usePhotoStore()
    await photos.remove('p_a')
    expect(family.data!.persons[0]!.photo).toBeUndefined()
    expect(repository.deletePhoto).toHaveBeenCalledWith('p_a')
    expect(photos.error).toBeNull()
  })

  it('wersja rośnie zaraz po uploadzie, także gdy zapis danych się nie powiedzie', async () => {
    repository.uploadPhoto.mockResolvedValue('p_a.webp')
    const family = setup(buildFamily({ persons: [{ id: 'p_a', photo: 'p_a.webp' }] }))
    family.update = () => {
      throw new Error('Zapis nie powiódł się.')
    }
    const photos = usePhotoStore()
    const before = photos.urlFor(family.data!.persons[0]!)
    await photos.upload('p_a', new File(['x'], 'a.png', { type: 'image/png' }))
    expect(photos.urlFor(family.data!.persons[0]!)).not.toBe(before)
    expect(photos.error).toBe('Zapis nie powiódł się.')
  })

  it('upload i remove czyszczą poprzedni błąd na początku', async () => {
    repository.uploadPhoto.mockRejectedValueOnce(new Error('Błąd 1'))
    setup(buildFamily({ persons: [{ id: 'p_a', photo: 'p_a.webp' }] }))
    const photos = usePhotoStore()
    await photos.upload('p_a', new File(['x'], 'a.png', { type: 'image/png' }))
    expect(photos.error).toBe('Błąd 1')
    let seen: string | null = 'unset'
    repository.uploadPhoto.mockImplementationOnce(() => {
      seen = photos.error
      return 'p_a.webp'
    })
    await photos.upload('p_a', new File(['x'], 'a.png', { type: 'image/png' }))
    expect(seen).toBeNull()

    repository.uploadPhoto.mockRejectedValueOnce(new Error('Błąd 2'))
    await photos.upload('p_a', new File(['x'], 'a.png', { type: 'image/png' }))
    let seenOnRemove: string | null = 'unset'
    repository.deletePhoto.mockImplementationOnce(() => {
      seenOnRemove = photos.error
    })
    await photos.remove('p_a')
    expect(seenOnRemove).toBeNull()
  })

  it('discard woła deletePhoto i zgłasza błąd', async () => {
    repository.deletePhoto.mockRejectedValueOnce(new Error('Nie udało się usunąć zdjęcia.'))
    setup(buildFamily({ persons: [{ id: 'p_a' }] }))
    const photos = usePhotoStore()
    await photos.discard('p_a')
    expect(repository.deletePhoto).toHaveBeenCalledWith('p_a')
    expect(photos.error).toBe('Nie udało się usunąć zdjęcia.')
  })
})
