import { signal } from '@preact/signals'
import type { components } from '../types/api'
import { ApiError, getMe } from '../services/api'

type User = components['schemas']['User']

export const currentUser = signal<User | null>(null)
export const sessionLoading = signal(true)

/**
 * Called once at app boot. Tries /me -- if the httpOnly cookie is valid,
 * this succeeds silently and the user is already signed in. A 401 here is
 * the normal "not signed in yet" case, not an error worth surfacing.
 */
export async function loadSession(): Promise<void> {
  sessionLoading.value = true
  try {
    currentUser.value = await getMe()
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      currentUser.value = null
    } else {
      // Network error, server down, etc. -- still treat as signed-out for
      // routing purposes, but this is a genuinely different case from a
      // clean 401 and worth knowing about if this ever needs richer
      // error-state UI later.
      currentUser.value = null
    }
  } finally {
    sessionLoading.value = false
  }
}

export function clearSession(): void {
  currentUser.value = null
}
