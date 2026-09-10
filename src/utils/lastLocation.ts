/**
 * Remembers the last location picked in a given form, per device
 * (localStorage, not synced to the server -- this is a pure convenience,
 * not data that needs to persist across devices). Only relevant for
 * FOOD_CENTRE/ADMIN users who see a real dropdown; HUB users' location is
 * already locked to their own, so this never applies to them.
 */
const KEY_PREFIX = 'csf:last-location:'

export function getLastLocation(formKey: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + formKey)
  } catch {
    return null
  }
}

export function setLastLocation(formKey: string, locationId: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + formKey, locationId)
  } catch {
    // Storage disabled/full -- losing the convenience is fine, not worth
    // surfacing an error for.
  }
}