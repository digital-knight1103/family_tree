import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadResult, SaveResult } from '@/data'
import { emptyFamilyData, type FamilyData } from '@/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { useFamilyStore } from './family'

const repo = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  createNew: vi.fn(),
}))

vi.mock('@/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data')>()
  return { ...actual, getRepository: () => repo }
})

const CONFLICT_MESSAGE = 'Dane zmieniły się w innej karcie, odśwież'

function userResult(data: FamilyData, hash = 'h0'): LoadResult {
  return { kind: 'ok', data, source: 'user', readOnly: false, hash }
}

function addPerson(id: string) {
  return (draft: FamilyData) => {
    draft.persons.push({ id, givenNames: id, surname: 'Test', sex: 'unknown', living: false })
  }
}

describe('useFamilyStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    repo.load.mockReset()
    repo.save.mockReset()
    repo.createNew.mockReset()
    repo.save.mockResolvedValue({ kind: 'ok', revision: 1, hash: 'h1' } satisfies SaveResult)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in loading state with idle save status', () => {
    const store = useFamilyStore()
    expect(store.status).toBe('loading')
    expect(store.data).toBeNull()
    expect(store.saveStatus).toBe('idle')
    expect(store.saveError).toBeNull()
    expect(store.hasUnsaved()).toBe(false)
    expect(() => store.flushOnUnload()).not.toThrow()
  })

  it('handles an invalid result without data or saving', async () => {
    const errors = [{ path: 'persons[0]', message: 'Zły' }]
    repo.load.mockResolvedValue({ kind: 'invalid', filePath: 'data/family/family.json', errors })
    const store = useFamilyStore()
    await store.load()
    expect(store.status).toBe('invalid')
    expect(store.invalid).toEqual({ filePath: 'data/family/family.json', errors })
    expect(store.data).toBeNull()
    expect(store.saveStatus).toBe('idle')
    await vi.advanceTimersByTimeAsync(1000)
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('sets load-error with the message when load throws', async () => {
    repo.load.mockRejectedValue(new Error('Brak połączenia'))
    const store = useFamilyStore()
    await store.load()
    expect(store.status).toBe('load-error')
    expect(store.loadError).toBe('Brak połączenia')
  })

  it('sets load-error when startOwnTree throws', async () => {
    repo.createNew.mockRejectedValue(new Error('Nie udało się'))
    const store = useFamilyStore()
    await store.startOwnTree()
    expect(store.status).toBe('load-error')
    expect(store.loadError).toBe('Nie udało się')
  })

  it('keeps the path where missing user data was sought, and drops it for user data', async () => {
    repo.load.mockResolvedValue({
      kind: 'ok',
      data: buildFamily({ persons: [{ id: 'p_a' }] }),
      source: 'demo',
      readOnly: true,
      filePath: 'C:/dane/family.json',
    })
    const store = useFamilyStore()
    await store.load()
    expect(store.missingFilePath).toBe('C:/dane/family.json')
    repo.createNew.mockResolvedValue(userResult(emptyFamilyData()))
    await store.startOwnTree()
    expect(store.missingFilePath).toBeNull()
  })

  it('loads demo data as read-only and update throws', async () => {
    repo.load.mockResolvedValue({
      kind: 'ok',
      data: buildFamily({ persons: [{ id: 'p_a' }] }),
      source: 'demo',
      readOnly: true,
    })
    const store = useFamilyStore()
    await store.load()
    expect(store.status).toBe('ready')
    expect(store.source).toBe('demo')
    expect(store.readOnly).toBe(true)
    expect(() => store.update(addPerson('p_b'))).toThrow(
      'Edycja niedostępna w wersji tylko do odczytu',
    )
    expect(store.saveStatus).toBe('idle')
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('throws on update when not ready', () => {
    const store = useFamilyStore()
    expect(() => store.update(addPerson('p_b'))).toThrow('Dane nie są gotowe do edycji')
  })

  it('update changes data and saves after 500 ms', async () => {
    repo.load.mockResolvedValue(userResult(buildFamily({ persons: [{ id: 'p_a' }] })))
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_b'))
    expect(store.data?.persons.map((p) => p.id)).toEqual(['p_a', 'p_b'])
    expect(store.saveStatus).toBe('pending')
    expect(store.hasUnsaved()).toBe(true)
    await vi.advanceTimersByTimeAsync(499)
    expect(repo.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(repo.save).toHaveBeenCalledTimes(1)
    expect(repo.save.mock.calls[0]?.[0]).toBe(store.data)
    expect(repo.save.mock.calls[0]?.[1]).toEqual({ revision: 0, hash: 'h0' })
  })

  it('saveStatus goes pending, saving, saved', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    let resolveSave: (r: SaveResult) => void = () => {}
    repo.save.mockReturnValue(new Promise<SaveResult>((r) => (resolveSave = r)))
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_b'))
    expect(store.saveStatus).toBe('pending')
    await vi.advanceTimersByTimeAsync(500)
    expect(store.saveStatus).toBe('saving')
    resolveSave({ kind: 'ok', revision: 1, hash: 'h1' })
    await vi.advanceTimersByTimeAsync(0)
    expect(store.saveStatus).toBe('saved')
    expect(store.hasUnsaved()).toBe(false)
  })

  it('exposes save error and retrySave retries', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    repo.save.mockResolvedValueOnce({ kind: 'error', message: 'Dysk pełny' })
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_b'))
    await vi.advanceTimersByTimeAsync(500)
    expect(store.saveStatus).toBe('error')
    expect(store.saveError).toBe('Dysk pełny')
    store.retrySave()
    await vi.advanceTimersByTimeAsync(0)
    expect(repo.save).toHaveBeenCalledTimes(2)
    expect(store.saveStatus).toBe('saved')
  })

  it('immediate option saves without waiting', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_b'), { immediate: true })
    expect(repo.save).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid update, keeps data untouched and does not save', async () => {
    const family = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }],
      parentChild: [['p_a', 'p_b']],
    })
    repo.load.mockResolvedValue(userResult(family))
    const store = useFamilyStore()
    await store.load()
    const before = store.data
    const snapshot = structuredClone(before)
    expect(() =>
      store.update((draft) => {
        draft.parentChild.push({ parentId: 'p_b', childId: 'p_a', type: 'biological' })
      }),
    ).toThrow()
    expect(store.data).toBe(before)
    expect(store.data).toEqual(snapshot)
    expect(store.saveStatus).toBe('idle')
    await vi.advanceTimersByTimeAsync(1000)
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('formats the first validation error as path: message', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    const store = useFamilyStore()
    await store.load()
    expect(() =>
      store.update((draft) => {
        draft.revision = -1
      }),
    ).toThrow(/^revision: /)
  })

  it('does not mutate the committed snapshot on later updates', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_a'))
    const first = store.data
    store.update(addPerson('p_b'))
    expect(first?.persons).toHaveLength(1)
    expect(store.data?.persons).toHaveLength(2)
    expect(store.data).not.toBe(first)
  })

  it('refuses updates after a conflict', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    repo.save.mockResolvedValueOnce({ kind: 'conflict' })
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_a'))
    await vi.advanceTimersByTimeAsync(500)
    expect(store.saveStatus).toBe('conflict')
    const before = store.data
    expect(() => store.update(addPerson('p_b'))).toThrow(CONFLICT_MESSAGE)
    expect(store.data).toBe(before)
  })

  it('canEdit is true only for a writable user tree without conflict', async () => {
    const store = useFamilyStore()
    expect(store.canEdit).toBe(false)
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    repo.save.mockResolvedValueOnce({ kind: 'conflict' })
    await store.load()
    expect(store.canEdit).toBe(true)
    store.update(addPerson('p_a'))
    await vi.advanceTimersByTimeAsync(500)
    expect(store.saveStatus).toBe('conflict')
    expect(store.canEdit).toBe(false)
  })

  it('canEdit is false for demo and read-only data', async () => {
    repo.load.mockResolvedValue({
      kind: 'ok',
      data: buildFamily({ persons: [{ id: 'p_a' }] }),
      source: 'demo',
      readOnly: true,
    })
    const store = useFamilyStore()
    await store.load()
    expect(store.canEdit).toBe(false)
    repo.load.mockResolvedValue({ ...userResult(emptyFamilyData()), readOnly: true })
    await store.load()
    expect(store.source).toBe('user')
    expect(store.canEdit).toBe(false)
  })

  it('startOwnTree gives an empty user tree that can be saved', async () => {
    repo.createNew.mockResolvedValue(userResult(emptyFamilyData(), 'created'))
    const store = useFamilyStore()
    await store.startOwnTree()
    expect(store.status).toBe('ready')
    expect(store.source).toBe('user')
    expect(store.readOnly).toBe(false)
    expect(store.data?.persons).toEqual([])
    store.update(addPerson('p_a'))
    await vi.advanceTimersByTimeAsync(500)
    expect(repo.save).toHaveBeenCalledTimes(1)
    expect(repo.save.mock.calls[0]?.[1]).toEqual({ revision: 0, hash: 'created' })
  })

  it('startOwnTree can fall back to an invalid result', async () => {
    repo.createNew.mockResolvedValue({ kind: 'invalid', filePath: 'f.json', errors: [] })
    const store = useFamilyStore()
    await store.startOwnTree()
    expect(store.status).toBe('invalid')
    expect(store.invalid?.filePath).toBe('f.json')
    expect(store.data).toBeNull()
    expect(store.hasUnsaved()).toBe(false)
  })

  it('flushOnUnload sends pending data', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_a'))
    store.flushOnUnload()
    expect(repo.save).toHaveBeenCalledWith(
      store.data,
      { revision: 0, hash: 'h0' },
      { keepalive: true },
    )
  })

  it('ignores a second startOwnTree while the first is in flight', async () => {
    repo.createNew.mockResolvedValue(userResult(emptyFamilyData()))
    const store = useFamilyStore()
    await Promise.all([store.startOwnTree(), store.startOwnTree()])
    expect(repo.createNew).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('ready')
  })

  it('load does nothing while there are unsaved changes', async () => {
    repo.load.mockResolvedValue(userResult(emptyFamilyData()))
    const store = useFamilyStore()
    await store.load()
    store.update(addPerson('p_a'))
    expect(store.hasUnsaved()).toBe(true)
    await store.load()
    expect(repo.load).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('ready')
  })
})
