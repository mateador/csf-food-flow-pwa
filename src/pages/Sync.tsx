import { useState } from 'preact/hooks'
import {
  failedFor,
  pendingFor,
  removeFromQueue,
  waitingForOthers,
  type QueuedEntry
} from '../store/offlineQueue'
import { lastSyncProblem, requestSync } from '../store/autoSync'
import { currentUser, sessionOffline } from '../store/session'

function EntryLine({ entry }: { entry: QueuedEntry }) {
  return (
    <>
      <span>
        {entry.entry_type} · {entry.name} · {entry.food_category_code} · {entry.gross_weight_kg}kg
      </span>
      <span class="text-neutral-400">{entry.collection_date}</span>
    </>
  )
}

export function Sync() {
  const [syncing, setSyncing] = useState(false)
  const user = currentUser.value
  if (!user) return null

  const pending = pendingFor(user.id)
  const failed = failedFor(user.id)
  const others = waitingForOthers(user.id)

  // Group other volunteers' entries by who recorded them.
  const othersByName = new Map<string, number>()
  for (const e of others) {
    const who = e.queued_by_name ?? 'another volunteer'
    othersByName.set(who, (othersByName.get(who) ?? 0) + 1)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await requestSync()
    } finally {
      setSyncing(false)
    }
  }

  const nothingHere = pending.length === 0 && failed.length === 0 && others.length === 0

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">Sync</h1>
      <p class="mb-6 text-sm text-neutral-500">
        Entries recorded without a connection are kept on this device and upload automatically when
        the connection is back. You can also upload them now.
      </p>

      {sessionOffline.value && (
        <div class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          No connection right now. Waiting entries will upload when it's back.
        </div>
      )}
      {!sessionOffline.value && lastSyncProblem.value && pending.length > 0 && (
        <div class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {lastSyncProblem.value}
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={syncing || pending.length === 0}
        class="mb-6 rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {syncing ? 'Uploading…' : `Upload now (${pending.length} waiting)`}
      </button>

      {nothingHere && <p class="text-neutral-500">Nothing waiting. Everything's uploaded.</p>}

      {pending.length > 0 && (
        <div class="mb-6">
          <h2 class="mb-2 font-medium text-neutral-900">Waiting to upload ({pending.length})</h2>
          <div class="space-y-2">
            {pending.map((entry) => (
              <div
                key={entry.client_uuid}
                class="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm"
              >
                <EntryLine entry={entry} />
              </div>
            ))}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div class="mb-6">
          <h2 class="mb-2 font-medium text-red-700">Refused by the server ({failed.length})</h2>
          <p class="mb-2 text-sm text-neutral-600">
            These won't upload as they are. Record them again with the details corrected, then
            discard the original.
          </p>
          <div class="space-y-2">
            {failed.map((entry) => (
              <div
                key={entry.client_uuid}
                class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm"
              >
                <div class="flex items-center justify-between gap-3">
                  <EntryLine entry={entry} />
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

      {others.length > 0 && (
        <div>
          <h2 class="mb-2 font-medium text-neutral-900">
            Recorded by other volunteers ({others.length})
          </h2>
          <p class="mb-2 text-sm text-neutral-600">
            These upload the next time the person who recorded them signs in on this device.
          </p>
          <ul class="space-y-1 text-sm text-neutral-700">
            {[...othersByName.entries()].map(([who, count]) => (
              <li key={who}>
                {who}: {count} {count === 1 ? 'entry' : 'entries'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}