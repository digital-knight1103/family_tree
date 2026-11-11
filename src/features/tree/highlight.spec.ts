import { describe, expect, it } from 'vitest'
import type { RoutedEdge } from '@/domain/tree-layout'
import { buildFamily } from '@tests/fixtures/build-family'
import { closestRelatives, focusNodeIds } from './highlight'

const data = buildFamily({
  persons: [
    { id: 'p_mama' },
    { id: 'p_tata' },
    { id: 'p_ja' },
    { id: 'p_brat' },
    { id: 'p_zona' },
    { id: 'p_syn' },
    { id: 'p_obcy' },
  ],
  parentChild: [
    ['p_mama', 'p_ja'],
    ['p_tata', 'p_ja'],
    ['p_mama', 'p_brat'],
    ['p_tata', 'p_brat'],
    ['p_ja', 'p_syn'],
    ['p_zona', 'p_syn'],
  ],
  unions: [
    ['p_mama', 'p_tata'],
    ['p_ja', 'p_zona'],
  ],
})

function edge(kind: RoutedEdge['kind'], source: string, target: string): RoutedEdge {
  return { id: `${source}->${target}`, kind, source, target, points: [] }
}

describe('closestRelatives', () => {
  it('dzieli najbliższych na rodziców, partnerów, dzieci i rodzeństwo', () => {
    expect(Object.fromEntries(closestRelatives(data, 'p_ja'))).toEqual({
      p_mama: 'parent',
      p_tata: 'parent',
      p_zona: 'partner',
      p_syn: 'child',
      p_brat: 'sibling',
    })
  })

  it('osoba bez krewnych nie ma nikogo', () => {
    expect(closestRelatives(data, 'p_obcy').size).toBe(0)
  })
})

describe('focusNodeIds', () => {
  it('obejmuje osobę, rodzinę, z której pochodzi, i jej własne związki', () => {
    const edges = [
      edge('partner', 'person:p_mama', 'union:u_0'),
      edge('partner', 'person:p_tata', 'union:u_0'),
      edge('child', 'union:u_0', 'person:p_ja'),
      edge('child', 'union:u_0', 'person:p_brat'),
      edge('partner', 'person:p_ja', 'union:u_1'),
      edge('partner', 'person:p_zona', 'union:u_1'),
      edge('child', 'union:u_1', 'person:p_syn'),
    ]
    expect([...focusNodeIds(edges, 'p_ja')].sort()).toEqual([
      'person:p_ja',
      'union:u_0',
      'union:u_1',
    ])
  })
})
