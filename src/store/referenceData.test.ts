import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, listCategories: vi.fn(), listLocations: vi.fn(), listTrayTypes: vi.fn() }
})

import {
  ApiError,
  NetworkError,
  listCategories,
  listLocations,
  listTrayTypes
} from '../services/api'
import {
  clearReferenceData,
  getCategories,
  loadFormLists,
  warmReferenceData
} from './referenceData'

const CATEGORIES = [{ code: 'FRESH', name: 'Fresh', active: true }]

describe('referenceData', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(listCategories).mockReset()
    vi.mocked(listLocations).mockReset()
    vi.mocked(listTrayTypes).mockReset()
  })

  it('returns fresh data and keeps a copy on the device', async () => {
    vi.mocked(listCategories).mockResolvedValue(CATEGORIES as never)

    expect(await getCategories()).toEqual(CATEGORIES)
    expect(JSON.parse(localStorage.getItem('csf:cache:categories')!)).toEqual(CATEGORIES)
  })

  it('falls back to the device copy when there is no connection', async () => {
    vi.mocked(listCategories).mockResolvedValueOnce(CATEGORIES as never)
    await getCategories()
    vi.mocked(listCategories).mockRejectedValueOnce(new NetworkError())

    expect(await getCategories()).toEqual(CATEGORIES)
  })

  it('still fails offline when there is no device copy', async () => {
    vi.mocked(listCategories).mockRejectedValue(new NetworkError())

    await expect(getCategories()).rejects.toBeInstanceOf(NetworkError)
  })

  it('never hides a 401 behind the device copy', async () => {
    vi.mocked(listCategories).mockResolvedValueOnce(CATEGORIES as never)
    await getCategories()
    vi.mocked(listCategories).mockRejectedValueOnce(
      new ApiError('UNAUTHORIZED', 'Sign-in required', 401)
    )

    await expect(getCategories()).rejects.toBeInstanceOf(ApiError)
  })

  it('warm fetches all three lists and ignores failures', async () => {
    vi.mocked(listCategories).mockResolvedValue(CATEGORIES as never)
    vi.mocked(listLocations).mockRejectedValue(new NetworkError())
    vi.mocked(listTrayTypes).mockResolvedValue([] as never)

    await expect(warmReferenceData()).resolves.toBeUndefined()
    expect(localStorage.getItem('csf:cache:categories')).not.toBeNull()
    expect(localStorage.getItem('csf:cache:tray-types')).not.toBeNull()
  })

  it('clear removes every device copy', async () => {
    vi.mocked(listCategories).mockResolvedValue(CATEGORIES as never)
    vi.mocked(listLocations).mockResolvedValue([] as never)
    vi.mocked(listTrayTypes).mockResolvedValue([] as never)
    await warmReferenceData()

    clearReferenceData()

    expect(Object.keys(localStorage).filter((k) => k.startsWith('csf:cache:'))).toEqual([])
  })

  it('loadFormLists returns every list, and flags when one is missing', async () => {
    vi.mocked(listCategories).mockResolvedValue(CATEGORIES as never)
    vi.mocked(listLocations).mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Sign-in required', 401)
    )
    vi.mocked(listTrayTypes).mockResolvedValue([] as never)

    const lists = await loadFormLists()

    expect(lists.categories).toEqual(CATEGORIES)
    expect(lists.locations).toEqual([])
    expect(lists.incomplete).toBe(true)
  })

  it('loadFormLists is complete when everything loads', async () => {
    vi.mocked(listCategories).mockResolvedValue(CATEGORIES as never)
    vi.mocked(listLocations).mockResolvedValue([] as never)
    vi.mocked(listTrayTypes).mockResolvedValue([] as never)

    expect((await loadFormLists()).incomplete).toBe(false)
  })
})