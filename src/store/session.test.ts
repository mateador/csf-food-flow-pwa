import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, getMe: vi.fn(), logout: vi.fn(), setUnauthorizedHandler: vi.fn() }
})
vi.mock('./referenceData', () => ({ warmReferenceData: vi.fn(), clearReferenceData: vi.fn() }))
vi.mock('preact-router', () => ({ route: vi.fn() }))

import { route } from 'preact-router'
import { ApiError, NetworkError, getMe, logout, setUnauthorizedHandler } from '../services/api'
import { clearReferenceData, warmReferenceData } from './referenceData'
import {
  currentUser,
  loadSession,
  SESSION_ENDED_MESSAGE,
  sessionEnded,
  sessionOffline,
  signInNotice,
  signOut,
  signedIn
} from './session'

const MARIA = {
  id: 'user-maria',
  name: 'Maria',
  email: 'maria@example.org',
  role: 'HUB',
  location_id: 'hub-1',
  active: true,
  last_login_at: null,
  created_at: '2026-09-01T00:00:00Z'
} as never as NonNullable<typeof currentUser.value>

const unauthorized = () => new ApiError('UNAUTHORIZED', 'Sign-in required', 401)

describe('session', () => {
  beforeEach(() => {
    localStorage.clear()
    currentUser.value = null
    sessionOffline.value = false
    signInNotice.value = null
    vi.mocked(getMe).mockReset()
    vi.mocked(logout).mockReset()
    vi.mocked(route).mockReset()
    vi.mocked(warmReferenceData).mockReset()
    vi.mocked(clearReferenceData).mockReset()
  })

  // --- Starting the app ------------------------------------------------------
  it('signs in when the server confirms the session, and keeps a device copy', async () => {
    vi.mocked(getMe).mockResolvedValue(MARIA)

    await loadSession()

    expect(currentUser.value).toEqual(MARIA)
    expect(sessionOffline.value).toBe(false)
    expect(JSON.parse(localStorage.getItem('csf:session-user')!)).toEqual(MARIA)
    expect(warmReferenceData).toHaveBeenCalled()
  })

  it('carries on as the last user when the app opens with no connection', async () => {
    localStorage.setItem('csf:session-user', JSON.stringify(MARIA))
    vi.mocked(getMe).mockRejectedValue(new NetworkError())

    await loadSession()

    expect(currentUser.value).toEqual(MARIA)
    expect(sessionOffline.value).toBe(true)
  })

  it('is signed out when opened offline with nobody ever signed in', async () => {
    vi.mocked(getMe).mockRejectedValue(new NetworkError())

    await loadSession()

    expect(currentUser.value).toBeNull()
  })

  it('is signed out, and forgets the device copy, when the server says 401', async () => {
    localStorage.setItem('csf:session-user', JSON.stringify(MARIA))
    vi.mocked(getMe).mockRejectedValue(unauthorized())

    await loadSession()

    expect(currentUser.value).toBeNull()
    expect(localStorage.getItem('csf:session-user')).toBeNull()
    expect(clearReferenceData).toHaveBeenCalled()
  })

  // --- Signing out on a shared tablet ------------------------------------
  it('sign-out expires the cookie on the server and forgets everything locally', async () => {
    currentUser.value = MARIA
    localStorage.setItem('csf:session-user', JSON.stringify(MARIA))
    vi.mocked(logout).mockResolvedValue({ status: 'signed_out' })

    await signOut()

    expect(logout).toHaveBeenCalled()
    expect(currentUser.value).toBeNull()
    expect(localStorage.getItem('csf:session-user')).toBeNull()
    expect(localStorage.getItem('csf:pending-logout')).toBeNull()
    expect(clearReferenceData).toHaveBeenCalled()
  })

  it('a sign-out without signal is finished before anyone is trusted again', async () => {
    currentUser.value = MARIA
    vi.mocked(logout).mockRejectedValue(new NetworkError())
    await signOut()
    expect(currentUser.value).toBeNull()

    // Next start, still no signal. The old cookie may still be valid, so
    // the server must NOT be asked who's signed in -- it would say Maria.
    await loadSession()

    expect(getMe).not.toHaveBeenCalled()
    expect(currentUser.value).toBeNull()
  })

  it('once the connection is back, the pending sign-out completes first', async () => {
    localStorage.setItem('csf:pending-logout', 'true')
    vi.mocked(logout).mockResolvedValue({ status: 'signed_out' })
    vi.mocked(getMe).mockRejectedValue(unauthorized())

    await loadSession()

    expect(logout).toHaveBeenCalledBefore(vi.mocked(getMe))
    expect(localStorage.getItem('csf:pending-logout')).toBeNull()
    expect(currentUser.value).toBeNull()
  })

  it('a server answer other than success still settles the sign-out, so the device never gets stuck', async () => {
    localStorage.setItem('csf:pending-logout', 'true')
    vi.mocked(logout).mockRejectedValue(new ApiError('NOT_FOUND', 'Not found', 404))
    vi.mocked(getMe).mockRejectedValue(unauthorized())

    await loadSession()

    expect(localStorage.getItem('csf:pending-logout')).toBeNull()
    expect(getMe).toHaveBeenCalled()
  })

  it('signing in clears a pending sign-out', () => {
    localStorage.setItem('csf:pending-logout', 'true')

    signedIn(MARIA)

    expect(localStorage.getItem('csf:pending-logout')).toBeNull()
    expect(currentUser.value).toEqual(MARIA)
    expect(warmReferenceData).toHaveBeenCalled()
  })

  // --- Session ending mid-use ------------------------------------------
  it('when the session ends mid-use, it signs out, explains why, and goes to sign-in', () => {
    currentUser.value = MARIA

    sessionEnded("You've been signed out.")

    expect(currentUser.value).toBeNull()
    expect(signInNotice.value).toBe("You've been signed out.")
    expect(route).toHaveBeenCalledWith('/login', true)
  })

  it('ending the session twice at once only signs out and redirects once', () => {
    currentUser.value = MARIA

    sessionEnded()
    sessionEnded()

    expect(route).toHaveBeenCalledTimes(1)
    expect(signInNotice.value).toBe(SESSION_ENDED_MESSAGE)
  })

  it('a 401 from any request, while signed in, ends the session', () => {
    const handler = vi.mocked(setUnauthorizedHandler).mock.calls[0][0]
    currentUser.value = MARIA

    handler()

    expect(currentUser.value).toBeNull()
    expect(signInNotice.value).toBe(SESSION_ENDED_MESSAGE)
    expect(route).toHaveBeenCalledWith('/login', true)
  })

  it('a 401 while already signed out does nothing', () => {
    const handler = vi.mocked(setUnauthorizedHandler).mock.calls[0][0]

    handler()

    expect(route).not.toHaveBeenCalled()
  })
})