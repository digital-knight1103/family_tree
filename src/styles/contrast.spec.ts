import { describe, expect, it } from 'vitest'
import css from '@/styles/globals.css?raw'
import { contrastRatio, readThemeTokens } from '@tests/fixtures/contrast'

const AA = 4.5
const themes = readThemeTokens(css)

describe('contrastRatio', () => {
  it('czerń na bieli to 21:1, kolor na sobie 1:1', () => {
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(21, 1)
    expect(contrastRatio('oklch(0.5 0.1 150)', 'oklch(0.5 0.1 150)')).toBeCloseTo(1, 5)
  })

  it('kolor z alfą najpierw nakłada się na tło pod spodem', () => {
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0 / 0%)', 'oklch(0 0 0)')).toBeCloseTo(1, 5)
  })
})

describe.each(['light', 'dark'] as const)('kontrast tekstu w motywie %s (WCAG AA)', (name) => {
  const t = themes[name]
  const tints = ['tint-parent', 'tint-sibling', 'tint-partner', 'tint-child']
  const pairs: [label: string, text: string, ...layers: string[]][] = [
    ['foreground na background', t.foreground!, t.background!],
    ['foreground na glass', t.foreground!, t.glass!, t.background!],
    ['muted-foreground na glass', t['muted-foreground']!, t.glass!, t.background!],
    ...tints.flatMap((tint): [string, string, ...string[]][] => [
      [`card-foreground na ${tint}`, t['card-foreground']!, t[tint]!, t.glass!, t.background!],
      [`muted-foreground na ${tint}`, t['muted-foreground']!, t[tint]!, t.glass!, t.background!],
    ]),
    ['badge-foreground na badge', t['badge-foreground']!, t.badge!],
    ['note-foreground na note', t['note-foreground']!, t.note!],
    ['primary-foreground na primary', t['primary-foreground']!, t.primary!],
    ['muted-foreground na muted', t['muted-foreground']!, t.muted!],
    [
      'muted-foreground na nieznanej osobie (muted/60)',
      t['muted-foreground']!,
      t.muted!.replace(')', ' / 60%)'),
      t.background!,
    ],
  ]

  it.each(pairs)('%s', (_label, text, ...layers) => {
    const [bg, ...under] = layers as [string, ...string[]]
    expect(contrastRatio(text, bg, ...under)).toBeGreaterThanOrEqual(AA)
  })
})
