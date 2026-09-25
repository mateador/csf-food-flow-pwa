import { signal } from '@preact/signals'
import { isUnauthorized, isUnreachable } from '../services/api'
import { pendingFor, syncOfflineQueue } from './offlineQueue'
import { route } from 'preact-router'
import {
  SESSION_ENDED_MESSAGE,
  currentUser,
  loadSession,
  sessionEnded,
  sessionOffline,
  signOut
} from './session'

const RETRY_INTERVAL_MS = 60_000

/** Why the last automatic attempt didn't upload, for the Sync page. null
 * after a successful upload, or when nothing was waiting. */
export const lastSyncProblem = signal<string | null>(null)

/**
 * Uploads the signed-in user's queued entries if there are any. Safe to
 * call at any time and as often as you like: it does nothing when there's
 * nothing to send, and overlapping calls share one upload.
 *
 * If the session was only assumed (started offline), it's confirmed with
 * the server first -- the person may have been signed out in the meantime.
 */
export async function requestSync(): Promise<void> {
  if (sessionOffline.value) {
    const assumed = currentUser.value
    await loadSession()
    if (sessionOffline.value) return // still no connection
    if (assumed && !currentUser.value) {
      // The server says the session this device assumed has ended.
      sessionEnded(SESSION_ENDED_MESSAGE)
      return
    }
  }

  const user = currentUser.value
  if (!user || pendingFor(user.id).length === 0) return

  try {
    await syncOfflineQueue(user.id)
    lastSyncProblem.value = null
  } catch (err) {
    if (isUnauthorized(err)) {
      lastSyncProblem.value = null
      sessionEnded(SESSION_ENDED_MESSAGE)
    } else if (isUnreachable(err)) {
      lastSyncProblem.value = 'No connection to the server. Will try again automatically.'
    } else {
      lastSyncProblem.value =
        err instanceof Error ? err.message : 'Upload failed. Will try again automatically.'
    }
  }
}

let started = false

/**
 * Starts automatic uploading. Called once at app start. Uploads happen:
 * - when the device comes back online,
 * - every minute while this user has something waiting,
 * - and whenever something else calls requestSync() (app start, sign-in,
 *   after a successful save).
 */
export function startAutoSync(): () => void {
  if (started) return () => {}
  started = true

  const onOnline = () => void requestSync()
  window.addEventListener('online', onOnline)
  const timer = window.setInterval(() => void requestSync(), RETRY_INTERVAL_MS)

  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(timer)
    started = false
  }
}

/**
 * The "Sign out" button. On a shared tablet the next person picks it up
 * straight after, so anything this person has waiting is uploaded first
 * while they're still signed in. If that can't happen (no connection), the
 * entries stay on the device and upload the next time they sign in here.
 */
export async function syncThenSignOut(): Promise<void> {
  await requestSync()
  await signOut()
  route('/login', true)
}