import { signal } from '@preact/signals'

const STORAGE_KEY = 'csf:contrast'

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'high'
  } catch {
    return false
  }
}

// Personal, per-device preference -- see index.html for the inline script
// that applies this same value before first paint, so switching pages
// (or reloading) never flashes the default theme first.
export const highContrast = signal(readInitial())

export function setHighContrast(enabled: boolean): void {
  highContrast.value = enabled
  if (enabled) {
    document.documentElement.setAttribute('data-contrast', 'high')
  } else {
    document.documentElement.removeAttribute('data-contrast')
  }
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'high' : 'normal')
  } catch {
    // Storage disabled -- the preference just won't survive a reload,
    // not worth surfacing an error for.
  }
}