import { useEffect, useState } from 'preact/hooks'
import { createEntrySchema } from '../types/entry-form-schema'
import { createEntry, listCategories, listLocations } from '../services/api'
import { enqueueEntry } from '../store/offlineQueue'
import { currentUser } from '../store/session'
import type { components } from '../types/api'

type Location = components['schemas']['Location']
type FoodCategory = components['schemas']['FoodCategory']

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WeighOut() {
  const [locations, setLocations] = useState<Location[]>([])
  const [categories, setCategories] = useState<FoodCategory[]>([])
  const [sourceLocationId, setSourceLocationId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [collectionDate, setCollectionDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    listLocations().then(setLocations).catch(() => {})
    listCategories().then(setCategories).catch(() => {})
  }, [])

  const foodCentres = locations.filter((l) => l.type === 'FOOD_CENTRE')
  const hubs = locations.filter((l) => l.type === 'HUB')

  // Only one food centre in practice for V1 -- preselect it once loaded so
  // this isn't an extra tap on every single weigh-out.
  useEffect(() => {
    if (!sourceLocationId && foodCentres.length === 1) {
      setSourceLocationId(foodCentres[0].id)
    }
  }, [foodCentres])

  if (currentUser.value?.role === 'HUB') {
    return (
      <div class="mx-auto max-w-sm px-4 py-8 text-center text-neutral-500">
        Weigh-out is only available to food centre staff and admins.
      </div>
    )
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setErrors([])
    setSaved(false)
    setSavedOffline(false)

    const candidate = {
      client_uuid: crypto.randomUUID(),
      entry_type: 'OUT' as const,
      location_id: sourceLocationId,
      destination_location_id: destinationId || null,
      food_category_code: categoryCode,
      weight_kg: Number(weightKg),
      collection_date: collectionDate,
      notes: notes.trim() || null
    }

    const result = createEntrySchema.safeParse(candidate)
    if (!result.success) {
      setErrors(result.error.issues.map((i) => i.message))
      return
    }

    setSubmitting(true)
    try {
      await createEntry(result.data)
      setSaved(true)
      setWeightKg('')
      setNotes('')
    } catch {
      enqueueEntry(result.data)
      setSavedOffline(true)
      setWeightKg('')
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div class="mx-auto max-w-sm px-4 py-8">
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">Weigh Out</h1>
      <p class="mb-6 text-sm text-neutral-500">Record parcels leaving the food centre for a hub.</p>

      {saved && (
        <div class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Saved. <a href="/entries" class="underline">View entries</a>
        </div>
      )}
      {savedOffline && (
        <div class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          No connection right now -- saved on this device and will sync automatically.{' '}
          <a href="/sync" class="underline">View sync queue</a>
        </div>
      )}
      {errors.length > 0 && (
        <div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <ul class="list-inside list-disc">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Destination hub</label>
          <select
            required
            value={destinationId}
            onInput={(e) => setDestinationId((e.target as HTMLSelectElement).value)}
            class="w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">Select a hub</option>
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Collection day</label>
          <input
            type="date"
            required
            max={todayIso()}
            value={collectionDate}
            onInput={(e) => setCollectionDate((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Category</label>
          <select
            required
            value={categoryCode}
            onInput={(e) => setCategoryCode((e.target as HTMLSelectElement).value)}
            class="w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="1000"
            required
            value={weightKg}
            onInput={(e) => setWeightKg((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Note (optional)</label>
          <textarea
            value={notes}
            onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
            class="w-full rounded-lg border border-neutral-300 px-3 py-2"
            rows={2}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          class="w-full rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save weigh-out'}
        </button>
      </form>
    </div>
  )
}
