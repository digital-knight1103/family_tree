// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FamilyData } from '../src/domain/schema.ts'
import {
  checkDistForCanary,
  checkDistHasNoDataFiles,
  checkDistMatchesSeed,
  checkTrackedFiles,
} from './check-no-leaks.ts'

describe('checkTrackedFiles', () => {
  it('flags files under data/family/', () => {
    expect(checkTrackedFiles(['data/family/family.json', 'src/a.ts'])).toHaveLength(1)
  })

  it('allows the seed', () => {
    expect(checkTrackedFiles(['data/seed/demo-family.json'])).toEqual([])
  })

  it('allows images in public/ and src/assets/', () => {
    expect(checkTrackedFiles(['public/logo.png', 'src/assets/hero.webp'])).toEqual([])
  })

  it('allows exactly docs/screenshot.png, not other images in docs/', () => {
    expect(checkTrackedFiles(['docs/screenshot.png'])).toEqual([])
    expect(checkTrackedFiles(['docs/zdjecie.png'])).toHaveLength(1)
    expect(checkTrackedFiles(['docs/plans/screenshot.png'])).toHaveLength(1)
  })

  it('flags images elsewhere, case-insensitively', () => {
    const result = checkTrackedFiles(['docs/foto.PNG', 'data/seed/a.jpg', 'x/b.jpeg', 'x/c.webp'])
    expect(result).toHaveLength(4)
    expect(result[0]).toContain('docs/foto.PNG')
  })
})

describe('dist checks', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'leaks-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('finds the canary in nested text and binary files', async () => {
    await fs.mkdir(path.join(dir, 'assets'))
    await fs.writeFile(path.join(dir, 'assets', 'a.js'), 'x CANARY_LEAK_TEST_7f3a y')
    await fs.writeFile(path.join(dir, 'b.bin'), Buffer.from([0, 1, 2]))
    const result = checkDistForCanary(dir, 'CANARY_LEAK_TEST_7f3a')
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('a.js')
  })

  it('returns nothing for a clean dist', async () => {
    await fs.writeFile(path.join(dir, 'a.js'), 'Kowalczyk')
    expect(checkDistForCanary(dir, 'CANARY_LEAK_TEST_7f3a')).toEqual([])
    expect(checkDistHasNoDataFiles(dir)).toEqual([])
  })

  it('flags family.json, photos/, .backups and .webp', async () => {
    await fs.mkdir(path.join(dir, 'x', 'photos'), { recursive: true })
    await fs.mkdir(path.join(dir, '.backups'))
    await fs.writeFile(path.join(dir, 'family.json'), '{}')
    await fs.writeFile(path.join(dir, 'x', 'photos', 'a.txt'), '')
    await fs.writeFile(path.join(dir, 'p.WEBP'), '')
    const result = checkDistHasNoDataFiles(dir)
    expect(result).toHaveLength(4)
  })
})

describe('checkDistMatchesSeed', () => {
  let dir: string
  const seed = {
    persons: [{ id: 'p_anna_kowalczyk' }, { id: 'p_jan_kowalczyk' }],
  } as unknown as FamilyData
  const write = (name: string, content: string) =>
    fs.writeFile(path.join(dir, 'assets', name), content)

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'leaks-seed-'))
    await fs.mkdir(path.join(dir, 'assets'))
    await write(
      'demo-family.js',
      'var e={persons:[{id:`p_anna_kowalczyk`},{id:`p_jan_kowalczyk`}]}',
    )
    // Unrelated strings from bundled libraries must not count as person ids.
    await write('index.js', 'var r=[`strip_references`,`p_`,"np_abcdefghij"];var p_abcdefghij=1')
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('accepts a dist that embeds exactly the seed persons', () => {
    expect(checkDistMatchesSeed(dir, seed)).toEqual([])
  })

  it('flags each person id from outside the seed, in any quoting', async () => {
    await write('chunk.js', `x={id:"p_k3x9q0m2ab"};y=JSON.parse('{\\"id\\":\\"p_zz00aa11bb\\"}')`)
    const result = checkDistMatchesSeed(dir, seed)
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('p_k3x9q0m2ab')
    expect(result[1]).toContain('p_zz00aa11bb')
  })

  it('flags a seed person missing from the dist', async () => {
    await write('demo-family.js', 'var e={persons:[{id:`p_anna_kowalczyk`}]}')
    const result = checkDistMatchesSeed(dir, seed)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('p_jan_kowalczyk')
  })
})
