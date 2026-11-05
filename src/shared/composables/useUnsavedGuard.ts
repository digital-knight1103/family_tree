import { useEventListener } from '@vueuse/core'

interface UnsavedSource {
  flushOnUnload(): void
  hasUnsaved(): boolean
}

export function useUnsavedGuard(store: UnsavedSource) {
  useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
    store.flushOnUnload()
    if (store.hasUnsaved()) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}
