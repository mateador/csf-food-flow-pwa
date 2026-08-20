import { describe, it, expect, beforeEach, vi } from 'vitest'
import { offlineQueue, enqueueEntry, removeFromQueue, syncOfflineQueue } from './offlineQueue'

vi.mock('../services/api', () => ({
  bulkSyncEntries: vi.fn()
}))

import { bulkSyncEntries } from '../services/api'

function sampleEntry(client_uuid: string) {
  return {
    client_uuid,
    entry_type: 'IN' as const,
    location_id: 'loc-1',
    destination_location_id: null,
    food_category_code: 'FRESH',
    weight_kg: 5,
    collection_date: '2026-08-01',
    notes: null
  }
}

describe('offlineQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    offlineQueue.value = []
    vi.mocked(bulkSyncEntries).mockReset()
  })

  it('enqueues an entry and persists it to localStorage', () => {
    enqueueEntry(sampleEntry('a-1'))
    expect(offlineQueue.value).toHaveLength(1)
    expect(offlineQueue.value[0].client_uuid).toBe('a-1')

    const stored = JSON.parse(localStorage.getItem('csf:offline-queue')!)
    expect(stored).toHaveLength(1)
  })

  it('removes an entry by client_uuid', () => {
    enqueueEntry(sampleEntry('a-1'))
    enqueueEntry(sampleEntry('a-2'))
    removeFromQueue('a-1')
    expect(offlineQueue.value.map((e) => e.client_uuid)).toEqual(['a-2'])
  })

  it('sync removes successfully created entries from the queue', async () => {
    enqueueEntry(sampleEntry('a-1'))
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'a-1', status: 'created', id: 'server-id-1' }]
    })

    const summary = await syncOfflineQueue()

    expect(summary).toEqual({ synced: 1, failed: 0 })
    expect(offlineQueue.value).toHaveLength(0)
  })

  it('sync removes duplicate entries too -- this is what makes retry-after-partial-failure safe', async () => {
    enqueueEntry(sampleEntry('a-1'))
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'a-1', status: 'duplicate', id: 'server-id-1' }]
    })

    const summary = await syncOfflineQueue()

    expect(summary).toEqual({ synced: 1, failed: 0 })
    expect(offlineQueue.value).toHaveLength(0)
  })

  it('sync keeps failed entries in the queue with the error attached, not silently dropped', async () => {
    enqueueEntry(sampleEntry('a-1'))
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'a-1', status: 'error', message: 'Not permitted for this role/location' }]
    })

    const summary = await syncOfflineQueue()

    expect(summary).toEqual({ synced: 0, failed: 1 })
    expect(offlineQueue.value).toHaveLength(1)
    expect(offlineQueue.value[0].sync_error).toBe('Not permitted for this role/location')
  })

  it('mixed batch: some created, some failed -- only failures remain queued', async () => {
    enqueueEntry(sampleEntry('a-1'))
    enqueueEntry(sampleEntry('a-2'))
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [
        { client_uuid: 'a-1', status: 'created', id: 'server-id-1' },
        { client_uuid: 'a-2', status: 'error', message: 'Invalid location' }
      ]
    })

    const summary = await syncOfflineQueue()

    expect(summary).toEqual({ synced: 1, failed: 1 })
    expect(offlineQueue.value.map((e) => e.client_uuid)).toEqual(['a-2'])
  })

  it('does not call the API at all when the queue is empty', async () => {
    const summary = await syncOfflineQueue()
    expect(summary).toEqual({ synced: 0, failed: 0 })
    expect(bulkSyncEntries).not.toHaveBeenCalled()
  })

  it('does not re-sync entries that already have a sync_error until queue is cleared/retried', async () => {
    enqueueEntry(sampleEntry('a-1'))
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'a-1', status: 'error', message: 'boom' }]
    })
    await syncOfflineQueue()

    // Second sync call should not include a-1 (it has sync_error set) --
    // this reflects the real UX: don't infinite-retry a rejected entry on
    // every background sync tick without the user acknowledging it.
    await syncOfflineQueue()
    expect(bulkSyncEntries).toHaveBeenCalledTimes(1)
  })
})
