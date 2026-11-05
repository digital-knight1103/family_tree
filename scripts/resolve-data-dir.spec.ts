// @vitest-environment node
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveDataDir } from './resolve-data-dir'

const root = path.resolve('/projekt/Claude Code Project/family_tree')

describe('resolveDataDir', () => {
  it('domyślnie wskazuje data/family w projekcie', () => {
    expect(resolveDataDir({}, root)).toBe(path.join(root, 'data', 'family'))
  })

  it('traktuje pustą zmienną jak brak zmiennej', () => {
    expect(resolveDataDir({ FAMILY_DATA_DIR: '  ' }, root)).toBe(path.join(root, 'data', 'family'))
  })

  it('zostawia ścieżkę absolutną ze spacjami i polskimi znakami bez zmian', () => {
    const absolute = path.resolve('/Moje Dane/Rodzina Łódź')
    expect(resolveDataDir({ FAMILY_DATA_DIR: absolute }, root)).toBe(absolute)
  })

  it('rozwiązuje ścieżkę względną względem projektu', () => {
    expect(resolveDataDir({ FAMILY_DATA_DIR: 'dane/rodzina' }, root)).toBe(
      path.resolve(root, 'dane/rodzina'),
    )
  })
})
