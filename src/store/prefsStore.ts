import { create } from 'zustand'
import type { Lang, Theme } from '../types'
import { loadPref, savePref } from '../lib/storage'

// Per-device preferences: not part of the workspace file (each colleague
// opening the same file keeps their own language, theme and name).
interface PrefsState {
  lang: Lang
  theme: Theme
  userName: string
  autosaveDelayMs: number
  maxBackups: number
  setLang: (l: Lang) => void
  toggleTheme: () => void
  setUserName: (n: string) => void
  setAutosaveDelayMs: (ms: number) => void
  setMaxBackups: (n: number) => void
}

function prefersDarkSystem(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

export const usePrefsStore = create<PrefsState>((set) => ({
  lang: loadPref<Lang>('lang', 'CZ'),
  theme: loadPref<Theme>('theme', prefersDarkSystem() ? 'dark' : 'light'),
  userName: loadPref<string>('userName', ''),
  autosaveDelayMs: loadPref<number>('autosaveDelayMs', 2000),
  maxBackups: loadPref<number>('maxBackups', 20),
  setLang: (lang) => set({ lang }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setUserName: (userName) => set({ userName }),
  setAutosaveDelayMs: (autosaveDelayMs) => set({ autosaveDelayMs }),
  setMaxBackups: (maxBackups) => set({ maxBackups }),
}))

usePrefsStore.subscribe((s) => {
  savePref('lang', s.lang)
  savePref('theme', s.theme)
  savePref('userName', s.userName)
  savePref('autosaveDelayMs', s.autosaveDelayMs)
  savePref('maxBackups', s.maxBackups)
  document.documentElement.classList.toggle('dark', s.theme === 'dark')
})
