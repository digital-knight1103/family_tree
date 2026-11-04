import { describe, expect, it } from 'vitest'
import { cn } from '@/shared/utils/cn'

describe('cn', () => {
  it('scala konfliktujące klasy Tailwind', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('pomija wartości fałszywe', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })
})
