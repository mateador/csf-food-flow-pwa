import { ApiError, createEntry, isUnauthorized, isUnreachable } from './api'
import { enqueueEntry, type EntryOwner, type QueuedEntry } from '../store/offlineQueue'
import { SESSION_ENDED_MESSAGE, requestSync } from '../store/autoSync'
import { sessionEnded } from '../store/session'

type NewEntry = Omit<QueuedEntry, 'queued_at' | 'queued_by' | 'queued_by_name' | 'sync_error'>

export type SubmitOutcome =
  /** The server has it. */
  | { kind: 'saved' }
  /** Couldn't reach the server; kept on the device and uploads automatically. */
  | { kind: 'queued' }
  /** The session had ended; kept on the device, uploads after this person signs in. */
  | { kind: 'signed_out' }
  /** The server refused it. NOT kept -- the form should stay filled in so it can be fixed. */
  | { kind: 'rejected'; message: string }

/**
 * Saves one weigh entry, deciding what happens when that fails. The rule:
 * keep the entry whenever the server never had a chance to judge it (no
 * connection, server error, session ended), and hand it back to the user
 * whenever the server looked at it and said no -- queueing a rejected entry
 * would only fail again on upload, out of the user's sight.
 */
export async function submitEntry(entry: NewEntry, owner: EntryOwner): Promise<SubmitOutcome> {
  try {
    await createEntry(entry)
    // We just proved there's a connection -- a good moment to upload
    // anything recorded earlier without one.
    void requestSync()
    return { kind: 'saved' }
  } catch (err) {
    if (isUnreachable(err)) {
      enqueueEntry(entry, owner)
      return { kind: 'queued' }
    }
    if (isUnauthorized(err)) {
      enqueueEntry(entry, owner)
      sessionEnded(SESSION_ENDED_MESSAGE)
      return { kind: 'signed_out' }
    }
    if (err instanceof ApiError) {
      return { kind: 'rejected', message: err.message }
    }
    // Not a network or HTTP failure -- an unexpected bug. Keeping the
    // entry is safer than losing someone's weigh-in to it.
    enqueueEntry(entry, owner)
    return { kind: 'queued' }
  }
}