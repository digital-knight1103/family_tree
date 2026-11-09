import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useUnsavedGuard } from './useUnsavedGuard'

function fakeStore(unsaved: boolean) {
  return { flushOnUnload: vi.fn(), hasUnsaved: vi.fn(() => unsaved) }
}

function fire() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('useUnsavedGuard', () => {
  it('prevents unload and flushes when there are unsaved changes', () => {
    const store = fakeStore(true)
    const scope = effectScope()
    scope.run(() => useUnsavedGuard(store))
    const event = fire()
    expect(event.defaultPrevented).toBe(true)
    expect(store.flushOnUnload).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('does not prevent unload without changes but still flushes on every event', () => {
    const store = fakeStore(false)
    const scope = effectScope()
    scope.run(() => useUnsavedGuard(store))
    expect(fire().defaultPrevented).toBe(false)
    fire()
    expect(store.flushOnUnload).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('stops listening when the scope is disposed', () => {
    const store = fakeStore(true)
    const scope = effectScope()
    scope.run(() => useUnsavedGuard(store))
    scope.stop()
    expect(fire().defaultPrevented).toBe(false)
    expect(store.flushOnUnload).not.toHaveBeenCalled()
  })
})
