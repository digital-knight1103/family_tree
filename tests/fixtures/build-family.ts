import { emptyFamilyData, type FamilyData, type ParentChild, type Person } from '@/domain/schema'

export interface FamilySpec {
  persons: Array<Partial<Person> & { id: string }>
  parentChild?: Array<[parent: string, child: string, type?: ParentChild['type']]>
  unions?: Array<[a: string, b: string]>
}

export function buildFamily(spec: FamilySpec): FamilyData {
  return {
    ...emptyFamilyData(),
    persons: spec.persons.map((p) => ({
      givenNames: p.id,
      surname: 'Test',
      sex: 'unknown',
      living: false,
      ...p,
    })),
    parentChild: (spec.parentChild ?? []).map(([parentId, childId, type = 'biological']) => ({
      parentId,
      childId,
      type,
    })),
    unions: (spec.unions ?? []).map(([a, b], i) => ({
      id: `u_${i + 1}`,
      partnerIds: [a, b],
      type: 'marriage',
    })),
  }
}
