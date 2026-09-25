import type { components } from '../types/api'
import { isUnreachable, listCategories, listLocations, listTrayTypes } from '../services/api'
import { readJson, removeKey, writeJson } from '../utils/storage'

type Location = components['schemas']['Location']
type FoodCategory = components['schemas']['FoodCategory']
type TrayType = components['schemas']['TrayType']

/**
 * The lists every weigh form needs -- locations, food categories, tray
 * types -- kept on the device so the forms still work with no connection.
 *
 * Each fetch goes to the network first. A successful reply refreshes the
 * device copy; if the server can't be reached, the last copy is used
 * instead. A 4xx (e.g. signed out) is never masked by the copy.
 *
 * The copies are cleared on sign-out, so a shared tablet never shows one
 * volunteer's lists to the next. They're refreshed on every sign-in.
 */
const KEYS = {
  locations: 'csf:cache:locations',
  categories: 'csf:cache:categories',
  trayTypes: 'csf:cache:tray-types'
} as const

async function networkFirst<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const fresh = await fetcher()
    writeJson(key, fresh)
    return fresh
  } catch (err) {
    if (isUnreachable(err)) {
      const cached = readJson<T | null>(key, null)
      if (cached !== null) return cached
    }
    throw err
  }
}

export function getLocations(): Promise<Location[]> {
  return networkFirst(KEYS.locations, listLocations)
}

export function getCategories(): Promise<FoodCategory[]> {
  return networkFirst(KEYS.categories, listCategories)
}

export function getTrayTypes(): Promise<TrayType[]> {
  return networkFirst(KEYS.trayTypes, listTrayTypes)
}

/** Fetches all three lists so they're on the device before the signal
 * goes -- called right after sign-in and whenever the session is confirmed
 * online. Failures are ignored; the forms retry when they open. */
export async function warmReferenceData(): Promise<void> {
  await Promise.allSettled([getLocations(), getCategories(), getTrayTypes()])
}

export type FormLists = {
  locations: Location[]
  categories: FoodCategory[]
  trayTypes: TrayType[]
  /** True if any list couldn't be loaded from the server or the device. */
  incomplete: boolean
}

/**
 * Everything a weigh form needs, in one call. A list that can't be loaded
 * comes back empty with `incomplete` set, so the form can say why instead
 * of showing an empty dropdown. (A 401 also signs the person out -- see
 * setUnauthorizedHandler in session.ts.)
 */
export async function loadFormLists(): Promise<FormLists> {
  const [locations, categories, trayTypes] = await Promise.allSettled([
    getLocations(),
    getCategories(),
    getTrayTypes()
  ])
  return {
    locations: locations.status === 'fulfilled' ? locations.value : [],
    categories: categories.status === 'fulfilled' ? categories.value : [],
    trayTypes: trayTypes.status === 'fulfilled' ? trayTypes.value : [],
    incomplete: [locations, categories, trayTypes].some((r) => r.status === 'rejected')
  }
}

export function clearReferenceData(): void {
  Object.values(KEYS).forEach(removeKey)
}