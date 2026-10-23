// On file:// (the portable single-HTML build), browsers share ONE storage
// origin across every local file regardless of path or filename - verified
// empirically: two different .html copies opened in the same browser read
// and write the exact same localStorage bucket. Without this, two different
// project files (different colleagues, or two of your own projects) would
// silently overwrite each other's data.
//
// Fix: key storage by this file's own location, so each saved/renamed copy
// gets its own isolated slot. On http(s) (normal hosted/dev use) this is
// unnecessary - there's only one meaningful path - so we keep a stable key.
export function computeOriginPrefix(): string {
  if (typeof window === 'undefined' || window.location.protocol !== 'file:') {
    return 'pm-web:'
  }
  const path = window.location.pathname
  let hash = 0
  for (let i = 0; i < path.length; i++) {
    hash = (hash * 31 + path.charCodeAt(i)) | 0
  }
  return `pm-web:${(hash >>> 0).toString(36)}:`
}

export const PREFIX = computeOriginPrefix()

export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage unavailable (private mode, quota) - silently skip persistence
  }
}

export function resetState(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

// Per-user preferences (language, theme, user name) are deliberately NOT
// isolated per file: they describe the person, not the project data.
// index.html reads 'pm-web:theme' before paint, so keep this prefix stable.
const PREF_PREFIX = 'pm-web:'

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREF_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREF_PREFIX + key, JSON.stringify(value))
  } catch {
    // ignore
  }
}
