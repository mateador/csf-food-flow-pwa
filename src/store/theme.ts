import { signal } from '@preact/signals'

const CONTRAST_KEY = 'csf:contrast'
const TEXT_SIZE_KEY = 'csf:text-size'
const DARK_MODE_KEY = 'csf:dark-mode'

function readInitialContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST_KEY) === 'high'
  } catch {
    return false
  }
}

export type TextSize = 'normal' | 'large' | 'xlarge'

function readInitialTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY)
    return stored === 'large' || stored === 'xlarge' ? stored : 'normal'
  } catch {
    return 'normal'
  }
}

function readInitialDarkMode(): boolean {
  try {
    return localStorage.getItem(DARK_MODE_KEY) === 'on'
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
// without affecting anyone using the app on their own phone. Three levels,
// not on/off -- different people on the same shared tablet want different
// amounts of this, not just "normal" or one fixed size.
export const textSize = signal<TextSize>(readInitialTextSize())

export function setTextSize(size: TextSize): void {
  textSize.value = size
  if (size === 'normal') {
    document.documentElement.removeAttribute('data-text-size')
  } else {
    document.documentElement.setAttribute('data-text-size', size)
  }
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size)
  } catch {
    // Storage disabled -- the preference just won't survive a reload,
    // not worth surfacing an error for.
  }
}

// Independent of highContrast -- that one keeps the bright background and
// darkens text/borders for sunlight/glare; this is a genuine dark theme,
// for low light instead. Same per-device, pre-paint-applied pattern.
export const darkMode = signal(readInitialDarkMode())

export function setDarkMode(enabled: boolean): void {
  darkMode.value = enabled
  if (enabled) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    localStorage.setItem(DARK_MODE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage disabled -- the preference just won't survive a reload,
    // not worth surfacing an error for.
  }
}
