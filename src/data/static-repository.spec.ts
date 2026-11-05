import { describe, expect, it } from 'vitest'
import type { FamilyRepository } from './repository'
import { StaticFamilyRepository } from './static-repository'

const create = (): FamilyRepository => new StaticFamilyRepository()

const READ_ONLY = 'Edycja niedostępna w wersji tylko do odczytu'

describe('StaticFamilyRepository', () => {
  it('always loads the read-only demo seed', async () => {
    const result = await create().load()
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.source).toBe('demo')
    expect(result.readOnly).toBe(true)
    expect(result.data.persons.length).toBeGreaterThanOrEqual(15)
  })

  it('rejects save', async () => {
    const repository = create()
    const loaded = await repository.load()
    if (loaded.kind !== 'ok') throw new Error('seed should load')
    await expect(repository.save(loaded.data, 0)).rejects.toThrow(READ_ONLY)
  })

  it('rejects createNew', async () => {
    await expect(create().createNew()).rejects.toThrow(READ_ONLY)
  })

  it('rejects photo changes', async () => {
    const repository = create()
    await expect(repository.uploadPhoto('p1', new Blob(['x']))).rejects.toThrow(READ_ONLY)
    await expect(repository.deletePhoto('p1')).rejects.toThrow(READ_ONLY)
  })

  it('has no photos in the build', () => {
    expect(create().photoUrl('p1.webp')).toBe('')
  })
})
