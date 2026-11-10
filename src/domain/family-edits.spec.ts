import { describe, expect, it } from 'vitest'
import { buildFamily } from '@tests/fixtures/build-family'
import {
  addPerson,
  addRelative,
  canAddRelative,
  createId,
  needsCoParentChoice,
  type IdSource,
  type NewPersonInput,
} from './family-edits'
import { checkRelationRules } from './relation-rules'

const counterSource = (): IdSource => {
  let n = 0
  return () => `id${String(n++).padStart(8, '0')}`
}

const newPerson = (givenNames: string, sex: NewPersonInput['sex'] = 'unknown') =>
  ({ kind: 'new', person: { givenNames, surname: 'Nowak', sex } }) as const

const TOO_MANY = 'Osoba może mieć najwyżej dwoje rodziców biologicznych.'
const SELF_PARENT = 'Osoba nie może być swoim rodzicem.'

describe('createId', () => {
  it('has the prefix and ten lowercase alphanumerics', () => {
    expect(createId('p', new Set())).toMatch(/^p_[a-z0-9]{10}$/)
    expect(createId('u', new Set())).toMatch(/^u_[a-z0-9]{10}$/)
  })

  it('draws again on a collision', () => {
    const values = ['aaaaaaaaaa', 'aaaaaaaaaa', 'bbbbbbbbbb']
    const id = createId('p', new Set(['p_aaaaaaaaaa']), () => values.shift()!)
    expect(id).toBe('p_bbbbbbbbbb')
  })
})

describe('addPerson', () => {
  it('adds a person without a blank maiden name', () => {
    const draft = buildFamily({ persons: [] })
    const id = addPerson(draft, {
      givenNames: 'Anna',
      surname: 'Nowak',
      maidenName: ' ',
      sex: 'female',
    })
    expect(draft.persons).toEqual([
      { id, givenNames: 'Anna', surname: 'Nowak', sex: 'female', living: false },
    ])
    expect(draft.settings.selfPersonId).toBeUndefined()
  })

  it('marks the first person as self', () => {
    const draft = buildFamily({ persons: [] })
    const id = addPerson(
      draft,
      { givenNames: 'Jan', surname: 'Nowak', sex: 'male' },
      { self: true },
    )
    expect(draft.persons[0]).toMatchObject({ id, living: true })
    expect(draft.settings.selfPersonId).toBe(id)
  })
})

describe('child', () => {
  it('gets both partners of a single union', () => {
    const draft = buildFamily({ persons: [{ id: 'p_a' }, { id: 'p_b' }], unions: [['p_a', 'p_b']] })
    const id = addRelative(draft, 'p_a', 'child', newPerson('Dziecko'), { source: counterSource() })
    expect(draft.parentChild).toEqual([
      { parentId: 'p_a', childId: id, type: 'biological' },
      { parentId: 'p_b', childId: id, type: 'biological' },
    ])
    expect(checkRelationRules(draft)).toEqual([])
  })

  it('gets one parent without a union', () => {
    const draft = buildFamily({ persons: [{ id: 'p_a' }] })
    const id = addRelative(draft, 'p_a', 'child', newPerson('Dziecko'))
    expect(draft.parentChild).toEqual([{ parentId: 'p_a', childId: id, type: 'biological' }])
  })

  it('needs a co-parent choice with two unions', () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }],
      unions: [
        ['p_a', 'p_b'],
        ['p_a', 'p_c'],
      ],
    })
    expect(needsCoParentChoice(data, 'p_a')).toBe(true)
    expect(needsCoParentChoice(data, 'p_b')).toBe(false)

    const before = structuredClone(data)
    expect(() => addRelative(data, 'p_a', 'child', newPerson('X'))).toThrow(
      'Wybierz drugiego rodzica.',
    )
    expect(data).toEqual(before)

    const viaUnion = structuredClone(data)
    const id = addRelative(viaUnion, 'p_a', 'child', newPerson('X'), {
      coParent: { kind: 'union', unionId: 'u_2' },
    })
    expect(viaUnion.parentChild.map((r) => [r.parentId, r.childId])).toEqual([
      ['p_a', id],
      ['p_c', id],
    ])

    const alone = structuredClone(data)
    const id2 = addRelative(alone, 'p_a', 'child', newPerson('X'), { coParent: { kind: 'none' } })
    expect(alone.parentChild).toEqual([{ parentId: 'p_a', childId: id2, type: 'biological' }])
    expect(checkRelationRules(alone)).toEqual([])
  })

  it('rejects a union that does not belong to the anchor', () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }],
      unions: [['p_b', 'p_c']],
    })
    expect(() =>
      addRelative(data, 'p_a', 'child', newPerson('X'), {
        coParent: { kind: 'union', unionId: 'u_1' },
      }),
    ).toThrow('Wybrany związek nie należy do tej osoby.')
  })

  it('checks both parents for an existing child', () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }, { id: 'p_d' }],
      parentChild: [['p_c', 'p_d']],
      unions: [['p_a', 'p_b']],
    })
    expect(canAddRelative(data, 'p_a', 'child', { kind: 'existing', personId: 'p_d' })).toEqual({
      ok: false,
      reason: TOO_MANY,
    })
  })
})

describe('parent', () => {
  it('refuses a third biological parent and leaves the draft untouched', () => {
    const draft = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }],
      parentChild: [
        ['p_b', 'p_a'],
        ['p_c', 'p_a'],
      ],
    })
    const before = structuredClone(draft)
    expect(canAddRelative(draft, 'p_a', 'parent')).toEqual({ ok: false, reason: TOO_MANY })
    expect(() => addRelative(draft, 'p_a', 'parent', newPerson('X'))).toThrow(TOO_MANY)
    expect(draft).toEqual(before)
  })

  it('joins the second parent with the first when the first has no union', () => {
    const draft = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }],
      parentChild: [['p_b', 'p_a']],
    })
    const id = addRelative(draft, 'p_a', 'parent', newPerson('Matka'))
    expect(draft.unions).toHaveLength(1)
    expect(draft.unions[0]).toMatchObject({ partnerIds: ['p_b', id], type: 'marriage' })
    expect(checkRelationRules(draft)).toEqual([])
  })

  it('adds no union when the first parent already has a partner', () => {
    const draft = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }],
      parentChild: [['p_b', 'p_a']],
      unions: [['p_b', 'p_c']],
    })
    addRelative(draft, 'p_a', 'parent', newPerson('Matka'))
    expect(draft.unions).toHaveLength(1)
  })

  it('adds no union for the first parent', () => {
    const draft = buildFamily({ persons: [{ id: 'p_a' }] })
    addRelative(draft, 'p_a', 'parent', newPerson('Ojciec'))
    expect(draft.unions).toEqual([])
    expect(draft.parentChild).toHaveLength(1)
  })

  it('refuses a descendant as an existing parent', () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }],
      parentChild: [['p_a', 'p_b']],
    })
    expect(canAddRelative(data, 'p_a', 'parent', { kind: 'existing', personId: 'p_b' })).toEqual({
      ok: false,
      reason: 'Osoba nie może być swoim własnym przodkiem.',
    })
  })
})

describe('partner', () => {
  it('adds a new person and a marriage', () => {
    const draft = buildFamily({ persons: [{ id: 'p_a' }] })
    const id = addRelative(draft, 'p_a', 'partner', newPerson('Partner'), {
      source: counterSource(),
    })
    expect(draft.persons.map((p) => p.id)).toEqual(['p_a', id])
    expect(draft.unions).toEqual([
      { id: 'u_id00000001', partnerIds: ['p_a', id], type: 'marriage' },
    ])
    expect(checkRelationRules(draft)).toEqual([])
  })

  it('refuses an existing partner who already has a union with the anchor', () => {
    const data = buildFamily({ persons: [{ id: 'p_a' }, { id: 'p_b' }], unions: [['p_a', 'p_b']] })
    expect(canAddRelative(data, 'p_a', 'partner', { kind: 'existing', personId: 'p_b' })).toEqual({
      ok: false,
      reason: 'Ta para ma już związek.',
    })
  })
})

describe('sibling', () => {
  it('copies the anchor parents with their types', () => {
    const draft = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }],
      parentChild: [
        ['p_b', 'p_a'],
        ['p_c', 'p_a', 'adoptive'],
      ],
    })
    const id = addRelative(draft, 'p_a', 'sibling', newPerson('Brat'))
    expect(draft.parentChild.slice(2)).toEqual([
      { parentId: 'p_b', childId: id, type: 'biological' },
      { parentId: 'p_c', childId: id, type: 'adoptive' },
    ])
    expect(checkRelationRules(draft)).toEqual([])
  })

  it('creates one shared unknown parent when the anchor has none', () => {
    const draft = buildFamily({ persons: [{ id: 'p_a' }] })
    const id = addRelative(draft, 'p_a', 'sibling', newPerson('Brat'))
    expect(draft.persons).toHaveLength(3)
    const parent = draft.persons.find((p) => p.id !== 'p_a' && p.id !== id)!
    expect(parent).toMatchObject({ givenNames: '', surname: '', sex: 'unknown' })
    expect(draft.parentChild).toEqual([
      { parentId: parent.id, childId: 'p_a', type: 'biological' },
      { parentId: parent.id, childId: id, type: 'biological' },
    ])
    expect(checkRelationRules(draft)).toEqual([])
  })
})

describe('invalid targets', () => {
  it('rejects the anchor as its own relative', () => {
    const data = buildFamily({ persons: [{ id: 'p_a' }] })
    const self = { kind: 'existing', personId: 'p_a' } as const
    for (const kind of ['parent', 'child', 'sibling'] as const) {
      expect(canAddRelative(data, 'p_a', kind, self)).toEqual({ ok: false, reason: SELF_PARENT })
    }
    expect(canAddRelative(data, 'p_a', 'partner', self)).toEqual({
      ok: false,
      reason: 'Związek musi łączyć dwie różne osoby.',
    })
  })

  it('rejects a missing anchor and a missing target', () => {
    const data = buildFamily({ persons: [{ id: 'p_a' }] })
    const missing = 'Wskazana osoba nie istnieje.'
    expect(canAddRelative(data, 'p_x', 'child')).toEqual({ ok: false, reason: missing })
    expect(canAddRelative(data, 'p_a', 'partner', { kind: 'existing', personId: 'p_x' })).toEqual({
      ok: false,
      reason: missing,
    })
  })

  it('links an existing person as a child', () => {
    const draft = buildFamily({ persons: [{ id: 'p_a' }, { id: 'p_b' }] })
    expect(addRelative(draft, 'p_a', 'child', { kind: 'existing', personId: 'p_b' })).toBe('p_b')
    expect(draft.persons).toHaveLength(2)
    expect(draft.parentChild).toEqual([{ parentId: 'p_a', childId: 'p_b', type: 'biological' }])
  })
})
