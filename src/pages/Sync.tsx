import { useState } from 'preact/hooks'
import { offlineQueue, removeFromQueue, syncOfflineQueue } from '../store/offlineQueue'

export function Sync() {
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<{ synced: number; failed: number } | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncOfflineQueue()
      setLastResult(result)
    } finally {
      setSyncing(false)
    }
  }

  const pending = offlineQueue.value.filter((e) => !e.sync_error)
  const failed = offlineQueue.value.filter((e) => e.sync_error)

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">Sync</h1>
      <p class="mb-6 text-sm text-neutral-500">
        Entries recorded while offline are saved on this device and sync automatically. You can
        also trigger a sync manually.
      </p>

      {lastResult && (
        <div class="mb-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
          Last sync: {lastResult.synced} synced, {lastResult.failed} failed.
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={syncing || pending.length === 0}
        class="mb-6 rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {syncing ? 'Syncing…' : `Sync now (${pending.length} pending)`}
      </button>

      {offlineQueue.value.length === 0 && (
        <p class="text-neutral-500">Nothing queued. Everything's synced.</p>
      )}

      {pending.length > 0 && (
        <div class="mb-6">
          <h2 class="mb-2 font-medium text-neutral-900">Pending ({pending.length})</h2>
          <div class="space-y-2">
            {pending.map((entry) => (
              <div
                key={entry.client_uuid}
                class="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-2 text-sm"
              >
                <span>
                  {entry.entry_type} · {entry.food_category_code} · {entry.weight_kg}kg
                </span>
                <span class="text-neutral-400">{entry.collection_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div>
          <h2 class="mb-2 font-medium text-red-700">Failed ({failed.length})</h2>
          <div class="space-y-2">
            {failed.map((entry) => (
              <div
                key={entry.client_uuid}
                class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm"
              >
                <div class="flex items-center justify-between">
                  <span>
                    {entry.entry_type} · {entry.food_category_code} · {entry.weight_kg}kg
                  </span>
                  <button
                    onClick={() => removeFromQueue(entry.client_uuid)}
                    class="text-xs text-red-600 underline"
                  >
                    Discard
                  </button>
                </div>
                <div class="mt-1 text-xs text-red-600">{entry.sync_error}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
