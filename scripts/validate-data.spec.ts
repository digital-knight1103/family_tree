// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildFamily } from '@tests/fixtures/build-family'
import type { FamilyData } from '../src/domain/schema'
import { validateFile } from './validate-data'

const SEED_PATH = path.resolve(import.meta.dirname, '..', 'data', 'seed', 'demo-family.json')

let tempDir: string | undefined

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  tempDir = undefined
})

function writeTempFile(content: string): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-data-'))
  const file = path.join(tempDir, 'family.json')
  fs.writeFileSync(file, content)
  return file
}

describe('validateFile', () => {
  it('akceptuje dane demo', () => {
    expect(validateFile(SEED_PATH)).toEqual({ ok: true })
  })

  it('zgłasza cykl z raportem wskazującym relację', () => {
    const data = buildFamily({
      persons: [{ id: 'p_A' }, { id: 'p_B' }],
      parentChild: [
        ['p_A', 'p_B'],
        ['p_B', 'p_A'],
      ],
    })
    const result = validateFile(writeTempFile(JSON.stringify(data)))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.report).toContain('parentChild')
  })
})

describe('dane demo', () => {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as FamilyData

  function longestAncestorChain(data: FamilyData): number {
    const depth = new Map<string, number>()
    const depthOf = (id: string): number => {
      const known = depth.get(id)
      if (known !== undefined) return known
      const parents = data.parentChild.filter((r) => r.childId === id).map((r) => r.parentId)
      const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(depthOf))
      depth.set(id, value)
      return value
    }
    return Math.max(...data.persons.map((p) => depthOf(p.id)))
  }

  const facts = seed.persons.flatMap((p) => [p.birth, p.death]).filter((f) => f !== undefined)

  it('ma co najmniej 15 osób i 4 pokolenia', () => {
    expect(seed.persons.length).toBeGreaterThanOrEqual(15)
    expect(longestAncestorChain(seed)).toBeGreaterThanOrEqual(3)
  })

  it('ma osobę nieznaną, datę z kwalifikatorem i fakt do potwierdzenia', () => {
    expect(seed.persons.some((p) => !p.givenNames.trim() && !p.surname.trim())).toBe(true)
    expect(facts.some((f) => f.date?.qualifier !== undefined)).toBe(true)
    expect(facts.some((f) => f.unconfirmed === true)).toBe(true)
  })

  it('ma ustawioną osobę „Ja” i zerową rewizję bez zdjęć', () => {
    expect(seed.settings.selfPersonId).toBeDefined()
    expect(seed.revision).toBe(0)
    expect(seed.persons.every((p) => p.photo === undefined)).toBe(true)
  })
})
