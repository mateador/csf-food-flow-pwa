import type { components } from '../types/api'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    credentials: 'include', // required for the httpOnly session cookie cross-origin
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'UNKNOWN_ERROR'
    const message = body?.error?.message ?? `Request failed: ${res.status}`
    throw new ApiError(code, message, res.status)
  }

  if (res.headers.get('content-type')?.includes('text/csv')) {
    return (await res.text()) as unknown as T
  }

  return res.json()
}

// --- Auth ---
export function requestMagicLink(email: string) {
  return request<{ status: string }>('/auth/magic-link/request', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export function verifyMagicLink(token: string) {
  return request<{ user: components['schemas']['User'] }>('/auth/magic-link/verify', {
    method: 'POST',
    body: JSON.stringify({ token })
  })
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

// --- Entries ---
type CreateEntryBody = {
  client_uuid: string
  entry_type: 'IN' | 'OUT'
  location_id: string
  destination_location_id: string | null
  food_category_code: string
  weight_kg: number
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
