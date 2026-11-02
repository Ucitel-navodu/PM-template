/*
 * Colour palettes. The five dark palettes are the NEW-look palettes of the
 * author's JARVIS app (Ucitel-navodu/jarvis, ui2.css / uiTheme.js, ADR-120),
 * values taken 1:1: foundation colours (page, surface, accent). "Světlý" is
 * the app's light look. A palette only changes colours; semantic colours
 * (Health, RAG) keep their meaning.
 *
 * The static CSS for each palette lives in src/index.css (needed before the
 * first paint); this module lists them for the picker and derives the accent
 * scale for a custom accent colour.
 */

export type PaletteId = 'light' | 'nexus' | 'nebula' | 'emerald' | 'sapphire' | 'titanium'

export interface Palette {
  id: PaletteId
  name: string
  note?: string
  dark: boolean
  /** page, surface, accent */
  swatch: [string, string, string]
}

export const PALETTES: Palette[] = [
  { id: 'nexus', name: 'Nexus Cyan', note: 'výchozí', dark: true, swatch: ['#0a0f1c', '#0f172a', '#00d4ff'] },
  { id: 'nebula', name: 'Nebula Violet', dark: true, swatch: ['#100c1f', '#201932', '#c29aff'] },
  { id: 'emerald', name: 'Emerald Matrix', dark: true, swatch: ['#071612', '#10241d', '#58e6ae'] },
  { id: 'sapphire', name: 'Sapphire Command', dark: true, swatch: ['#091321', '#14263d', '#70adff'] },
  { id: 'titanium', name: 'Titanium Graphite', dark: true, swatch: ['#101318', '#202630', '#b4d2e4'] },
  { id: 'light', name: 'Světlý', dark: false, swatch: ['#f9fafb', '#ffffff', '#5b30f0'] },
]

export const DEFAULT_PALETTE: PaletteId = 'nexus'
const IDS = new Set<string>(PALETTES.map((p) => p.id))
export const validPalette = (id: unknown): PaletteId => (typeof id === 'string' && IDS.has(id) ? (id as PaletteId) : DEFAULT_PALETTE)
export const isDark = (id: PaletteId) => id !== 'light'

// --- colour maths (sRGB) -------------------------------------------------------------------

export type RGB = [number, number, number]
export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

export function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** `amount` of `to` mixed into `from` (0..1). */
export const mix = (from: RGB, to: RGB, amount: number): RGB => from.map((v, i) => v + (to[i] - v) * amount) as RGB

const BLACK: RGB = [0, 0, 0]
const WHITE: RGB = [255, 255, 255]

/**
 * Accent scale for Tailwind's `brand-*` utilities on a dark page.
 * 300-500 = the accent itself (text, rings, bars); 600/700 = a darkened accent
 * that keeps white button text readable (contrast >= 4.5:1); 50-200 = faint tints of the accent on the page.
 */
export function brandScale(accent: string, page: string): Record<number, RGB> {
  const a = hexToRgb(accent)
  const p = hexToRgb(page)
  let solid = a
  for (let k = 0; k <= 1 && contrast(solid, WHITE) < 4.6; k += 0.02) solid = mix(a, BLACK, k)
  return {
    50: mix(p, a, 0.1),
    100: mix(p, a, 0.16),
    200: mix(p, a, 0.28),
    300: a,
    400: a,
    500: a,
    600: solid,
    700: mix(solid, BLACK, 0.18),
    800: mix(solid, BLACK, 0.34),
    900: mix(solid, BLACK, 0.5),
  }
}

export const triplet = (c: RGB) => c.map((v) => Math.round(v)).join(' ')

/** Inline CSS variables for a custom accent (overrides the palette's own accent). */
export function accentVars(accent: string, page: string): Record<string, string> {
  const scale = brandScale(accent, page)
  const vars: Record<string, string> = { '--pm-primary': triplet(hexToRgb(accent)) }
  for (const [k, c] of Object.entries(scale)) vars[`--pm-brand-${k}`] = triplet(c)
  return vars
}

export { WHITE }
