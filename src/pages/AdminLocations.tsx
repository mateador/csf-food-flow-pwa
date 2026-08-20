import { useEffect, useState } from 'preact/hooks'
import { listLocations } from '../services/api'
import type { components } from '../types/api'

type Location = components['schemas']['Location']

export function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listLocations().then(setLocations).finally(() => setLoading(false))
  }, [])

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="mb-6 text-xl font-semibold text-neutral-900">Locations</h1>
      {loading && <p class="text-neutral-500">Loading…</p>}
      <div class="space-y-2">
        {locations.map((loc) => (
          <div
            key={loc.id}
            class="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
          >
            <div>
              <div class="font-medium text-neutral-900">{loc.name}</div>
              <div class="text-sm text-neutral-500">{loc.type}</div>
            </div>
            <span
              class={`rounded-full px-2 py-1 text-xs ${
                loc.active ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {loc.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
      <p class="mt-6 text-sm text-neutral-400">
        Create/edit forms are a follow-up -- this V1 view covers the read path
        (POST /locations and PATCH /locations/&#123;id&#125; are already live on the API).
      </p>
    </div>
  )
}
