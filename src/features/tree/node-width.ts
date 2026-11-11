import { PERSON_NODE } from '@/domain/tree-layout'
import type { PersonNodeView } from './person-node-view'

/** Measures a text line in CSS pixels for a CSS font shorthand. */
export type MeasureText = (text: string, font: string) => number

/** Everything in the node besides the text: left border, padding, avatar, gap, badge, slack. */
const CHROME = 4 + 1 + 8 + 40 + 8 + 8 + 16
const NAME_FONT = '500 14px'
const SURNAME_FONT = '400 14px'
const DATES_FONT = '400 12px'

function fontFamily(): string {
  if (typeof document === 'undefined') return 'sans-serif'
  return getComputedStyle(document.body).fontFamily || 'sans-serif'
}

/** Rough width when no canvas is available (tests): average glyph is about 0.6 em. */
const estimate: MeasureText = (text, font) => text.length * Number(/(\d+)px/.exec(font)![1]) * 0.6

let cached: MeasureText | undefined

function canvasMeasure(): MeasureText {
  if (cached) return cached
  if (typeof OffscreenCanvas === 'undefined') return (cached = estimate)
  const context = new OffscreenCanvas(1, 1).getContext('2d')
  if (!context) return (cached = estimate)
  return (cached = (text, font) => {
    context.font = font
    return context.measureText(text).width
  })
}

/** Width of a tree node that shows all three lines without cutting any text. */
export function personNodeWidth(view: PersonNodeView, measure: MeasureText = canvasMeasure()) {
  const family = fontFamily()
  const text = Math.max(
    measure(view.nameLine, `${NAME_FONT} ${family}`),
    measure(view.surnameLine, `${SURNAME_FONT} ${family}`),
    measure(view.dates, `${DATES_FONT} ${family}`),
  )
  return Math.max(PERSON_NODE.width, Math.ceil(text + CHROME))
}
