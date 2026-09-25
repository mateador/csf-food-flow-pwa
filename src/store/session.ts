import { signal } from '@preact/signals'
import { route } from 'preact-router'
import type { components } from '../types/api'
import { getMe, isUnreachable, logout } from '../services/api'
import { readJson, removeKey, writeJson } from '../utils/storage'
import { clearReferenceData, warmReferenceData } from './referenceData'

type User = components['schemas']['User']

const USER_KEY = 'csf:session-user'
const PENDING_LOGOUT_KEY = 'csf:pending-logout'

export const currentUser = signal<User | null>(null)
export const sessionLoading = signal(true)

/** True when the app is running on the last known user because the server
 * couldn't be reached to confirm the session. The server still checks
 * every request; this only decides what the device shows. */
export const sessionOffline = signal(false)

/** Shown once on the sign-in page after a session ended unexpectedly. */
export const signInNotice = signal<string | null>(null)

function remember(user: User): void {
  currentUser.value = user
  sessionOffline.value = false
  writeJson(USER_KEY, user)
}

function forget(): void {
  currentUser.value = null
  sessionOffline.value = false
  removeKey(USER_KEY)
  clearReferenceData()
}

/**
 * Runs at app start, and again whenever the connection comes back.
 *
 * - Server confirms the session: signed in, device copy refreshed.
 * - Server says 401: signed out.
 * - Server unreachable: carry on as the last signed-in user, so a
 *   volunteer can open the app in a hall with no signal and still record.
 *
 * If a sign-out didn't reach the server (no signal at the time), the old
 * cookie may still be valid. That sign-out is finished first, and until it
 * is, the device stays signed out -- never silently back in as the
 * previous person.
 */
export async function loadSession(): Promise<void> {
  try {
    if (readJson(PENDING_LOGOUT_KEY, false)) {
      const done = await tryLogout()
      if (!done) {
        forget()
        return
      }
    }

    try {
      remember(await getMe())
      void warmReferenceData()
    } catch (err) {
      const cached = readJson<User | null>(USER_KEY, null)
      if (isUnreachable(err) && cached) {
        currentUser.value = cached
        sessionOffline.value = true
      } else {
        // 401, or unreachable with nobody ever signed in on this device.
        forget()
      }
    }
  } finally {
    sessionLoading.value = false
  }
}

/** Called after a successful sign-in. */
export function signedIn(user: User): void {
  removeKey(PENDING_LOGOUT_KEY)
  signInNotice.value = null
  remember(user)
  void warmReferenceData()
}

/**
 * The server rejected the session mid-use: it expired, or the account was
 * deactivated. Anything the caller already queued stays on the device and
 * uploads when that person signs in again.
 */
export function sessionEnded(message: string): void {
  forget()
  signInNotice.value = message
  route('/login', true)
}

/**
 * Signs out on this device. The local state is cleared straight away so
 * the next volunteer never sees the previous one. If the server can't be
 * reached to expire the cookie, that's remembered and finished on the next
 * start (see loadSession).
 */
export async function signOut(): Promise<void> {
  writeJson(PENDING_LOGOUT_KEY, true)
  forget()
  await tryLogout() // if it can't reach the server, loadSession finishes it
}

/**
 * Asks the server to expire the cookie. Returns false only when the server
 * couldn't be reached -- the one case where trying again later can help.
 * Any answer from the server settles it, so a device can never get stuck
 * refusing to sign anyone in.
 */
async function tryLogout(): Promise<boolean> {
  try {
    await logout()
  } catch (err) {
    if (isUnreachable(err)) return false
  }
  removeKey(PENDING_LOGOUT_KEY)
  return true
}