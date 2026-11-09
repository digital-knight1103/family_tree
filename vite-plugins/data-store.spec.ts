// @vitest-environment node
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyFamilyData, type FamilyData } from '../src/domain/schema'
import { buildFamily } from '@tests/fixtures/build-family'
import { createDataStore } from './data-store'

describe('data-store', () => {
  let dir: string
  let file: string
  let backups: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dane rodziny ł-'))
    file = path.join(dir, 'family.json')
    backups = path.join(dir, '.backups')
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  const family = (): FamilyData => buildFamily({ persons: [{ id: 'p_1' }, { id: 'p_2' }] })

  async function seed(data: FamilyData = family()): Promise<void> {
    await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n')
  }

  async function backupNames(): Promise<string[]> {
    return fs.readdir(backups).catch(() => [])
  }

  const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

  const fileHash = async () => sha256(await fs.readFile(file))

  async function readBase(store: ReturnType<typeof createDataStore>) {
    const result = await store.read()
    if (result.kind !== 'ok') throw new Error(`read gave ${result.kind}`)
    return { revision: result.data.revision, hash: result.hash }
  }

  async function editManually(): Promise<string> {
    const edited = (await fs.readFile(file, 'utf8')).replace('"Test"', '"Test "')
    await fs.writeFile(file, edited)
    return edited
  }

  const staleBase = (revision = 0) => ({ revision, hash: '0'.repeat(64) })

  const bomCrlf = () => '﻿' + JSON.stringify(family(), null, 2).replace(/\n/g, '\r\n')

  describe('read', () => {
    it('brak pliku daje missing', async () => {
      const result = await createDataStore(dir).read()
      expect(result).toEqual({ kind: 'missing', filePath: file })
    })

    it('plik 0 bajtów daje invalid', async () => {
      await fs.writeFile(file, '')
      const result = await createDataStore(dir).read()
      expect(result.kind).toBe('invalid')
    })

    it('ucięty JSON daje invalid', async () => {
      await fs.writeFile(file, '{"version": 1, "persons": [')
      const result = await createDataStore(dir).read()
      expect(result.kind).toBe('invalid')
    })

    it('plik z BOM i CRLF daje ok ze skrótem surowych bajtów razem z BOM', async () => {
      await fs.writeFile(file, bomCrlf())
      const result = await createDataStore(dir).read()
      expect(result).toEqual({ kind: 'ok', filePath: file, data: family(), hash: await fileHash() })
    })
  })

  describe('write', () => {
    it('zapis z poprawną bazą podnosi rewizję, zwraca skrót i robi kopię poprzedniej treści', async () => {
      await seed()
      const before = await fs.readFile(file, 'utf8')
      const store = createDataStore(dir)
      const base = await readBase(store)
      const next = {
        ...family(),
        persons: [...family().persons, buildFamily({ persons: [{ id: 'p_3' }] }).persons[0]],
      }

      const result = await store.write(next, base)

      expect(result).toEqual({ kind: 'ok', revision: 1, hash: await fileHash() })
      const saved = JSON.parse(await fs.readFile(file, 'utf8')) as FamilyData
      expect(saved.revision).toBe(1)
      expect(saved.persons).toHaveLength(3)
      const names = await backupNames()
      expect(names).toHaveLength(1)
      expect(await fs.readFile(path.join(backups, names[0]), 'utf8')).toBe(before)
    })

    it('zapis jest wcięty 2 spacjami, kończy się \\n i trzyma kolejność kluczy schematu', async () => {
      await seed(emptyFamilyData())
      const store = createDataStore(dir)
      const base = await readBase(store)
      const data = buildFamily({
        persons: [{ id: 'p_1' }, { id: 'p_2' }],
        unions: [['p_1', 'p_2']],
      })
      const shuffled = {
        unions: data.unions,
        persons: [
          {
            living: true,
            death: { place: 'Łódź', date: { day: 3, month: 2, year: 1900, qualifier: 'about' } },
            sex: 'female',
            surname: 'Nowak',
            givenNames: 'Anna',
            id: 'p_1',
          },
          data.persons[1],
        ],
        parentChild: [],
        settings: {},
        revision: 77,
        version: 1,
      } as unknown as FamilyData

      expect(await store.write(shuffled, base)).toMatchObject({ kind: 'ok', revision: 1 })

      const text = await fs.readFile(file, 'utf8')
      expect(text.endsWith('}\n')).toBe(true)
      expect(text).toContain('\n  "version": 1,\n  "revision": 1,\n  "settings": {},')
      const saved = JSON.parse(text) as FamilyData
      expect(Object.keys(saved)).toEqual([
        'version',
        'revision',
        'settings',
        'persons',
        'parentChild',
        'unions',
      ])
      expect(Object.keys(saved.persons[0])).toEqual([
        'id',
        'givenNames',
        'surname',
        'sex',
        'death',
        'living',
      ])
      expect(Object.keys(saved.persons[0].death!)).toEqual(['date', 'place'])
      expect(Object.keys(saved.persons[0].death!.date!)).toEqual([
        'year',
        'month',
        'day',
        'qualifier',
      ])
      expect(Object.keys(saved.unions[0])).toEqual(['id', 'partnerIds', 'type'])
      expect(text).not.toContain('undefined')
    })

    it('starszy baseRevision daje conflict, plik bez zmian i bez nowej kopii', async () => {
      await seed({ ...family(), revision: 5 })
      const before = await fs.readFile(file, 'utf8')
      const store = createDataStore(dir)
      const base = await readBase(store)

      expect(await store.write(family(), { ...base, revision: 4 })).toEqual({ kind: 'conflict' })

      expect(await fs.readFile(file, 'utf8')).toBe(before)
      expect(await backupNames()).toEqual([])
    })

    it('ręczna zmiana pliku po read bez zmiany rewizji daje conflict', async () => {
      await seed()
      const store = createDataStore(dir)
      const base = await readBase(store)
      const edited = await editManually()

      expect(await store.write(family(), base)).toEqual({ kind: 'conflict' })

      expect(await fs.readFile(file, 'utf8')).toBe(edited)
      expect(await backupNames()).toEqual([])
    })

    it('odczyt z innej karty po ręcznej zmianie nie zatwierdza jej dla starej karty', async () => {
      await seed()
      const store = createDataStore(dir)
      const tabA = await readBase(store)
      const edited = await editManually()
      await readBase(store)

      expect(await store.write(family(), tabA)).toEqual({ kind: 'conflict' })

      expect(await fs.readFile(file, 'utf8')).toBe(edited)
      expect(await backupNames()).toEqual([])
    })

    it('po restarcie serwera zapis z nieaktualnym skrótem daje conflict', async () => {
      await seed()
      const tabA = await readBase(createDataStore(dir))
      const edited = await editManually()

      expect(await createDataStore(dir).write(family(), tabA)).toEqual({ kind: 'conflict' })
      expect(await createDataStore(dir).write(family(), staleBase())).toEqual({
        kind: 'conflict',
      })

      expect(await fs.readFile(file, 'utf8')).toBe(edited)
      expect(await backupNames()).toEqual([])
    })

    it('zapis po odczycie pliku z BOM i CRLF z jego skrótem przechodzi', async () => {
      await fs.writeFile(file, bomCrlf())
      const store = createDataStore(dir)
      const base = await readBase(store)

      expect(await store.write(family(), base)).toEqual({
        kind: 'ok',
        revision: 1,
        hash: await fileHash(),
      })
    })

    it('cykl w danych daje invalid, plik bez zmian i bez kopii', async () => {
      await seed()
      const before = await fs.readFile(file, 'utf8')
      const store = createDataStore(dir)
      const base = await readBase(store)
      const cycle = buildFamily({
        persons: [{ id: 'p_1' }, { id: 'p_2' }],
        parentChild: [
          ['p_1', 'p_2'],
          ['p_2', 'p_1'],
        ],
      })

      const result = await store.write(cycle, base)

      expect(result.kind).toBe('invalid')
      expect(await fs.readFile(file, 'utf8')).toBe(before)
      expect(await backupNames()).toEqual([])
    })

    it('uszkodzony plik 0 bajtów blokuje zapis i zostaje bez zmian', async () => {
      await fs.writeFile(file, '')
      const result = await createDataStore(dir).write(family(), staleBase())
      expect(result.kind).toBe('blocked')
      expect((await fs.stat(file)).size).toBe(0)
      expect(await backupNames()).toEqual([])
    })

    it('brak pliku daje missing i nie tworzy pliku', async () => {
      expect(await createDataStore(dir).write(family(), staleBase())).toEqual({
        kind: 'missing',
      })
      await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
    })

    it('kolejne zapisy ze zwróconą rewizją i skrótem przechodzą bez ponownego read', async () => {
      await seed()
      const store = createDataStore(dir)
      const first = await store.write(family(), await readBase(store))
      expect(first).toMatchObject({ kind: 'ok', revision: 1 })
      if (first.kind !== 'ok') return

      const second = await store.write(family(), { revision: first.revision, hash: first.hash })

      expect(second).toEqual({ kind: 'ok', revision: 2, hash: await fileHash() })
    })

    it('dwa równoległe zapisy z tą samą bazą: jeden ok, jeden conflict, rewizja +1', async () => {
      await seed()
      const store = createDataStore(dir)
      const base = await readBase(store)

      const results = await Promise.all([store.write(family(), base), store.write(family(), base)])

      expect(results.map((r) => r.kind).sort()).toEqual(['conflict', 'ok'])
      const saved = JSON.parse(await fs.readFile(file, 'utf8')) as FamilyData
      expect(saved.revision).toBe(1)
      expect(await backupNames()).toHaveLength(1)
    })
  })

  describe('createNew', () => {
    it('przy braku pliku tworzy plik z emptyFamilyData i zwraca jego skrót', async () => {
      const result = await createDataStore(dir).createNew()
      expect(result).toEqual({ kind: 'ok', data: emptyFamilyData(), hash: await fileHash() })
      expect(await fs.readFile(file, 'utf8')).toBe(
        JSON.stringify(emptyFamilyData(), null, 2) + '\n',
      )
    })

    it('tworzy brakujący folder danych', async () => {
      const nested = path.join(dir, 'a', 'b')
      const result = await createDataStore(nested).createNew()
      expect(result.kind).toBe('ok')
      await expect(fs.stat(path.join(nested, 'family.json'))).resolves.toBeDefined()
    })

    it('przy istniejącym pliku daje exists i go nie rusza', async () => {
      await fs.writeFile(file, 'cokolwiek')
      expect(await createDataStore(dir).createNew()).toEqual({ kind: 'exists' })
      expect(await fs.readFile(file, 'utf8')).toBe('cokolwiek')
    })

    it('zapis zaraz po utworzeniu z otrzymanym skrótem przechodzi', async () => {
      const created = await createDataStore(dir).createNew()
      if (created.kind !== 'ok') throw new Error('createNew should succeed')

      const result = await createDataStore(dir).write(family(), {
        revision: created.data.revision,
        hash: created.hash,
      })

      expect(result).toMatchObject({ kind: 'ok', revision: 1 })
    })
  })
})
