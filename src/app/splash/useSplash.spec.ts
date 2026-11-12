import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { SPLASH } from '@/app/splash/splash-config'
import { useSplash } from '@/app/splash/useSplash'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  }
}

function start(opts: Parameters<typeof useSplash>[0]) {
  const scope = effectScope()
  const result = scope.run(() => useSplash(opts))!
  return { ...result, scope }
}

describe('useSplash', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pokazuje się, po czasie wygasa i kończy; klucz zapisany od razu', () => {
    const storage = memoryStorage()
    const { phase } = start({ reducedMotion: ref(false), storage })

    expect(phase.value).toBe('visible')
    expect(storage.map.get(SPLASH.sessionKey)).toBe('1')

    vi.advanceTimersByTime(SPLASH.durationMs - 1)
    expect(phase.value).toBe('visible')
    vi.advanceTimersByTime(1)
    expect(phase.value).toBe('leaving')
    vi.advanceTimersByTime(SPLASH.fadeOutMs)
    expect(phase.value).toBe('done')
  })

  it('w tej samej sesji karty od razu kończy, bez timerów', () => {
    const storage = memoryStorage({ [SPLASH.sessionKey]: '1' })
    const { phase } = start({ reducedMotion: ref(false), storage })

    expect(phase.value).toBe('done')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('przy reduced motion kończy po krótszym czasie, bez wygaszania', () => {
    const { phase } = start({ reducedMotion: ref(true), storage: memoryStorage() })

    expect(phase.value).toBe('visible')
    vi.advanceTimersByTime(SPLASH.reducedMotionDurationMs - 1)
    expect(phase.value).toBe('visible')
    vi.advanceTimersByTime(1)
    expect(phase.value).toBe('done')
  })

  it('skip() wygasza ekran od razu, potem kończy', () => {
    const { phase, skip } = start({ reducedMotion: ref(false), storage: memoryStorage() })

    skip()
    expect(phase.value).toBe('leaving')
    vi.advanceTimersByTime(SPLASH.fadeOutMs)
    expect(phase.value).toBe('done')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skip() przy reduced motion kończy od razu', () => {
    const { phase, skip } = start({ reducedMotion: ref(true), storage: memoryStorage() })

    skip()
    expect(phase.value).toBe('done')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skip() po zakończeniu nic nie robi', () => {
    const storage = memoryStorage({ [SPLASH.sessionKey]: '1' })
    const { phase, skip } = start({ reducedMotion: ref(false), storage })

    skip()
    expect(phase.value).toBe('done')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('zablokowany storage: ekran pokazuje się i kończy bez wyjątku', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const { phase } = start({ reducedMotion: ref(false), storage })

    expect(phase.value).toBe('visible')
    vi.advanceTimersByTime(SPLASH.durationMs + SPLASH.fadeOutMs)
    expect(phase.value).toBe('done')
  })

  it('timery czyszczone przy zamknięciu zakresu', () => {
    const { scope } = start({ reducedMotion: ref(false), storage: memoryStorage() })

    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
