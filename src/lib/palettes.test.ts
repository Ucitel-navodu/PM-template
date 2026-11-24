import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PALETTES, WHITE, contrast, hexToRgb, isDark, validPalette, type RGB } from './palettes'
import { BRAND, CHART_COLORS, LOGO_GREY_PATHS, LOGO_RED_PATHS, logoSvg } from './brand'
// @ts-expect-error plain JS config
import tailwind from '../../tailwind.config.js'

const css = readFileSync('src/index.css', 'utf8')
const block = (sel: string) => new RegExp(`${sel.replace(/[[\]"]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
const token = (b: string, name: string): RGB => (new RegExp(`--${name}:\\s*([^;]+);`).exec(b)?.[1].trim() ?? '').split(' ').map(Number) as RGB
const LIGHT = block(':root')
const DARK = block('html[data-theme="orlen-dark"]')
const colors = (tailwind as { theme: { extend: { colors: Record<string, Record<string, string>> } } }).theme.extend.colors

describe('ORLEN Unipetrol palettes', () => {
  it('offers exactly the light (default) and dark brand looks', () => {
    expect(PALETTES.map((p) => p.id)).toEqual(['orlen-light', 'orlen-dark'])
    expect(PALETTES.map((p) => p.swatch[2])).toEqual([BRAND.red, BRAND.red])
  })

  it('maps palettes saved by older versions to the brand look of the same brightness', () => {
    for (const id of ['nexus', 'nebula', 'emerald', 'sapphire', 'titanium', 'corp-dark', 'dark', 'orlen-dark']) expect(validPalette(id), id).toBe('orlen-dark')
    for (const id of ['light', 'corp-light', 'orlen-light', 'nonsense', null, undefined]) expect(validPalette(id), String(id)).toBe('orlen-light')
    expect(isDark('orlen-dark')).toBe(true)
    expect(isDark('orlen-light')).toBe(false)
  })

  it('primary buttons are the brand red #d81e04 with readable white text on both looks', () => {
    for (const b of [LIGHT, DARK]) {
      expect(token(b, 'pm-brand-600')).toEqual(hexToRgb(BRAND.red))
      expect(contrast(token(b, 'pm-brand-600'), WHITE)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('body text, red text and secondary grey text keep >= 4.5 : 1 on page and cards', () => {
    const light = { page: token(LIGHT, 'pm-bg'), card: token(LIGHT, 'pm-card') }
    const dark = { page: token(DARK, 'pm-bg'), card: token(DARK, 'pm-card') }
    for (const bg of [light.page, light.card]) {
      expect(contrast(token(LIGHT, 'pm-text'), bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token(LIGHT, 'pm-brand-600'), bg)).toBeGreaterThanOrEqual(4.5) // red text
      expect(contrast(hexToRgb(colors.gray[500]), bg)).toBeGreaterThanOrEqual(4.5) // brand grey #676d6f
    }
    for (const bg of [dark.page, dark.card]) {
      expect(contrast(token(DARK, 'pm-text'), bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token(DARK, 'pm-brand-300'), bg)).toBeGreaterThanOrEqual(4.5) // red text on dark
      expect(contrast(hexToRgb(colors.gray[400]), bg)).toBeGreaterThanOrEqual(4.5) // secondary text on dark
    }
  })

  it('status text colours (600 steps) stay readable on white', () => {
    for (const scale of ['red', 'green', 'yellow', 'blue', 'slate', 'orange']) expect(contrast(hexToRgb(colors[scale][600]), WHITE), scale).toBeGreaterThanOrEqual(4.5)
  })

  it('uses the brand colours of the manual', () => {
    expect(colors.gray[500]).toBe('#676d6f') // Pantone 431 C
    expect(colors.gray[400]).toBe('#aeafab') // Pantone 429 C
    expect(colors.red[500]).toBe('#d81e04') // Pantone 485 C
    for (const c of CHART_COLORS) expect(BRAND.supplementary as readonly string[]).toContain(c)
  })
})

describe('ORLEN Unipetrol trade mark', () => {
  it('is the vector mark from the manual in the brand colours only', () => {
    expect(LOGO_RED_PATHS).toHaveLength(6) // ORLEN box with knocked-out letters (3 paths) + bird (3 paths)
    expect(LOGO_GREY_PATHS).toHaveLength(1) // Unipetrol
    expect([...new Set(logoSvg('color').match(/fill="[^"]+"/g))].sort()).toEqual(['fill="#676d6f"', 'fill="#d81e04"'])
    expect([...new Set(logoSvg('negative').match(/fill="[^"]+"/g))]).toEqual(['fill="#ffffff"'])
  })
})
