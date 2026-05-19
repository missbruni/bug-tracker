/**
 * WCAG-compliant contrast colour utility.
 *
 * Given any CSS hex colour, returns the text colour (black or white)
 * that satisfies the WCAG 2.1 AA contrast-ratio requirement (≥ 4.5 : 1).
 *
 * Usage:
 *   <button style={{ color: contrastText('#FFD600') }}>Label</button>
 *
 * For computed / CSS-variable colours, use `contrastTextFromElement(el)`.
 */

// ─── sRGB relative-luminance (WCAG 2.1) ────────────────────
function linearize(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

// ─── Contrast ratio between two luminances (WCAG 2.1) ──────
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ─── Parse helpers ──────────────────────────────────────────
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h
  return [
    parseInt(full.substring(0, 2), 16),
    parseInt(full.substring(2, 4), 16),
    parseInt(full.substring(4, 6), 16),
  ]
}

function parseRgb(rgb: string): [number, number, number] {
  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!match) return [0, 0, 0]
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

// ─── Public API ─────────────────────────────────────────────

const BLACK = '#000000'
const WHITE = '#ffffff'
const L_BLACK = 0
const L_WHITE = 1

/**
 * Return `'#000000'` or `'#ffffff'` — whichever yields the higher
 * contrast ratio against the supplied hex background.
 */
export function contrastText(bgHex: string): string {
  const [r, g, b] = parseHex(bgHex)
  const lBg = relativeLuminance(r, g, b)
  return contrastRatio(lBg, L_WHITE) >= contrastRatio(lBg, L_BLACK)
    ? WHITE
    : BLACK
}

/**
 * Read the computed `backgroundColor` of a DOM element and return the
 * best text colour. Useful when the bg comes from CSS custom properties.
 */
export function contrastTextFromElement(el: HTMLElement): string {
  const bg = getComputedStyle(el).backgroundColor
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return WHITE
  const [r, g, b] = parseRgb(bg)
  const lBg = relativeLuminance(r, g, b)
  return contrastRatio(lBg, L_WHITE) >= contrastRatio(lBg, L_BLACK)
    ? WHITE
    : BLACK
}

/**
 * WCAG AA pass check (4.5 : 1 for normal text, 3 : 1 for large text).
 */
export function meetsAA(fgHex: string, bgHex: string, largeText = false): boolean {
  const lFg = relativeLuminance(...parseHex(fgHex))
  const lBg = relativeLuminance(...parseHex(bgHex))
  return contrastRatio(lFg, lBg) >= (largeText ? 3 : 4.5)
}
