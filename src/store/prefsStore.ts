import { create } from 'zustand'
import type { Lang, Theme } from '../types'
import { loadPref, savePref } from '../lib/storage'
import { isDark, validPalette, PALETTES, type PaletteId } from '../lib/palettes'

// Per-device preferences: not part of the workspace file (each colleague
// opening the same file keeps their own language, palette and name).
interface PrefsState {
  lang: Lang
  /** Derived from the palette: light or dark (used for chart colours). */
  theme: Theme
  palette: PaletteId
  userName: string
  autosaveDelayMs: number
  /** Format of a newly created working file (pmw | xlsx | txt | json). */
  saveFormat: 'pmw' | 'xlsx' | 'txt' | 'json'
  setSaveFormat: (f: 'pmw' | 'xlsx' | 'txt' | 'json') => void
  maxBackups: number
  setLang: (l: Lang) => void
  setPalette: (p: PaletteId) => void
  toggleTheme: () => void
  setUserName: (n: string) => void
  setAutosaveDelayMs: (ms: number) => void
  setMaxBackups: (n: number) => void
}

/** Saved palette; older versions stored other palettes or only light / dark - mapped to the brand look. */
function initialPalette(): PaletteId {
  const saved = loadPref<string | null>('palette', null)
  if (saved) return validPalette(saved)
  return validPalette(loadPref<string | null>('theme', null))
}

const initial = initialPalette()

export const usePrefsStore = create<PrefsState>((set, get) => ({
  lang: loadPref<Lang>('lang', 'CZ'),
  theme: isDark(initial) ? 'dark' : 'light',
  palette: initial,
  userName: loadPref<string>('userName', ''),
  autosaveDelayMs: loadPref<number>('autosaveDelayMs', 2000),
  saveFormat: loadPref<'pmw' | 'xlsx' | 'txt' | 'json'>('saveFormat', 'pmw'),
  setSaveFormat: (saveFormat) => set({ saveFormat }),
  maxBackups: loadPref<number>('maxBackups', 20),
  setLang: (lang) => set({ lang }),
  setPalette: (palette) => {
    const p = validPalette(palette)
    set({ palette: p, theme: isDark(p) ? 'dark' : 'light' })
  },
  toggleTheme: () => get().setPalette(get().theme === 'dark' ? 'orlen-light' : 'orlen-dark'),
  setUserName: (userName) => set({ userName }),
  setAutosaveDelayMs: (autosaveDelayMs) => set({ autosaveDelayMs }),
  setMaxBackups: (maxBackups) => set({ maxBackups }),
}))

/** Paint the palette (CSS in index.css, keyed by data-theme). */
export function applyAppearance(palette: PaletteId): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = palette
  root.classList.toggle('dark', isDark(palette))
  // Leftovers of the removed custom accent (v0.8 - v0.9) must not override the brand colours.
  for (const k of [...root.style]) if (k.startsWith('--pm-')) root.style.removeProperty(k)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETTES.find((x) => x.id === palette)!.swatch[0])
}

usePrefsStore.subscribe((s) => {
  savePref('lang', s.lang)
  savePref('palette', s.palette)
  savePref('theme', s.theme) // read by older builds and the first-paint script
  savePref('userName', s.userName)
  savePref('autosaveDelayMs', s.autosaveDelayMs)
  savePref('saveFormat', s.saveFormat)
  savePref('maxBackups', s.maxBackups)
  applyAppearance(s.palette)
})
applyAppearance(initial)
