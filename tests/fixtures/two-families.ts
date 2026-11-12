import type { FamilyData, Sex } from '@/domain/schema'
import { buildFamily, type FamilySpec } from './build-family'

export interface TwoFamiliesOptions {
  /** Children of couple A (default 4). */
  leftChildren?: number
  /** Children of couple B (default 3). */
  rightChildren?: number
  /**
   * The child of A and the child of B who are a couple, as 0-based indices in birth order
   * (default the second child of A and the first child of B).
   */
  bridge?: { left: number; right: number }
  /** A second couple between a child of A and a child of B (default none). */
  secondBridge?: { left: number; right: number }
  /** Family B has one parent in the tree instead of a couple. */
  singleRightParent?: boolean
  /** Children of the bridging couple (default none). */
  bridgeChildren?: number
}

/** Id of the A child with the given 0-based index in birth order. */
export const leftChild = (index: number) => `p_a${index + 1}`
/** Id of the B child with the given 0-based index in birth order. */
export const rightChild = (index: number) => `p_b${index + 1}`
/** Id of the bridging couple's child with the given 0-based index in birth order. */
export const bridgeChild = (index: number) => `p_c${index + 1}`

/**
 * Two invented families: couple A (parents born first) and couple B (or a single
 * parent), each with children born alternately (A 1950, B 1951, A 1952, ...), and one child of A
 * in a union with one child of B. Without the sibling-block rules the siblings interleave.
 */
export function twoFamilies(options: TwoFamiliesOptions = {}): FamilyData {
  const {
    leftChildren = 4,
    rightChildren = 3,
    bridge = { left: 1, right: 0 },
    singleRightParent = false,
    bridgeChildren = 0,
    secondBridge,
  } = options
  const born = (year: number) => ({ birth: { date: { year } } })
  const persons: FamilySpec['persons'] = [
    { id: 'p_a_ojciec', ...born(1920) },
    { id: 'p_a_matka', ...born(1922) },
    { id: 'p_b_ojciec', ...born(1921) },
  ]
  if (!singleRightParent) persons.push({ id: 'p_b_matka', ...born(1923) })
  const leftParents = ['p_a_ojciec', 'p_a_matka']
  const rightParents = singleRightParent ? ['p_b_ojciec'] : ['p_b_ojciec', 'p_b_matka']
  const parentChild: NonNullable<FamilySpec['parentChild']> = []
  const addChildren = (
    count: number,
    idOf: (i: number) => string,
    first: number,
    parents: string[],
  ) => {
    for (let i = 0; i < count; i++) {
      persons.push({ id: idOf(i), ...born(first + 2 * i) })
      for (const parent of parents) parentChild.push([parent, idOf(i)])
    }
  }
  addChildren(leftChildren, leftChild, 1950, leftParents)
  addChildren(rightChildren, rightChild, 1951, rightParents)
  const couple: [string, string] = [leftChild(bridge.left), rightChild(bridge.right)]
  addChildren(bridgeChildren, bridgeChild, 1980, couple)
  const unions: NonNullable<FamilySpec['unions']> = [['p_a_ojciec', 'p_a_matka']]
  if (!singleRightParent) unions.push(['p_b_ojciec', 'p_b_matka'])
  unions.push(couple)
  if (secondBridge) unions.push([leftChild(secondBridge.left), rightChild(secondBridge.right)])
  return buildFamily({ persons, parentChild, unions })
}

/** The same data with the given persons' sex changed (every person is 'unknown' by default). */
export function withSexes(data: FamilyData, sexes: Record<string, Sex>): FamilyData {
  return {
    ...data,
    persons: data.persons.map((p) => (sexes[p.id] ? { ...p, sex: sexes[p.id]! } : p)),
  }
}
