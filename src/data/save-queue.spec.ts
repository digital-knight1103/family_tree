import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FamilyData } from '@/domain/schema'
import type { FamilyRepository, SaveBase, SaveResult } from './repository'
import { createSaveQueue } from './save-queue'

type Deferred = { resolve: (result: SaveResult) => void }

const baseAt = (revision: number): SaveBase => ({ revision, hash: `h${revision}` })
const ok = (revision: number): SaveResult => ({ kind: 'ok', revision, hash: `h${revision}` })

function setup(initialBase = baseAt(1)) {
  const pending: Deferred[] = []
  const save = vi.fn<FamilyRepository['save']>(
    () =>
      new Promise<SaveResult>((resolve) => {
        pending.push({ resolve })
      }),
  )
  const queue = createSaveQueue(save, initialBase)
  return { save, queue, pending }
}

async function settle(deferred: Deferred | undefined, result: SaveResult) {
  deferred?.resolve(result)
  await vi.advanceTimersByTimeAsync(0)
}

const state = (n: number) => ({ id: `state-${n}` }) as unknown as FamilyData

describe('createSaveQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts idle without unsaved changes', () => {
    const { queue } = setup()
    expect(queue.status.value).toBe('idle')
    expect(queue.lastError.value).toBeNull()
    expect(queue.hasUnsaved()).toBe(false)
  })

  it('debounces three schedules within 200 ms into one call with the last state', async () => {
    const { save, queue } = setup(baseAt(7))
    const [a, b, c] = [state(1), state(2), state(3)]
    queue.schedule(a)
    await vi.advanceTimersByTimeAsync(200)
    queue.schedule(b)
    await vi.advanceTimersByTimeAsync(200)
    queue.schedule(c)
    await vi.advanceTimersByTimeAsync(499)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(c, baseAt(7))
  })

  it('honours a custom debounce', async () => {
    const save = vi.fn(() => new Promise<SaveResult>(() => undefined))
    const queue = createSaveQueue(save, baseAt(1), { debounceMs: 50 })
    queue.schedule(state(1))
    await vi.advanceTimersByTimeAsync(50)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves immediately with immediate: true and cancels the timer', async () => {
    const { save, queue, pending } = setup()
    const a = state(1)
    queue.schedule(state(0))
    queue.schedule(a, { immediate: true })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(a, baseAt(1))
    expect(queue.status.value).toBe('saving')
    await settle(pending[0], ok(2))
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.status.value).toBe('saved')
  })

  it('never runs two saves in parallel and sends the newest state afterwards with the new revision', async () => {
    const { save, queue, pending } = setup(baseAt(1))
    const a = state(1)
    const b = state(2)
    queue.schedule(a, { immediate: true })
    queue.schedule(b)
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
    await settle(pending[0], ok(5))
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(b, baseAt(5))
    expect(queue.status.value).toBe('saving')
    await settle(pending[1], ok(6))
    expect(queue.status.value).toBe('saved')
  })

  it('passes the revision and hash returned by a save to the follow-up save', async () => {
    const { save, queue, pending } = setup({ revision: 1, hash: 'start' })
    queue.schedule(state(1), { immediate: true })
    expect(save).toHaveBeenLastCalledWith(state(1), { revision: 1, hash: 'start' })
    const next = state(2)
    queue.schedule(next)
    await settle(pending[0], { kind: 'ok', revision: 2, hash: 'after-first' })
    expect(save).toHaveBeenLastCalledWith(next, { revision: 2, hash: 'after-first' })
  })

  it('sends only the last of two changes made during a save, right after it, without debounce', async () => {
    const { save, queue, pending } = setup(baseAt(1))
    queue.schedule(state(1), { immediate: true })
    queue.schedule(state(2))
    queue.schedule(state(3))
    const last = state(4)
    queue.schedule(last)
    await settle(pending[0], ok(2))
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(last, baseAt(2))
    await settle(pending[1], ok(3))
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('immediate during a save yields exactly one follow-up call', async () => {
    const { save, queue, pending } = setup(baseAt(1))
    queue.schedule(state(1), { immediate: true })
    const b = state(2)
    queue.schedule(b, { immediate: true })
    expect(save).toHaveBeenCalledTimes(1)
    await settle(pending[0], ok(2))
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(b, baseAt(2))
    await settle(pending[1], ok(3))
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('stops on conflict and ignores later schedule, retry and flushOnUnload', async () => {
    const { save, queue, pending } = setup()
    queue.schedule(state(1), { immediate: true })
    queue.schedule(state(2))
    await settle(pending[0], { kind: 'conflict' })
    expect(queue.status.value).toBe('conflict')
    expect(queue.hasUnsaved()).toBe(false)
    queue.schedule(state(3))
    queue.schedule(state(4), { immediate: true })
    queue.retry()
    queue.flushOnUnload()
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.status.value).toBe('conflict')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('goes to error on failure, keeps unsaved true and retry sends the newest state', async () => {
    const { save, queue, pending } = setup(baseAt(3))
    const a = state(1)
    queue.schedule(a, { immediate: true })
    await settle(pending[0], { kind: 'error', message: 'Dysk pełny' })
    expect(queue.status.value).toBe('error')
    expect(queue.lastError.value).toBe('Dysk pełny')
    expect(queue.hasUnsaved()).toBe(true)
    queue.retry()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(a, baseAt(3))
    expect(queue.status.value).toBe('saving')
    await settle(pending[1], ok(4))
    expect(queue.status.value).toBe('saved')
    expect(queue.lastError.value).toBeNull()
  })

  it('retry sends a state changed during the failing save', async () => {
    const { save, queue, pending } = setup(baseAt(3))
    queue.schedule(state(1), { immediate: true })
    const b = state(2)
    queue.schedule(b)
    await settle(pending[0], { kind: 'error', message: 'x' })
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.status.value).toBe('error')
    queue.retry()
    expect(save).toHaveBeenLastCalledWith(b, baseAt(3))
  })

  it('schedule after an error starts a normal new attempt', async () => {
    const { save, queue, pending } = setup(baseAt(3))
    queue.schedule(state(1), { immediate: true })
    await settle(pending[0], { kind: 'error', message: 'x' })
    const b = state(2)
    queue.schedule(b)
    expect(queue.status.value).toBe('pending')
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(b, baseAt(3))
  })

  it('treats a rejected save as an error with a generic message and recovers on retry', async () => {
    const save = vi
      .fn<FamilyRepository['save']>()
      .mockRejectedValueOnce('boom')
      .mockResolvedValueOnce(ok(2))
    const queue = createSaveQueue(save, baseAt(1))
    const a = state(1)
    queue.schedule(a, { immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.status.value).toBe('error')
    expect(queue.lastError.value).toBe('Nie udało się zapisać danych.')
    expect(queue.hasUnsaved()).toBe(true)
    queue.retry()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(a, baseAt(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.status.value).toBe('saved')
  })

  it('uses the message of a rejected Error and lets a later schedule save again', async () => {
    const save = vi
      .fn<FamilyRepository['save']>()
      .mockRejectedValueOnce(new Error('Dysk odłączony'))
      .mockResolvedValueOnce(ok(2))
    const queue = createSaveQueue(save, baseAt(1))
    queue.schedule(state(1), { immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.status.value).toBe('error')
    expect(queue.lastError.value).toBe('Dysk odłączony')
    const b = state(2)
    queue.schedule(b)
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(b, baseAt(1))
  })

  it('falls back to the generic message for an Error without a message', async () => {
    const save = vi.fn<FamilyRepository['save']>().mockRejectedValueOnce(new Error(''))
    const queue = createSaveQueue(save, baseAt(1))
    queue.schedule(state(1), { immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.lastError.value).toBe('Nie udało się zapisać danych.')
  })

  it('retry does nothing outside the error status', () => {
    const { save, queue } = setup()
    queue.retry()
    queue.schedule(state(1))
    queue.retry()
    expect(save).not.toHaveBeenCalled()
    expect(queue.status.value).toBe('pending')
  })

  it('flushOnUnload sends the pending state at once with keepalive', async () => {
    const { save, queue } = setup(baseAt(2))
    const a = state(1)
    queue.schedule(a)
    queue.flushOnUnload()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(a, baseAt(2), { keepalive: true })
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flushOnUnload without changes does not call save', async () => {
    const { save, queue, pending } = setup()
    queue.flushOnUnload()
    queue.schedule(state(1), { immediate: true })
    await settle(pending[0], ok(2))
    queue.flushOnUnload()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flushOnUnload during a save does nothing', () => {
    const { save, queue } = setup()
    queue.schedule(state(1), { immediate: true })
    queue.schedule(state(2))
    queue.flushOnUnload()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flushOnUnload in error sends the newest state with keepalive', async () => {
    const { save, queue, pending } = setup(baseAt(4))
    const a = state(1)
    queue.schedule(a, { immediate: true })
    await settle(pending[0], { kind: 'error', message: 'x' })
    queue.flushOnUnload()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(a, baseAt(4), { keepalive: true })
  })

  it('hasUnsaved is true in pending, saving and error, false in saved', async () => {
    const { queue, pending } = setup()
    queue.schedule(state(1))
    expect(queue.status.value).toBe('pending')
    expect(queue.hasUnsaved()).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(queue.status.value).toBe('saving')
    expect(queue.hasUnsaved()).toBe(true)
    await settle(pending[0], ok(2))
    expect(queue.status.value).toBe('saved')
    expect(queue.hasUnsaved()).toBe(false)
    queue.schedule(state(2), { immediate: true })
    await settle(pending[1], { kind: 'error', message: 'x' })
    expect(queue.hasUnsaved()).toBe(true)
  })
})
