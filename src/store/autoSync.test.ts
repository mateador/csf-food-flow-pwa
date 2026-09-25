import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { signal } from '@preact/signals'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, bulkSyncEntries: vi.fn() }
})
vi.mock('preact-router', () => ({ route: vi.fn() }))

// A stand-in session store, so each test controls who's signed in.
const session = vi.hoisted(() => ({
  currentUser: null as unknown as ReturnType<typeof signal<{ id: string; name: string } | null>>,
  sessionOffline: null as unknown as ReturnType<typeof signal<boolean>>,
  loadSession: vi.fn(),
  sessionEnded: vi.fn(),
  signOut: vi.fn(),
  SESSION_ENDED_MESSAGE: 'signed out message'
}))
vi.mock('./session', async () => {
  const { signal } = await import('@preact/signals')
  session.currentUser = signal(null)
  session.sessionOffline = signal(false)
  return session
})

import { route } from 'preact-router'
import { ApiError, NetworkError, bulkSyncEntries } from '../services/api'
import { enqueueEntry, offlineQueue } from './offlineQueue'
import { SESSION_ENDED_MESSAGE } from './session'
import { lastSyncProblem, requestSync, startAutoSync, syncThenSignOut } from './autoSync'

const MARIA = { id: 'user-maria', name: 'Maria' }

function queueOne(uuid = 'c-1', owner = MARIA) {
  enqueueEntry(
    {
      client_uuid: uuid,
      entry_type: 'IN',
      location_id: 'hub-1',
      destination_location_id: null,
      name: 'Tesco',
      food_category_code: 'FRESH',
      gross_weight_kg: 10,
      trays: [],
      collection_date: '2026-09-21',
      notes: null
    },
    owner
  )
}

describe('autoSync', () => {
  beforeEach(() => {
    localStorage.clear()
    offlineQueue.value = []
    lastSyncProblem.value = null
    session.currentUser.value = MARIA
    session.sessionOffline.value = false
    session.loadSession.mockReset()
    session.sessionEnded.mockReset()
    session.signOut.mockReset()
    vi.mocked(bulkSyncEntries).mockReset()
    vi.mocked(route).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("uploads the signed-in person's waiting entries", async () => {
    queueOne()
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'c-1', status: 'created', id: 's-1' }]
    })

    await requestSync()

    expect(offlineQueue.value).toEqual([])
    expect(lastSyncProblem.value).toBeNull()
  })

  it('does nothing when there is nothing waiting', async () => {
    await requestSync()

    expect(bulkSyncEntries).not.toHaveBeenCalled()
  })

  it('does nothing when nobody is signed in', async () => {
    queueOne()
    session.currentUser.value = null

    await requestSync()

    expect(bulkSyncEntries).not.toHaveBeenCalled()
  })

  it('no connection: keeps the entries and says it will retry', async () => {
    queueOne()
    vi.mocked(bulkSyncEntries).mockRejectedValue(new NetworkError())

    await requestSync()

    expect(offlineQueue.value).toHaveLength(1)
    expect(lastSyncProblem.value).toMatch(/try again automatically/)
    expect(session.sessionEnded).not.toHaveBeenCalled()
  })

  it('session ended: keeps the entries and sends the person to sign in', async () => {
    queueOne()
    vi.mocked(bulkSyncEntries).mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Sign-in required', 401)
    )

    await requestSync()

    expect(offlineQueue.value).toHaveLength(1)
    expect(session.sessionEnded).toHaveBeenCalledWith(SESSION_ENDED_MESSAGE)
  })

  it('an assumed (offline) session is confirmed with the server before uploading', async () => {
    queueOne()
    session.sessionOffline.value = true
    session.loadSession.mockImplementation(async () => {
      session.sessionOffline.value = false // server confirmed Maria
    })
    vi.mocked(bulkSyncEntries).mockResolvedValue({
      results: [{ client_uuid: 'c-1', status: 'created', id: 's-1' }]
    })

    await requestSync()

    expect(session.loadSession).toHaveBeenCalled()
    expect(offlineQueue.value).toEqual([])
  })

  it('does not upload while the connection is still down', async () => {
    queueOne()
    session.sessionOffline.value = true
    session.loadSession.mockResolvedValue(undefined) // still offline

    await requestSync()

    expect(bulkSyncEntries).not.toHaveBeenCalled()
  })

  it('if the assumed session turns out to have ended, sends the person to sign in', async () => {
    queueOne()
    session.sessionOffline.value = true
    session.loadSession.mockImplementation(async () => {
      session.sessionOffline.value = false
      session.currentUser.value = null // server said 401
    })

    await requestSync()

    expect(session.sessionEnded).toHaveBeenCalledWith(SESSION_ENDED_MESSAGE)
    expect(bulkSyncEntries).not.toHaveBeenCalled()
    expect(offlineQueue.value).toHaveLength(1)
  })

  it('uploads when the device comes back online, and every minute', async () => {
    vi.useFakeTimers()
    vi.mocked(bulkSyncEntries).mockResolvedValue({ results: [] })
    const stop = startAutoSync()

    queueOne('c-1')
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(bulkSyncEntries).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(60_000)
    expect(bulkSyncEntries).toHaveBeenCalledTimes(2)

    stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(bulkSyncEntries).toHaveBeenCalledTimes(2)
  })

  it('sign-out uploads waiting entries first, then signs out and goes to sign-in', async () => {
    queueOne()
    const order: string[] = []
    vi.mocked(bulkSyncEntries).mockImplementation(async () => {
      order.push('upload')
      return { results: [{ client_uuid: 'c-1', status: 'created', id: 's-1' }] }
    })
    session.signOut.mockImplementation(async () => {
      order.push('signOut')
    })

    await syncThenSignOut()

    expect(order).toEqual(['upload', 'signOut'])
    expect(route).toHaveBeenCalledWith('/login', true)
  })

  it('sign-out still happens when the upload cannot', async () => {
    queueOne()
    vi.mocked(bulkSyncEntries).mockRejectedValue(new NetworkError())

    await syncThenSignOut()

    expect(session.signOut).toHaveBeenCalled()
    expect(offlineQueue.value).toHaveLength(1) // kept for next sign-in
  })
})