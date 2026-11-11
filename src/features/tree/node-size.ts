import { PERSON_NODE } from '@/domain/tree-layout'
import type { PersonNodeView } from './person-node-view'

/** Measures a text line in CSS pixels for a CSS font shorthand. */
export type MeasureText = (text: string, font: string) => number

/** Everything in the node besides the text: left border, padding, avatar, gap, badge, slack. */
const CHROME = 4 + 1 + 8 + 40 + 8 + 8 + 16
const NAME_FONT = '500 14px'
const SURNAME_FONT = '400 14px'
const DATES_FONT = '400 12px'
const PLACE_FONT = '400 11px'
/** Pin icon and its gap: the place text wraps in the space next to it. */
const PLACE_INDENT = 12 + 4
const PLACE_LINE_HEIGHT = 14
/** Name, surname and dates lines plus vertical padding: the height without a birth place. */
const BASE_HEIGHT = PERSON_NODE.height

/** Width of the text column in a node of `width`; the node renders its text in exactly this. */
export function nodeTextWidth(width: number): number {
  return width - CHROME
}

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

/** Number of lines `text` takes when wrapped at spaces (long words break) within `width`. */
function wrappedLines(text: string, width: number, measure: (text: string) => number): number {
  let lines = 1
  let line = ''
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    const candidate = line === '' ? word : `${line} ${word}`
    if (measure(candidate) <= width) {
      line = candidate
      continue
    }
    if (line !== '') lines++
    const wordLines = Math.max(1, Math.ceil(measure(word) / width))
    lines += wordLines - 1
    line = word
  }
  return lines
}

/**
 * Size of a tree node that shows every line without cutting text. Name, surname and dates set the
 * width; the birth place wraps inside it and makes the node taller.
 */
export function personNodeSize(
  view: PersonNodeView,
  measure: MeasureText = canvasMeasure(),
): { width: number; height: number } {
  const family = fontFamily()
  const text = Math.max(
    measure(view.nameLine, `${NAME_FONT} ${family}`),
    measure(view.surnameLine, `${SURNAME_FONT} ${family}`),
    measure(view.dates, `${DATES_FONT} ${family}`),
  )
  const width = Math.max(PERSON_NODE.width, Math.ceil(text + CHROME))
  if (view.birthPlace === '') return { width, height: BASE_HEIGHT }
  const placeWidth = nodeTextWidth(width) - PLACE_INDENT
  const lines = wrappedLines(view.birthPlace, placeWidth, (t) =>
    measure(t, `${PLACE_FONT} ${family}`),
  )
  return { width, height: BASE_HEIGHT + lines * PLACE_LINE_HEIGHT }
}
