import { signal } from '@preact/signals'
import { bulkSyncEntries } from '../services/api'

const STORAGE_KEY = 'csf:offline-queue'

export type QueuedEntry = {
  client_uuid: string
  entry_type: 'IN' | 'OUT'
  location_id: string
  destination_location_id: string | null
  food_category_code: string
  weight_kg: number
  collection_date: string
  notes: string | null
  queued_at: string
  sync_error?: string
}

function loadFromStorage(): QueuedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(entries: QueuedEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const offlineQueue = signal<QueuedEntry[]>(loadFromStorage())

export function enqueueEntry(entry: Omit<QueuedEntry, 'queued_at' | 'sync_error'>): void {
  const queued: QueuedEntry = { ...entry, queued_at: new Date().toISOString() }
  offlineQueue.value = [...offlineQueue.value, queued]
  persist(offlineQueue.value)
}

export function removeFromQueue(clientUuid: string): void {
  offlineQueue.value = offlineQueue.value.filter((e) => e.client_uuid !== clientUuid)
  persist(offlineQueue.value)
}

/**
 * Syncs everything currently queued. Entries the server accepts (created OR
 * duplicate -- duplicate means it already made it through on a prior
 * partial sync) are removed from the queue. Entries the server rejects stay
 * queued with the error attached, so the user can see what needs fixing
 * rather than having it silently vanish.
 *
 * Returns a summary for the /sync page to display.
 */
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const pending = offlineQueue.value.filter((e) => !e.sync_error)
  if (pending.length === 0) return { synced: 0, failed: 0 }

  const { results } = await bulkSyncEntries(
    pending.map(({ sync_error: _sync_error, queued_at: _queued_at, ...rest }) => rest)
  )

  let synced = 0
  let failed = 0
  let next = offlineQueue.value

  for (const result of results) {
    if (result.status === 'created' || result.status === 'duplicate') {
      next = next.filter((e) => e.client_uuid !== result.client_uuid)
      synced += 1
    } else {
      next = next.map((e) =>
        e.client_uuid === result.client_uuid
          ? { ...e, sync_error: result.message ?? 'Sync failed' }
          : e
      )
      failed += 1
    }
  }

  offlineQueue.value = next
  persist(next)
  return { synced, failed }
}
