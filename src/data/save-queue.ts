import { ref, type Ref } from 'vue'
import type { FamilyData } from '@/domain/schema'
import type { FamilyRepository, SaveResult } from './repository'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'

export interface SaveQueue {
  schedule(data: FamilyData, opts?: { immediate?: boolean }): void
  flushOnUnload(): void
  retry(): void
  hasUnsaved(): boolean
  readonly status: Ref<SaveStatus>
  readonly lastError: Ref<string | null>
}

const DEFAULT_DEBOUNCE_MS = 500

export function createSaveQueue(
  save: FamilyRepository['save'],
  initialRevision: number,
  opts: { debounceMs?: number } = {},
): SaveQueue {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const status = ref<SaveStatus>('idle')
  const lastError = ref<string | null>(null)

  let baseRevision = initialRevision
  let latest: FamilyData | undefined
  let newerThanSent = false
  let inFlight = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function onResult(result: SaveResult) {
    inFlight = false
    if (result.kind === 'conflict') {
      newerThanSent = false
      status.value = 'conflict'
      return
    }
    if (result.kind === 'error') {
      lastError.value = result.message
      status.value = 'error'
      return
    }
    baseRevision = result.revision
    lastError.value = null
    if (newerThanSent) send(false)
    else status.value = 'saved'
  }

  function send(keepalive: boolean) {
    if (!latest) return
    clearTimer()
    const data = latest
    newerThanSent = false
    inFlight = true
    status.value = 'saving'
    const request = keepalive
      ? save(data, baseRevision, { keepalive: true })
      : save(data, baseRevision)
    void request.then(onResult)
  }

  return {
    status,
    lastError,
    schedule(data, scheduleOpts) {
      if (status.value === 'conflict') return
      latest = data
      newerThanSent = true
      if (inFlight) return
      clearTimer()
      if (scheduleOpts?.immediate) {
        send(false)
        return
      }
      status.value = 'pending'
      timer = setTimeout(() => send(false), debounceMs)
    },
    flushOnUnload() {
      if (inFlight) return
      if (status.value === 'pending' || status.value === 'error') send(true)
    },
    retry() {
      if (status.value === 'error' && !inFlight) send(false)
    },
    hasUnsaved() {
      return status.value === 'pending' || status.value === 'saving' || status.value === 'error'
    },
  }
}
