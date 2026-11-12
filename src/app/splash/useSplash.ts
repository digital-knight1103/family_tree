import { onScopeDispose, readonly, ref, type Ref } from 'vue'
import { SPLASH } from '@/app/splash/splash-config'

export type SplashPhase = 'visible' | 'leaving' | 'done'

type SplashStorage = Pick<Storage, 'getItem' | 'setItem'>

function alreadyShown(storage: SplashStorage | undefined): boolean {
  try {
    return storage?.getItem(SPLASH.sessionKey) === '1'
  } catch {
    return false
  }
}

function markShown(storage: SplashStorage | undefined): void {
  try {
    storage?.setItem(SPLASH.sessionKey, '1')
  } catch {
    // Storage blocked: the splash shows again on the next load.
  }
}

function defaultStorage(): SplashStorage | undefined {
  try {
    return sessionStorage
  } catch {
    return undefined
  }
}

/** Once per tab session: `visible` → `leaving` (fade) → `done`; under reduced motion straight to `done`. */
export function useSplash(opts: { reducedMotion: Ref<boolean>; storage?: SplashStorage }) {
  const storage = opts.storage ?? defaultStorage()
  const phase = ref<SplashPhase>(alreadyShown(storage) ? 'done' : 'visible')
  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule(next: () => void, ms: number): void {
    clearTimeout(timer)
    timer = setTimeout(next, ms)
  }

  function finish(): void {
    clearTimeout(timer)
    timer = undefined
    phase.value = 'done'
  }

  function leave(): void {
    if (opts.reducedMotion.value) return finish()
    phase.value = 'leaving'
    schedule(finish, SPLASH.fadeOutMs)
  }

  function skip(): void {
    if (phase.value === 'visible') leave()
  }

  if (phase.value === 'visible') {
    markShown(storage)
    const duration = opts.reducedMotion.value ? SPLASH.reducedMotionDurationMs : SPLASH.durationMs
    schedule(leave, duration)
  }

  onScopeDispose(() => clearTimeout(timer))

  return { phase: readonly(phase), skip }
}
