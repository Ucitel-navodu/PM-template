import { create } from 'zustand'
import type { Lang, Theme } from '../types'
import { loadPref, savePref } from '../lib/storage'
import { DEFAULT_PALETTE, accentVars, isDark, isHex, validPalette, PALETTES, type PaletteId } from '../lib/palettes'

// Per-device preferences: not part of the workspace file (each colleague
// opening the same file keeps their own language, palette and name).
interface PrefsState {
  lang: Lang
  /** Derived from the palette: light or dark (used for chart colours). */
  theme: Theme
  palette: PaletteId
  /** Custom accent colour (#rrggbb) overriding the palette's accent, '' = palette's own. */
  accent: string
  /** Dark palette the sun/moon button returns to. */
  lastDark: PaletteId
  userName: string
  autosaveDelayMs: number
  maxBackups: number
  setLang: (l: Lang) => void
  setPalette: (p: PaletteId) => void
  setAccent: (hex: string) => void
  toggleTheme: () => void
  setUserName: (n: string) => void
  setAutosaveDelayMs: (ms: number) => void
  setMaxBackups: (n: number) => void
}

/** Saved palette; older versions stored only light / dark (dark -> the default palette). */
function initialPalette(): PaletteId {
  const saved = loadPref<string | null>('palette', null)
  if (saved) return validPalette(saved)
  return loadPref<string | null>('theme', null) === 'light' ? 'light' : DEFAULT_PALETTE
}

function savedDark(): PaletteId {
  const p = validPalette(loadPref<string>('lastDark', DEFAULT_PALETTE))
  return p === 'light' ? DEFAULT_PALETTE : p
}

const initial = initialPalette()
const savedAccent = loadPref<string>('accent', '')

export const usePrefsStore = create<PrefsState>((set, get) => ({
  lang: loadPref<Lang>('lang', 'CZ'),
  theme: isDark(initial) ? 'dark' : 'light',
  palette: initial,
  accent: isHex(savedAccent) ? savedAccent : '',
  lastDark: isDark(initial) ? initial : savedDark(),
  userName: loadPref<string>('userName', ''),
  autosaveDelayMs: loadPref<number>('autosaveDelayMs', 2000),
  maxBackups: loadPref<number>('maxBackups', 20),
  setLang: (lang) => set({ lang }),
  setPalette: (palette) => {
    const p = validPalette(palette)
    set({ palette: p, theme: isDark(p) ? 'dark' : 'light', ...(isDark(p) ? { lastDark: p } : {}) })
  },
  setAccent: (accent) => set({ accent: isHex(accent) ? accent : '' }),
  toggleTheme: () => get().setPalette(get().theme === 'dark' ? 'light' : get().lastDark),
  setUserName: (userName) => set({ userName }),
  setAutosaveDelayMs: (autosaveDelayMs) => set({ autosaveDelayMs }),
  setMaxBackups: (maxBackups) => set({ maxBackups }),
}))

const ACCENT_KEYS = ['--pm-primary', ...[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => `--pm-brand-${k}`)]

/** Paint the palette (CSS in index.css, keyed by data-theme) and the optional custom accent. */
export function applyAppearance(palette: PaletteId, accent: string): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = palette
  root.classList.toggle('dark', isDark(palette))
  ACCENT_KEYS.forEach((k) => root.style.removeProperty(k))
  const p = PALETTES.find((x) => x.id === palette)!
  // A custom accent only applies on dark palettes: the light look keeps its tuned violet.
  if (accent && isDark(palette)) Object.entries(accentVars(accent, p.swatch[0])).forEach(([k, v]) => root.style.setProperty(k, v))
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', p.swatch[0])
}

usePrefsStore.subscribe((s) => {
  savePref('lang', s.lang)
  savePref('palette', s.palette)
  savePref('theme', s.theme) // read by older builds and the first-paint script
  savePref('accent', s.accent)
  savePref('lastDark', s.lastDark)
  savePref('userName', s.userName)
  savePref('autosaveDelayMs', s.autosaveDelayMs)
  savePref('maxBackups', s.maxBackups)
  applyAppearance(s.palette, s.accent)
})
applyAppearance(initial, usePrefsStore.getState().accent)
