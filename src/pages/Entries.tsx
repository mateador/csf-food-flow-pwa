import { useEffect, useState } from 'preact/hooks'
import { Link } from '../components/RouterLink'
import { listEntries } from '../services/api'
import type { components } from '../types/api'

type Entry = components['schemas']['Entry']

export function Entries() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    listEntries({ limit: '50' })
      .then((res) => setEntries(res.entries))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="mb-6 text-xl font-semibold text-neutral-900">Recent Entries</h1>

      {loading && <p class="text-neutral-500">Loading…</p>}
      {error && <p class="text-red-600">Couldn't load entries. Try again.</p>}
      {!loading && !error && entries.length === 0 && (
        <p class="text-neutral-500">No entries yet.</p>
      )}

      <div class="space-y-2">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/entries/${entry.id}`}
            class="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 hover:border-csf-purple"
          >
            <div>
              <div class="font-medium text-neutral-900">
                {entry.entry_type === 'IN' ? 'Weigh In' : 'Weigh Out'} · {entry.food_category_code}
              </div>
              <div class="text-sm text-neutral-500">{entry.collection_date}</div>
            </div>
            <div class="text-right">
              <div class="font-medium text-neutral-900">{entry.weight_kg} kg</div>
              {entry.status === 'VOID' && (
                <div class="text-xs text-red-600">Voided</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
