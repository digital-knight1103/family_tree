// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupFile, backupFileName, writeFileAtomic, type FsLike } from './file-io'

const NO_DELAYS = [0, 0, 0, 0, 0]

function failingRename(code: string, failures: number): FsLike & { calls: number } {
  const impl = {
    calls: 0,
    async rename(a: string, b: string) {
      impl.calls++
      if (impl.calls <= failures) {
        throw Object.assign(new Error(code), { code })
      }
      await fs.rename(a, b)
    },
  }
  return impl
}

describe('file-io', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-io-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  describe('writeFileAtomic', () => {
    it('zapisuje treść i nie zostawia pliku tymczasowego', async () => {
      const target = path.join(dir, 'family.json')
      await writeFileAtomic(target, 'abc', undefined, NO_DELAYS)
      expect(await fs.readFile(target, 'utf8')).toBe('abc')
      expect(await fs.readdir(dir)).toEqual(['family.json'])
    })

    it('ponawia rename po EPERM i kończy sukcesem', async () => {
      const target = path.join(dir, 'family.json')
      const fsImpl = failingRename('EPERM', 2)
      await writeFileAtomic(target, 'x', fsImpl, NO_DELAYS)
      expect(fsImpl.calls).toBe(3)
      expect(await fs.readFile(target, 'utf8')).toBe('x')
    })

    it('po 6 nieudanych próbach rzuca błąd, zostawia cel bez zmian i usuwa plik tymczasowy', async () => {
      const target = path.join(dir, 'family.json')
      await fs.writeFile(target, 'stare')
      const fsImpl = failingRename('EPERM', 100)
      await expect(writeFileAtomic(target, 'nowe', fsImpl, NO_DELAYS)).rejects.toMatchObject({
        code: 'EPERM',
      })
      expect(fsImpl.calls).toBe(6)
      expect(await fs.readFile(target, 'utf8')).toBe('stare')
      expect(await fs.readdir(dir)).toEqual(['family.json'])
    })

    it('nie ponawia błędu ENOENT', async () => {
      const target = path.join(dir, 'family.json')
      const fsImpl = failingRename('ENOENT', 100)
      await expect(writeFileAtomic(target, 'x', fsImpl, NO_DELAYS)).rejects.toMatchObject({
        code: 'ENOENT',
      })
      expect(fsImpl.calls).toBe(1)
      expect(await fs.readdir(dir)).toEqual([])
    })
  })

  describe('backupFileName', () => {
    it('formatuje czas lokalny', () => {
      expect(backupFileName(new Date(2026, 10, 4, 9, 5, 7, 42))).toBe(
        'family-2026-11-04_09-05-07-042.json',
      )
    })
  })

  describe('backupFile', () => {
    it('zwraca null, gdy źródło nie istnieje', async () => {
      const result = await backupFile(
        path.join(dir, 'brak.json'),
        path.join(dir, '.backups'),
        new Date(),
      )
      expect(result).toBeNull()
    })

    it('zostawia dokładnie 20 najnowszych kopii i nie rusza obcych plików', async () => {
      const source = path.join(dir, 'family.json')
      const backups = path.join(dir, '.backups')
      await fs.writeFile(source, '{}')
      await fs.mkdir(backups)
      await fs.writeFile(path.join(backups, 'notatka.txt'), 'x')
      let last: string | null = null
      for (let i = 0; i < 25; i++) {
        last = await backupFile(source, backups, new Date(2026, 10, 4, 9, 0, i))
      }
      const files = (await fs.readdir(backups)).filter((f) => f.startsWith('family-')).sort()
      expect(files).toHaveLength(20)
      expect(files[0]).toBe(backupFileName(new Date(2026, 10, 4, 9, 0, 5)))
      expect(last).toBe(path.join(backups, backupFileName(new Date(2026, 10, 4, 9, 0, 24))))
      expect(await fs.readdir(backups)).toContain('notatka.txt')
    })
  })
})
