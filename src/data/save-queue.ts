import { ref, type Ref } from 'vue'
import type { FamilyData } from '@/domain/schema'
import {
  saveRequestBody,
  type FamilyRepository,
  type SaveBase,
  type SaveResult,
} from './repository'

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
// Browsers reject a keepalive request whose body exceeds 64 KiB (summed over all
// in-flight keepalive requests), so a larger final save goes out as a normal request
// and the beforeunload warning stays up until it settles.
export const KEEPALIVE_LIMIT_BYTES = 60_000
const SAVE_FAILED_MESSAGE = 'Nie udało się zapisać danych.'

function rejectionMessage(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : SAVE_FAILED_MESSAGE
}

export function createSaveQueue(
  save: FamilyRepository['save'],
  initialBase: SaveBase,
  opts: { debounceMs?: number } = {},
): SaveQueue {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const status = ref<SaveStatus>('idle')
  const lastError = ref<string | null>(null)

  let base = initialBase
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
    base = { revision: result.revision, hash: result.hash }
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
    const request = keepalive ? save(data, base, { keepalive: true }) : save(data, base)
    // A rejected save must not leave the queue stuck in 'saving'.
    void request.then(onResult, (error: unknown) =>
      onResult({ kind: 'error', message: rejectionMessage(error) }),
    )
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
      if (inFlight || !latest) return
      if (status.value !== 'pending' && status.value !== 'error') return
      const bytes = new TextEncoder().encode(saveRequestBody(latest, base)).length
      send(bytes <= KEEPALIVE_LIMIT_BYTES)
    },
    retry() {
      if (status.value === 'error' && !inFlight) send(false)
    },
    hasUnsaved() {
      return status.value === 'pending' || status.value === 'saving' || status.value === 'error'
    },
  }
}
