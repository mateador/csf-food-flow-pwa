import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  offlineQueue,
  enqueueEntry,
  removeFromQueue,
  syncOfflineQueue,
  pendingFor,
  failedFor,
  waitingForOthers
} from './offlineQueue'

vi.mock('../services/api', () => ({
  bulkSyncEntries: vi.fn()
}))

import { bulkSyncEntries } from '../services/api'

const MARIA = { id: 'user-maria', name: 'Maria' }
const TOM = { id: 'user-tom', name: 'Tom' }

function sampleEntry(client_uuid: string) {
  return {
    client_uuid,
    entry_type: 'IN' as const,
    location_id: 'loc-1',
    destination_location_id: null,
    name: 'Tinned tomatoes',
    food_category_code: 'FRESH',
    gross_weight_kg: 5,
    trays: [],
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

  it('enqueues an entry with its owner and persists it to localStorage', () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    expect(offlineQueue.value).toHaveLength(1)
    expect(offlineQueue.value[0].queued_by).toBe('user-maria')
    expect(offlineQueue.value[0].queued_by_name).toBe('Maria')

    const stored = JSON.parse(localStorage.getItem('csf:offline-queue')!)
    expect(stored).toHaveLength(1)
    expect(stored[0].queued_by).toBe('user-maria')
  })

  it('removes an entry by client_uuid', () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    enqueueEntry(sampleEntry('a-2'), MARIA)
    removeFromQueue('a-1')
    expect(offlineQueue.value.map((e) => e.client_uuid)).toEqual(['a-2'])
  })

  it('sync removes successfully created entries from the queue', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'a-1', status: 'created', id: 'server-id-1' }]
    })

    const summary = await syncOfflineQueue(MARIA.id)

    expect(summary).toEqual({ synced: 1, failed: 0 })
    expect(offlineQueue.value).toHaveLength(0)
  })

  it('sync removes duplicate entries too -- this is what makes retry-after-partial-failure safe', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'a-1', status: 'duplicate', id: 'server-id-1' }]
    })

    const summary = await syncOfflineQueue(MARIA.id)

    expect(summary).toEqual({ synced: 1, failed: 0 })
    expect(offlineQueue.value).toHaveLength(0)
  })

  it('sync keeps failed entries in the queue with the error attached, not silently dropped', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [
        { client_uuid: 'a-1', status: 'error', message: 'Not permitted for this role/location' }
      ]
    })

    const summary = await syncOfflineQueue(MARIA.id)

    expect(summary).toEqual({ synced: 0, failed: 1 })
    expect(failedFor(MARIA.id)).toHaveLength(1)
    expect(offlineQueue.value[0].sync_error).toBe('Not permitted for this role/location')
  })

  it('mixed batch: some created, some failed -- only failures remain queued', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    enqueueEntry(sampleEntry('a-2'), MARIA)
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [
        { client_uuid: 'a-1', status: 'created', id: 'server-id-1' },
        { client_uuid: 'a-2', status: 'error', message: 'Invalid location' }
      ]
    })

    const summary = await syncOfflineQueue(MARIA.id)

    expect(summary).toEqual({ synced: 1, failed: 1 })
    expect(offlineQueue.value.map((e) => e.client_uuid)).toEqual(['a-2'])
  })

  it('does not call the API at all when the queue is empty', async () => {
    const summary = await syncOfflineQueue(MARIA.id)
    expect(summary).toEqual({ synced: 0, failed: 0 })
    expect(bulkSyncEntries).not.toHaveBeenCalled()
  })

  it('does not re-sync entries that already have a sync_error', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'a-1', status: 'error', message: 'boom' }]
    })
    await syncOfflineQueue(MARIA.id)

    // A rejected entry would be rejected again -- don't retry it on every
    // automatic sync without the user acknowledging it.
    await syncOfflineQueue(MARIA.id)
    expect(bulkSyncEntries).toHaveBeenCalledTimes(1)
  })

  // --- Shared devices ------------------------------------------------------
  it("only uploads the signed-in person's entries, never another volunteer's", async () => {
    enqueueEntry(sampleEntry('maria-1'), MARIA)
    enqueueEntry(sampleEntry('tom-1'), TOM)
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'maria-1', status: 'created', id: 'server-1' }]
    })

    await syncOfflineQueue(MARIA.id)

    const sent = vi.mocked(bulkSyncEntries).mock.calls[0][0]
    expect(sent.map((e) => e.client_uuid)).toEqual(['maria-1'])
    expect(offlineQueue.value.map((e) => e.client_uuid)).toEqual(['tom-1'])
    expect(waitingForOthers(MARIA.id).map((e) => e.queued_by_name)).toEqual(['Tom'])
  })

  it('does not send the device-only owner fields to the server', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    vi.mocked(bulkSyncEntries).mockResolvedValue({ results: [] })

    await syncOfflineQueue(MARIA.id)

    const sent = vi.mocked(bulkSyncEntries).mock.calls[0][0][0]
    expect(Object.keys(sent)).not.toContain('queued_by')
    expect(Object.keys(sent)).not.toContain('queued_by_name')
    expect(Object.keys(sent)).not.toContain('queued_at')
  })

  it('entries saved by the previous version (no owner) load, and upload under whoever syncs next', async () => {
    const legacy = { ...sampleEntry('old-1'), queued_at: '2026-09-01T10:00:00Z' }
    localStorage.setItem('csf:offline-queue', JSON.stringify([legacy]))

    // Re-import so the queue is loaded from storage, as on app start.
    vi.resetModules()
    const fresh = await import('./offlineQueue')

    expect(fresh.offlineQueue.value[0].queued_by).toBeNull()
    expect(fresh.pendingFor(TOM.id).map((e) => e.client_uuid)).toEqual(['old-1'])
  })

  it('starts with an empty queue if stored data is unreadable', async () => {
    localStorage.setItem('csf:offline-queue', '{not json')

    vi.resetModules()
    const fresh = await import('./offlineQueue')

    expect(fresh.offlineQueue.value).toEqual([])
  })

  it('runs one upload at a time: a second call during an upload shares it', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    let release!: (value: {
      results: { client_uuid: string; status: 'created'; id: string }[]
    }) => void
    vi.mocked(bulkSyncEntries).mockReturnValue(new Promise((resolve) => (release = resolve)))

    const first = syncOfflineQueue(MARIA.id)
    const second = syncOfflineQueue(MARIA.id)
    release({ results: [{ client_uuid: 'a-1', status: 'created', id: 's-1' }] })

    expect(await first).toEqual(await second)
    expect(bulkSyncEntries).toHaveBeenCalledTimes(1)
  })

  it('keeps entries added while an upload is in progress', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    let release!: (value: {
      results: { client_uuid: string; status: 'created'; id: string }[]
    }) => void
    vi.mocked(bulkSyncEntries).mockReturnValue(new Promise((resolve) => (release = resolve)))

    const upload = syncOfflineQueue(MARIA.id)
    enqueueEntry(sampleEntry('a-2'), MARIA) // recorded mid-upload
    release({ results: [{ client_uuid: 'a-1', status: 'created', id: 's-1' }] })
    await upload

    expect(offlineQueue.value.map((e) => e.client_uuid)).toEqual(['a-2'])
  })

  it('leaves the queue untouched when the upload request itself fails', async () => {
    enqueueEntry(sampleEntry('a-1'), MARIA)
    vi.mocked(bulkSyncEntries).mockRejectedValue(new Error('offline'))

    await expect(syncOfflineQueue(MARIA.id)).rejects.toThrow('offline')

    expect(pendingFor(MARIA.id).map((e) => e.client_uuid)).toEqual(['a-1'])
  })
})