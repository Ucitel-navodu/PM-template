import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CORPORATE, isDark, PALETTES, WHITE, accentVars, brandScale, contrast, hexToRgb, isHex, triplet, validPalette } from './palettes'

const css = readFileSync('src/index.css', 'utf8')
const block = (id: string) => new RegExp(`html\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
const token = (b: string, name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(b)?.[1].trim()

describe('palettes', () => {
  it('has the five Jarvis palettes (values 1:1) plus the light look', () => {
    expect(PALETTES.map((p) => p.id)).toEqual(['nexus', 'nebula', 'emerald', 'sapphire', 'titanium', 'light', 'corp-light', 'corp-dark'])
    expect(PALETTES[0].swatch).toEqual(['#0a0f1c', '#0f172a', '#00d4ff']) // Nexus Cyan, the default
  })

  it('every dark palette has CSS tokens that match its swatch', () => {
    for (const p of PALETTES.filter((x) => x.dark)) {
      const b = block(p.id)
      expect(token(b, 'pm-bg'), p.id).toBe(triplet(hexToRgb(p.swatch[0])))
      expect(token(b, 'pm-card'), p.id).toBe(triplet(hexToRgb(p.swatch[1])))
      expect(token(b, 'pm-primary'), p.id).toBe(triplet(hexToRgb(p.swatch[2])))
    }
  })

  it('white button text stays readable (>= 4.5:1) on every palette and on arbitrary accents', () => {
    for (const p of PALETTES.filter((x) => x.dark)) {
      expect(contrast(brandScale(p.swatch[2], p.swatch[0])[600], WHITE), p.id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(hexToRgb(token(block(p.id), 'pm-brand-600')!.split(' ').map(Number).reduce((a, v) => a + v.toString(16).padStart(2, '0'), '#')), WHITE), `${p.id} css`).toBeGreaterThanOrEqual(4.5)
    }
    for (const accent of ['#ffffff', '#ffff00', '#00ff00', '#ff0000', '#000000', '#7f7f7f']) {
      expect(contrast(brandScale(accent, '#0a0f1c')[600], WHITE), accent).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('corporate palettes use the brand red and keep white button text readable', () => {
    for (const id of ['corp-light', 'corp-dark']) {
      const b = block(id)
      expect(token(b, 'pm-primary'), id).toBe('216 30 4')
      expect(token(b, 'pm-brand-600'), id).toBe('216 30 4')
      expect(isDark(id as never)).toBe(id === 'corp-dark')
    }
    expect(contrast(hexToRgb(CORPORATE.red), WHITE)).toBeGreaterThanOrEqual(4.5)
    // links / active text on the dark corporate page stay readable
    const soft = token(block('corp-dark'), 'pm-brand-300')!.split(' ').map(Number) as [number, number, number]
    expect(contrast(soft, hexToRgb('#1c1e1f'))).toBeGreaterThanOrEqual(4.5)
  })

  it('a custom accent sets the primary and the whole brand scale', () => {
    const v = accentVars('#ff8800', '#0a0f1c')
    expect(v['--pm-primary']).toBe('255 136 0')
    expect(Object.keys(v)).toHaveLength(11)
  })

  it('falls back to the default for unknown values; validates hex', () => {
    expect(validPalette('nonsense')).toBe('nexus')
    expect(validPalette(null)).toBe('nexus')
    expect(validPalette('light')).toBe('light')
    expect(isHex('#00d4ff')).toBe(true)
    expect(isHex('red')).toBe(false)
  })
})
