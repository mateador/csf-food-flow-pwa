import { signal } from '@preact/signals'

const CONTRAST_KEY = 'csf:contrast'
const TEXT_SIZE_KEY = 'csf:text-size'

function readInitialContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST_KEY) === 'high'
  } catch {
    return false
  }
}

function readInitialTextSize(): boolean {
  try {
    return localStorage.getItem(TEXT_SIZE_KEY) === 'large'
  } catch {
    return false
  }
}

// Personal, per-device preference -- see index.html for the inline script
// that applies this same value before first paint, so switching pages
// (or reloading) never flashes the default theme first.
export const highContrast = signal(readInitialContrast())

export function setHighContrast(enabled: boolean): void {
  highContrast.value = enabled
  if (enabled) {
    document.documentElement.setAttribute('data-contrast', 'high')
  } else {
    document.documentElement.removeAttribute('data-contrast')
  }
  try {
    localStorage.setItem(CONTRAST_KEY, enabled ? 'high' : 'normal')
  } catch {
    // Storage disabled -- the preference just won't survive a reload,
    // not worth surfacing an error for.
  }
}

// Same per-device, pre-paint-applied pattern as highContrast above -- a
// tablet mounted at a hub counter can turn this on once and it sticks,
// without affecting anyone using the app on their own phone.
export const highTextSize = signal(readInitialTextSize())

export function setHighTextSize(enabled: boolean): void {
  highTextSize.value = enabled
  if (enabled) {
    document.documentElement.setAttribute('data-text-size', 'large')
  } else {
    document.documentElement.removeAttribute('data-text-size')
  }
  try {
    localStorage.setItem(TEXT_SIZE_KEY, enabled ? 'large' : 'normal')
  } catch {
    // Storage disabled -- the preference just won't survive a reload,
    // not worth surfacing an error for.
  }
}
