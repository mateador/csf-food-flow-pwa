import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  ApiError,
  NetworkError,
  getMe,
  isUnauthorized,
  isUnreachable,
  listLocations,
  logout,
  setUnauthorizedHandler,
  verifyLoginCode
} from './api'

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  )
}

describe('api client error classification', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('turns a failed fetch (no connection) into a NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const err = await getMe().catch((e) => e)

    expect(err).toBeInstanceOf(NetworkError)
    expect(isUnreachable(err)).toBe(true)
    expect(isUnauthorized(err)).toBe(false)
  })

  it('treats a 5xx (cold start, proxy timeout) as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => reply(503, {}))
    )

    const err = await getMe().catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(503)
    expect(isUnreachable(err)).toBe(true)
  })

  it('treats a 401 as signed out, not unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          reply(401, { error: { code: 'UNAUTHORIZED', message: 'Sign-in required' } })
        )
    )

    const err = await getMe().catch((e) => e)

    expect(isUnauthorized(err)).toBe(true)
    expect(isUnreachable(err)).toBe(false)
    expect(err.message).toBe('Sign-in required')
  })

  it('treats a 422 as a refusal, keeping the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        reply(422, {
          error: { code: 'VALIDATION_ERROR', message: 'Missing required field(s): name' }
        })
      )
    )

    const err = await getMe().catch((e) => e)

    expect(isUnreachable(err)).toBe(false)
    expect(isUnauthorized(err)).toBe(false)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.message).toBe('Missing required field(s): name')
  })

  it('copes with an error reply that has no JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
    )

    const err = await getMe().catch((e) => e)

    expect(err.code).toBe('UNKNOWN_ERROR')
    expect(isUnreachable(err)).toBe(true)
  })

  it('logout posts to /auth/logout with the session cookie', async () => {
    const fetchMock = vi.fn().mockImplementation(() => reply(200, { status: 'signed_out' }))
    vi.stubGlobal('fetch', fetchMock)

    await logout()

    const [url, init] = fetchMock.mock.calls[0]
    // The base comes from VITE_API_URL: empty in production (relative,
    // through the Netlify proxy), http://localhost:8000 in a local .env.
    expect(url).toMatch(/^(https?:\/\/[^/]+)?\/api\/v1\/auth\/logout$/)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
  })
})

describe('session-ended handler', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(() => {})
  })

  function stub401() {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          reply(401, { error: { code: 'UNAUTHORIZED', message: 'Sign-in required' } })
        )
    )
  }

  it('is called when any authenticated request gets a 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    stub401()

    await listLocations().catch(() => {})

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('is not called for a wrong sign-in code or for the session check itself', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    stub401()

    await verifyLoginCode('a@example.org', '0000').catch(() => {})
    await getMe().catch(() => {})

    expect(handler).not.toHaveBeenCalled()
  })

  it('is not called for other refusals', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => reply(403, {}))
    )

    await listLocations().catch(() => {})

    expect(handler).not.toHaveBeenCalled()
  })
})