import { useEffect, useState } from 'preact/hooks'
import { listEntries } from '../services/api'
import type { components } from '../types/api'

type Entry = components['schemas']['Entry']

export function EntryDetail({ entryId }: { entryId: string }) {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // V1 note: there's no single-entry GET wired into services/api.ts yet
    // (GET /entries/{id} exists in the contract) -- fetching via the list
    // endpoint and filtering client-side as an interim approach, since
    // page priority put this behind Entries/WeighIn/WeighOut/Reports/Sync.
    // Swap to a direct services/api.ts getEntry(id) call as a follow-up.
    listEntries({ limit: '100' })
      .then((res) => setEntry(res.entries.find((e) => e.id === entryId) ?? null))
      .finally(() => setLoading(false))
  }, [entryId])

  if (loading) return <div class="px-4 py-8 text-center text-neutral-500">Loading…</div>
  if (!entry) return <div class="px-4 py-8 text-center text-neutral-500">Entry not found.</div>

  return (
    <div class="mx-auto max-w-sm px-4 py-8">
      <a href="/entries" class="mb-4 inline-block text-sm text-neutral-500">
        ← Back to entries
      </a>
      <h1 class="mb-4 text-xl font-semibold text-neutral-900">
        {entry.entry_type === 'IN' ? 'Food In' : 'Food Out'}
      </h1>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between border-b border-neutral-100 py-2">
          <dt class="text-neutral-500">Name</dt>
          <dd class="text-neutral-900">{entry.name}</dd>
        </div>
        <div class="flex justify-between border-b border-neutral-100 py-2">
          <dt class="text-neutral-500">Category</dt>
          <dd class="text-neutral-900">{entry.food_category_code}</dd>
        </div>
        <div class="flex justify-between border-b border-neutral-100 py-2">
          <dt class="text-neutral-500">Gross weight</dt>
          <dd class="text-neutral-900">{entry.gross_weight_kg} kg</dd>
        </div>
        {entry.trays.length > 0 && (
          <div class="border-b border-neutral-100 py-2">
            <dt class="mb-1 text-neutral-500">Trays</dt>
            <dd class="space-y-0.5 text-neutral-900">
              {entry.trays.map((t) => (
                <div key={t.tray_type_code}>
                  {t.quantity}× {t.tray_type_name} ({t.weight_kg} kg each)
                </div>
              ))}
            </dd>
          </div>
        )}
        <div class="flex justify-between border-b border-neutral-100 py-2">
          <dt class="text-neutral-500">Net weight</dt>
          <dd class="font-medium text-neutral-900">{entry.net_weight_kg} kg</dd>
        </div>
        <div class="flex justify-between border-b border-neutral-100 py-2">
          <dt class="text-neutral-500">Collection date</dt>
          <dd class="text-neutral-900">{entry.collection_date}</dd>
        </div>
        <div class="flex justify-between border-b border-neutral-100 py-2">
          <dt class="text-neutral-500">Status</dt>
          <dd class={entry.status === 'VOID' ? 'text-red-600' : 'text-neutral-900'}>
            {entry.status}
          </dd>
        </div>
        {entry.notes && (
          <div class="py-2">
            <dt class="mb-1 text-neutral-500">Notes</dt>
            <dd class="text-neutral-900">{entry.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}