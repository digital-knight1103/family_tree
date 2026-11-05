// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkDistForCanary, checkDistHasNoDataFiles, checkTrackedFiles } from './check-no-leaks.ts'

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
