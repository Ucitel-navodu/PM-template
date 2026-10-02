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
function computeOriginPrefix(): string {
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

const PREFIX = computeOriginPrefix()

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
