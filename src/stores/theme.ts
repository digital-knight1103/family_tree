import { computed, ref, watchEffect } from 'vue'
import { defineStore } from 'pinia'
import { usePreferredDark } from '@vueuse/core'

export type Theme = 'light' | 'dark'

/** Also read by the inline script in `index.html`, which applies the theme before the first paint. */
export const THEME_STORAGE_KEY = 'drzewo-rodzinne:theme'

export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return systemDark ? 'dark' : 'light'
}

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage blocked: the choice lasts until the tab closes.
  }
}

export const useThemeStore = defineStore('theme', () => {
  const systemDark = usePreferredDark()
  const stored = ref(readStored())
  const theme = computed(() => resolveTheme(stored.value, systemDark.value))

  watchEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme.value === 'dark')
    root.style.colorScheme = theme.value
  })

  function toggle(): void {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
    stored.value = next
    writeStored(next)
  }

  return { theme, toggle }
})
