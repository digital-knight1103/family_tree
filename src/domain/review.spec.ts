import { describe, expect, it } from 'vitest'
import { buildFamily } from '@tests/fixtures/build-family'
import { reviewEntries } from './review.ts'

describe('reviewEntries', () => {
  it('osoba bez imion i nazwiska ma powód unknown', () => {
    const data = buildFamily({
      persons: [{ id: 'p_a', givenNames: '', surname: ' ' }, { id: 'p_b' }],
    })
    expect(reviewEntries(data)).toEqual([{ personId: 'p_a', reasons: [{ kind: 'unknown' }] }])
  })

  it('niepotwierdzone urodzenie podaje, czy jest data i miejsce', () => {
    const data = buildFamily({
      persons: [
        { id: 'p_a', birth: { date: { year: 1890 }, place: '  ', unconfirmed: true } },
        { id: 'p_b', death: { place: 'Kraków', unconfirmed: true } },
      ],
    })
    expect(reviewEntries(data)).toEqual([
      {
        personId: 'p_a',
        reasons: [{ kind: 'fact', fact: 'birth', hasDate: true, hasPlace: false }],
      },
      {
        personId: 'p_b',
        reasons: [{ kind: 'fact', fact: 'death', hasDate: false, hasPlace: true }],
      },
    ])
  })

  it('niepotwierdzony początek związku trafia do obu partnerów', () => {
    const data = buildFamily({ persons: [{ id: 'p_a' }, { id: 'p_b' }], unions: [['p_a', 'p_b']] })
    data.unions[0]!.start = { unconfirmed: true }
    expect(reviewEntries(data)).toEqual([
      {
        personId: 'p_a',
        reasons: [{ kind: 'union', unionId: 'u_1', partnerId: 'p_b', unionType: 'marriage' }],
      },
      {
        personId: 'p_b',
        reasons: [{ kind: 'union', unionId: 'u_1', partnerId: 'p_a', unionType: 'marriage' }],
      },
    ])
  })

  it('unconfirmed false i brak flagi nie trafiają na listę', () => {
    const data = buildFamily({
      persons: [
        { id: 'p_a', birth: { place: 'X', unconfirmed: false }, death: { place: 'Y' } },
        { id: 'p_b' },
      ],
      unions: [['p_a', 'p_b']],
    })
    data.unions[0]!.start = { unconfirmed: false }
    expect(reviewEntries(data)).toEqual([])
  })

  it('kolejność osób jak w danych, powodów: unknown, birth, death, związki', () => {
    const data = buildFamily({
      persons: [
        { id: 'p_z', birth: { unconfirmed: true }, death: { unconfirmed: true } },
        { id: 'p_a', givenNames: '', surname: '', death: { unconfirmed: true } },
        { id: 'p_m' },
      ],
      unions: [
        ['p_m', 'p_z'],
        ['p_a', 'p_z'],
      ],
    })
    data.unions[0]!.start = { unconfirmed: true }
    data.unions[1]!.start = { unconfirmed: true }
    const entries = reviewEntries(data)
    expect(entries.map((e) => e.personId)).toEqual(['p_z', 'p_a', 'p_m'])
    expect(entries[0]!.reasons.map((r) => (r.kind === 'fact' ? r.fact : r.kind))).toEqual([
      'birth',
      'death',
      'union',
      'union',
    ])
    expect(entries[0]!.reasons.filter((r) => r.kind === 'union')).toEqual([
      { kind: 'union', unionId: 'u_1', partnerId: 'p_m', unionType: 'marriage' },
      { kind: 'union', unionId: 'u_2', partnerId: 'p_a', unionType: 'marriage' },
    ])
    expect(entries[1]!.reasons.map((r) => (r.kind === 'fact' ? r.fact : r.kind))).toEqual([
      'unknown',
      'death',
      'union',
    ])
  })

  it('pomija związek z nieistniejącym partnerem', () => {
    const data = buildFamily({ persons: [{ id: 'p_a' }], unions: [['p_a', 'p_ghost']] })
    data.unions[0]!.start = { unconfirmed: true }
    expect(reviewEntries(data)).toEqual([])
  })

  it('związek o powtórzonym id jest pomijany, a kolejność jest stała', () => {
    const data = buildFamily({
      persons: [{ id: 'p_a' }, { id: 'p_b' }, { id: 'p_c' }],
      unions: [
        ['p_a', 'p_b'],
        ['p_b', 'p_c'],
      ],
    })
    for (const union of data.unions) union.start = { unconfirmed: true }
    data.unions[1]!.id = data.unions[0]!.id
    const entries = reviewEntries(data)
    expect(entries).toEqual([
      {
        personId: 'p_a',
        reasons: [{ kind: 'union', unionId: 'u_1', partnerId: 'p_b', unionType: 'marriage' }],
      },
      {
        personId: 'p_b',
        reasons: [{ kind: 'union', unionId: 'u_1', partnerId: 'p_a', unionType: 'marriage' }],
      },
    ])
    expect(reviewEntries(data)).toEqual(entries)
  })
})
