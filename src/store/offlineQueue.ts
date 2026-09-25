import { signal } from '@preact/signals'
import { bulkSyncEntries } from '../services/api'
import { readJson, writeJson } from '../utils/storage'

const STORAGE_KEY = 'csf:offline-queue'

export type QueuedEntry = {
  client_uuid: string
  entry_type: 'IN' | 'OUT'
  location_id: string
  destination_location_id: string | null
  name: string
  food_category_code: string
  gross_weight_kg: number
  trays: { tray_type_code: string; quantity: number }[]
  collection_date: string
  notes: string | null
  queued_at: string
  /**
   * Who recorded it. The server attributes an entry to whoever is signed in
   * when it uploads, and checks THEIR hub and role -- so on a shared tablet
   * an entry must only ever upload under the person who recorded it.
   * null only for entries queued before this field existed; those upload
   * under whoever syncs next, which is how they behaved before.
   */
  queued_by: string | null
  queued_by_name: string | null
  sync_error?: string
}

export type EntryOwner = { id: string; name: string }

type NewEntry = Omit<QueuedEntry, 'queued_at' | 'queued_by' | 'queued_by_name' | 'sync_error'>

function load(): QueuedEntry[] {
  const stored = readJson<QueuedEntry[]>(STORAGE_KEY, [])
  if (!Array.isArray(stored)) return []
  // Entries saved by an older version of the app have no owner fields.
  return stored.map((e) => ({
    ...e,
    queued_by: e.queued_by ?? null,
    queued_by_name: e.queued_by_name ?? null
  }))
}

function save(entries: QueuedEntry[]): void {
  offlineQueue.value = entries
  writeJson(STORAGE_KEY, entries)
}

export const offlineQueue = signal<QueuedEntry[]>(load())

export function enqueueEntry(entry: NewEntry, owner: EntryOwner): void {
  const queued: QueuedEntry = {
    ...entry,
    queued_at: new Date().toISOString(),
    queued_by: owner.id,
    queued_by_name: owner.name
  }
  save([...offlineQueue.value, queued])
}

export function removeFromQueue(clientUuid: string): void {
  save(offlineQueue.value.filter((e) => e.client_uuid !== clientUuid))
}

/** Entries this user may upload: their own, plus any legacy unowned ones. */
export function isOwnedBy(entry: QueuedEntry, userId: string): boolean {
  return entry.queued_by == null || entry.queued_by === userId
}

export function pendingFor(userId: string): QueuedEntry[] {
  return offlineQueue.value.filter((e) => !e.sync_error && isOwnedBy(e, userId))
}

export function failedFor(userId: string): QueuedEntry[] {
  return offlineQueue.value.filter((e) => e.sync_error && isOwnedBy(e, userId))
}

/** Entries recorded by other people on this device, waiting for them to sign in. */
export function waitingForOthers(userId: string): QueuedEntry[] {
  return offlineQueue.value.filter((e) => !isOwnedBy(e, userId))
}

let inFlight: Promise<{ synced: number; failed: number }> | null = null

/**
 * Uploads this user's pending entries. Entries the server accepts (created
 * OR duplicate -- duplicate means an earlier upload got through but its
 * reply was lost) leave the queue. Entries the server rejects stay, with
 * the reason attached, so nothing silently vanishes.
 *
 * Only one upload runs at a time: a call made while one is in progress
 * gets that same upload's result rather than sending the entries twice.
 *
 * Throws if the request itself fails (no connection, signed out) -- the
 * queue is left exactly as it was, and the caller decides what to do.
 */
export function syncOfflineQueue(userId: string): Promise<{ synced: number; failed: number }> {
  if (inFlight) return inFlight
  inFlight = runSync(userId).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runSync(userId: string): Promise<{ synced: number; failed: number }> {
  const pending = pendingFor(userId)
  if (pending.length === 0) return { synced: 0, failed: 0 }

  const { results } = await bulkSyncEntries(
    pending.map(
      ({ sync_error: _e, queued_at: _q, queued_by: _b, queued_by_name: _n, ...entry }) => entry
    )
  )

  const outcome = new Map(results.map((r) => [r.client_uuid, r]))
  let synced = 0
  let failed = 0

  // Re-read the queue: entries may have been added while the upload ran.
  const next = offlineQueue.value.flatMap((entry) => {
    const result = outcome.get(entry.client_uuid)
    if (!result) return [entry]
    if (result.status === 'created' || result.status === 'duplicate') {
      synced += 1
      return []
    }
    failed += 1
    return [{ ...entry, sync_error: result.message ?? 'Sync failed' }]
  })

  save(next)
  return { synced, failed }
}