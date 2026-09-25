/**
 * localStorage helpers that never throw. Storage can be unavailable
 * (private browsing on some browsers), full, or hold something that isn't
 * valid JSON; none of those should break the app. A failed read returns
 * the fallback; a failed write is dropped.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled -- nothing useful to do here.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage disabled -- nothing to remove.
  }
}