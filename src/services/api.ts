import type { components } from '../types/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

/** The server answered, and refused or failed the request. */
export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** The request never got an answer: no connection, DNS failure, dropped
 * mid-flight. fetch() signals this by rejecting with a TypeError, which is
 * too generic to act on, so it's rewrapped here. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('No connection to the server')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/**
 * True when the failure is about reaching the server rather than about the
 * request itself: no connection, or a 5xx such as a cold start, a proxy
 * timeout or a crash. Worth keeping the data and retrying later. Anything
 * else (4xx) is the server saying no, and retrying won't change that.
 */
export function isUnreachable(err: unknown): boolean {
  return err instanceof NetworkError || (err instanceof ApiError && err.status >= 500)
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}

/**
 * Called whenever an authenticated request gets a 401 -- the session
 * expired or the account was deactivated while the app was open. Set once
 * by the session store (it can't be imported here without a cycle).
 *
 * Not called for sign-in requests (a 401 there means a wrong code) or for
 * /me (the session store is asking that question itself).
 */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

function isSessionCheck(path: string): boolean {
  return path.startsWith('/auth/') || path === '/me'
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      ...options,
      credentials: 'include', // send the httpOnly session cookie
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    })
  } catch (err) {
    throw new NetworkError(err)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'UNKNOWN_ERROR'
    const message = body?.error?.message ?? `Request failed: ${res.status}`
    if (res.status === 401 && !isSessionCheck(path)) onUnauthorized?.()
    throw new ApiError(code, message, res.status)
  }

  if (res.headers.get('content-type')?.includes('text/csv')) {
    return (await res.text()) as unknown as T
  }

  return res.json()
}

// --- Auth ---
export function requestLoginCode(email: string) {
  return request<{ status: string }>('/auth/code/request', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export function verifyLoginCode(email: string, code: string) {
  return request<{ user: components['schemas']['User'] }>('/auth/code/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  })
}

/** Expires the session cookie on this device. The browser can't delete an
 * httpOnly cookie itself, so signing out has to go through the server. */
export function logout() {
  return request<{ status: string }>('/auth/logout', { method: 'POST' })
}

export function getMe() {
  return request<components['schemas']['User']>('/me')
}

// --- Categories & locations ---
export function listCategories() {
  return request<components['schemas']['FoodCategory'][]>('/categories/')
}

export function listLocations() {
  return request<components['schemas']['Location'][]>('/locations/')
}

export function listTrayTypes() {
  return request<components['schemas']['TrayType'][]>('/tray-types/')
}

// --- Entries ---
type TrayInput = { tray_type_code: string; quantity: number }

type CreateEntryBody = {
  client_uuid: string
  entry_type: 'IN' | 'OUT'
  location_id: string
  destination_location_id: string | null
  name: string
  food_category_code: string
  gross_weight_kg: number
  trays: TrayInput[]
  collection_date: string
  notes: string | null
}

export function createEntry(body: CreateEntryBody) {
  return request<{ entry: components['schemas']['Entry'] }>('/entries/', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function listEntries(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return request<{
    entries: components['schemas']['Entry'][]
    pagination: components['schemas']['Pagination']
  }>(`/entries/${qs ? `?${qs}` : ''}`)
}

export function bulkSyncEntries(entries: CreateEntryBody[]) {
  return request<{
    results: { client_uuid: string; status: 'created' | 'duplicate' | 'error'; id?: string; message?: string }[]
  }>('/entries/bulk', {
    method: 'POST',
    body: JSON.stringify({ entries })
  })
}

// --- Reports ---
export function getWeeklyReport(weekStart: string, locationId?: string) {
  const qs = new URLSearchParams({ week_start: weekStart, ...(locationId ? { location_id: locationId } : {}) })
  return request<components['schemas']['WeeklyReport']>(`/reports/weekly?${qs}`)
}

export function exportWeeklyCsv(weekStart: string, locationId?: string): Promise<string> {
  const qs = new URLSearchParams({ week_start: weekStart, ...(locationId ? { location_id: locationId } : {}) })
  return request<string>(`/reports/weekly/export.csv?${qs}`)
}

// --- Users (admin) ---
export function listUsers() {
  return request<components['schemas']['User'][]>('/users/')
}