import type { FamilyData } from '@/domain/schema'
import { buildFamily, type FamilySpec } from './build-family'

/**
 * Deterministic family of 6 generations: one founding couple, every couple has 2 or 3 children
 * (3, 3, 2, ...), and every child except the youngest generation marries someone from outside.
 * Gives 328 persons.
 */
export function buildLargeFamily(): FamilyData {
  const persons: FamilySpec['persons'] = []
  const parentChild: NonNullable<FamilySpec['parentChild']> = []
  const unions: NonNullable<FamilySpec['unions']> = []
  let next = 0
  let coupleIndex = 0
  const person = (generation: number, sex: 'male' | 'female') => {
    const id = `p_${String(++next).padStart(3, '0')}`
    persons.push({ id, sex, birth: { date: { year: 1850 + 30 * generation + (next % 10) } } })
    return id
  }

  let couples: Array<[string, string]> = [[person(0, 'male'), person(0, 'female')]]
  unions.push(couples[0]!)
  for (let generation = 1; generation < 6; generation++) {
    const nextCouples: Array<[string, string]> = []
    for (const [a, b] of couples) {
      const count = coupleIndex++ % 3 === 2 ? 2 : 3
      for (let i = 0; i < count; i++) {
        const sex = (next + i) % 2 === 0 ? 'male' : 'female'
        const child = person(generation, sex)
        parentChild.push([a, child], [b, child])
        if (generation === 5) continue
        const spouse = person(generation, sex === 'male' ? 'female' : 'male')
        unions.push([child, spouse])
        nextCouples.push([child, spouse])
      }
    }
    couples = nextCouples
  }
  return buildFamily({ persons, parentChild, unions })
}
