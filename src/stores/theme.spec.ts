import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { THEME_STORAGE_KEY, resolveTheme, useThemeStore } from '@/stores/theme'
import { DARK_QUERY, installMatchMedia } from '@tests/fixtures/match-media'

describe('resolveTheme', () => {
  it('zapamiętany wybór wygrywa z systemem', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('brak albo zła wartość: według systemu', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme('purple', false)).toBe('light')
    expect(resolveTheme('', true)).toBe('dark')
  })
})

describe('useThemeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('bez wyboru idzie za systemem na żywo', async () => {
    const media = installMatchMedia({ [DARK_QUERY]: false })
    const store = useThemeStore()
    await nextTick()
    expect(store.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    media.set(DARK_QUERY, true)
    await nextTick()
    expect(store.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('przełącznik zapamiętuje wybór i odcina system', async () => {
    const media = installMatchMedia({ [DARK_QUERY]: false })
    const store = useThemeStore()
    store.toggle()
    await nextTick()
    expect(store.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    media.set(DARK_QUERY, false)
    media.set(DARK_QUERY, true)
    media.set(DARK_QUERY, false)
    await nextTick()
    expect(store.theme).toBe('dark')
  })

  it('czyta zapamiętany wybór przy starcie', () => {
    installMatchMedia({ [DARK_QUERY]: true })
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(useThemeStore().theme).toBe('light')
  })

  it('zablokowany localStorage nie rzuca', async () => {
    installMatchMedia({ [DARK_QUERY]: true })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const store = useThemeStore()
    expect(store.theme).toBe('dark')
    store.toggle()
    await nextTick()
    expect(store.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
