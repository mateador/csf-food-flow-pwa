import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, createEntry: vi.fn(), bulkSyncEntries: vi.fn() }
})
vi.mock('../store/autoSync', () => ({ requestSync: vi.fn() }))
vi.mock('../store/session', () => ({
  sessionEnded: vi.fn(),
  SESSION_ENDED_MESSAGE: 'signed out message'
}))

import { ApiError, NetworkError, createEntry } from './api'
import { requestSync } from '../store/autoSync'
import { sessionEnded } from '../store/session'
import { offlineQueue } from '../store/offlineQueue'
import { submitEntry } from './submitEntry'

const MARIA = { id: 'user-maria', name: 'Maria' }
const ENTRY = {
  client_uuid: 'c-1',
  entry_type: 'IN' as const,
  location_id: 'hub-1',
  destination_location_id: null,
  name: 'Tesco',
  food_category_code: 'FRESH',
  gross_weight_kg: 10,
  trays: [],
  collection_date: '2026-09-21',
  notes: null
}

describe('submitEntry', () => {
  beforeEach(() => {
    localStorage.clear()
    offlineQueue.value = []
    vi.mocked(createEntry).mockReset()
    vi.mocked(requestSync).mockReset()
    vi.mocked(sessionEnded).mockReset()
  })

  it('saved: the server has it, nothing queued, earlier entries get a chance to upload', async () => {
    vi.mocked(createEntry).mockResolvedValue({ entry: {} } as never)

    expect(await submitEntry(ENTRY, MARIA)).toEqual({ kind: 'saved' })
    expect(offlineQueue.value).toEqual([])
    expect(requestSync).toHaveBeenCalled()
  })

  it('no connection: kept on the device under the person who recorded it', async () => {
    vi.mocked(createEntry).mockRejectedValue(new NetworkError())

    expect(await submitEntry(ENTRY, MARIA)).toEqual({ kind: 'queued' })
    expect(offlineQueue.value.map((e) => [e.client_uuid, e.queued_by])).toEqual([
      ['c-1', 'user-maria']
    ])
  })

  it('server error (5xx, e.g. cold start): kept on the device', async () => {
    vi.mocked(createEntry).mockRejectedValue(new ApiError('UNKNOWN_ERROR', 'Bad gateway', 502))

    expect(await submitEntry(ENTRY, MARIA)).toEqual({ kind: 'queued' })
    expect(offlineQueue.value).toHaveLength(1)
  })

  it('signed out: kept on the device, and the user is sent to sign in', async () => {
    vi.mocked(createEntry).mockRejectedValue(new ApiError('UNAUTHORIZED', 'Sign-in required', 401))

    expect(await submitEntry(ENTRY, MARIA)).toEqual({ kind: 'signed_out' })
    expect(offlineQueue.value).toHaveLength(1)
    expect(sessionEnded).toHaveBeenCalledWith('signed out message')
  })

  it.each([
    [422, 'VALIDATION_ERROR', 'Missing required field(s): name'],
    [403, 'FORBIDDEN', 'HUB users can only record entries at their own location']
  ])(
    'refused (%i): handed back with the server message, NOT queued',
    async (status, code, message) => {
      vi.mocked(createEntry).mockRejectedValue(new ApiError(code, message, status))

      expect(await submitEntry(ENTRY, MARIA)).toEqual({ kind: 'rejected', message })
      expect(offlineQueue.value).toEqual([])
      expect(sessionEnded).not.toHaveBeenCalled()
    }
  )

  it('an unexpected error keeps the entry rather than losing it', async () => {
    vi.mocked(createEntry).mockRejectedValue(new Error('something unexpected'))

    expect(await submitEntry(ENTRY, MARIA)).toEqual({ kind: 'queued' })
    expect(offlineQueue.value).toHaveLength(1)
  })
})