import { vi } from 'vitest'

type ChangeEvent = { matches: boolean; media: string }
type Listener = (event: ChangeEvent) => void

/** Controllable `window.matchMedia` for jsdom: `set(query, matches)` fires `change` listeners. */
export function installMatchMedia(initial: Record<string, boolean> = {}) {
  const state = new Map(Object.entries(initial))
  const lists = new Map<string, Set<Listener>>()
  const matchMedia = vi.fn((query: string) => {
    const listeners = lists.get(query) ?? new Set()
    lists.set(query, listeners)
    return {
      media: query,
      get matches() {
        return state.get(query) ?? false
      },
      onchange: null,
      addEventListener: (_: string, fn: Listener) => listeners.add(fn),
      removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
      addListener: (fn: Listener) => listeners.add(fn),
      removeListener: (fn: Listener) => listeners.delete(fn),
      dispatchEvent: () => true,
    }
  })
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    set(query: string, matches: boolean) {
      state.set(query, matches)
      for (const fn of lists.get(query) ?? []) fn({ matches, media: query })
    },
  }
}

export const DARK_QUERY = '(prefers-color-scheme: dark)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
