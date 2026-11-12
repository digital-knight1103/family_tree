/** WCAG contrast helpers for the theme tokens in `src/styles/globals.css` (test-only). */

type Rgba = { r: number; g: number; b: number; a: number }

function blockBodies(css: string, selector: string): string[] {
  const bodies: string[] = []
  const pattern = new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g')
  for (const match of css.matchAll(pattern)) bodies.push(match[2]!)
  return bodies
}

function declarations(body: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]!] = match[2]!.trim()
  }
  return tokens
}

/** Custom properties of every top-level `:root` block (light) and those overlaid by `.dark`. */
export function readThemeTokens(css: string): {
  light: Record<string, string>
  dark: Record<string, string>
} {
  const light = Object.assign({}, ...blockBodies(css, ':root').map(declarations))
  const dark = Object.assign({}, light, ...blockBodies(css, '.dark').map(declarations))
  return { light, dark }
}

function parsePart(part: string): number {
  return part.endsWith('%') ? Number.parseFloat(part) / 100 : Number.parseFloat(part)
}

function srgbEncode(linear: number): number {
  const c = Math.min(1, Math.max(0, linear))
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}

function srgbDecode(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function parseOklch(color: string): Rgba {
  const match = /^oklch\(\s*([^)]+)\)$/.exec(color.trim())
  if (!match) throw new Error(`Unsupported color: ${color}`)
  const [channels, alpha] = match[1]!.split('/').map((s) => s.trim())
  const [l, c, h] = channels!.split(/\s+/).map(parsePart) as [number, number, number]
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: srgbEncode(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: srgbEncode(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: srgbEncode(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    a: alpha === undefined ? 1 : parsePart(alpha),
  }
}

/** Composite the layers top-first in gamma-encoded sRGB, as browsers do; the last must be opaque. */
function flatten(layers: string[]): Rgba {
  const colors = layers.map(parseOklch)
  let result = colors.at(-1)!
  if (result.a < 1) throw new Error(`Bottom layer must be opaque: ${layers.at(-1)}`)
  for (const top of colors.slice(0, -1).reverse()) {
    result = {
      r: top.r * top.a + result.r * (1 - top.a),
      g: top.g * top.a + result.g * (1 - top.a),
      b: top.b * top.a + result.b * (1 - top.a),
      a: 1,
    }
  }
  return result
}

function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * srgbDecode(r) + 0.7152 * srgbDecode(g) + 0.0722 * srgbDecode(b)
}

/**
 * Contrast ratio of `a` (text) on `b` (background). A color with alpha is first laid over the
 * colors that follow it: `contrastRatio(text, glass, background)`.
 */
export function contrastRatio(a: string, b: string, ...under: string[]): number {
  const background = flatten([b, ...under])
  const text = flatten([a, b, ...under])
  const [hi, lo] = [luminance(text), luminance(background)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (hi + 0.05) / (lo + 0.05)
}
