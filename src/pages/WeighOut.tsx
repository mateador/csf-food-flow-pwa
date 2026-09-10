import { useEffect, useMemo, useState } from 'preact/hooks'
import { createEntrySchema } from '../types/entry-form-schema'
import { createEntry, listCategories, listLocations, listTrayTypes } from '../services/api'
import { enqueueEntry } from '../store/offlineQueue'
import { currentUser } from '../store/session'
import { TraySelector } from '../components/TraySelector'
import { CategorySelector } from '../components/CategorySelector'
import { getLastLocation, setLastLocation } from '../utils/lastLocation'
import type { components } from '../types/api'

type Location = components['schemas']['Location']
type FoodCategory = components['schemas']['FoodCategory']
type TrayType = components['schemas']['TrayType']

const LAST_DESTINATION_KEY = 'weigh-out-destination'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WeighOut() {
  const [locations, setLocations] = useState<Location[]>([])
  const [categories, setCategories] = useState<FoodCategory[]>([])
  const [trayTypes, setTrayTypes] = useState<TrayType[]>([])
  const [sourceLocationId, setSourceLocationId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [name, setName] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [grossWeightKg, setGrossWeightKg] = useState('')
  const [trayQuantities, setTrayQuantities] = useState<Record<string, number>>({})
  const [collectionDate, setCollectionDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    listLocations().then(setLocations).catch(() => {})
    listCategories().then(setCategories).catch(() => {})
    listTrayTypes().then(setTrayTypes).catch(() => {})
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

  // Same reasoning as WeighIn's remembered location -- most weigh-outs
  // from a given device go to the same hub repeatedly, so default to
  // last time's choice rather than re-picking from the full hub list
  // every single time.
  useEffect(() => {
    if (!destinationId && hubs.length > 0) {
      const remembered = getLastLocation(LAST_DESTINATION_KEY)
      if (remembered && hubs.some((h) => h.id === remembered)) {
        setDestinationId(remembered)
      }
    }
  }, [hubs])

  const trays = useMemo(
    () =>
      Object.entries(trayQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([tray_type_code, quantity]) => ({ tray_type_code, quantity })),
    [trayQuantities]
  )

  const traysWeight = trays.reduce((sum, t) => {
    const tray = trayTypes.find((tt) => tt.code === t.tray_type_code)
    return sum + (tray ? tray.weight_kg * t.quantity : 0)
  }, 0)
  const grossNum = Number(grossWeightKg)
  const netPreview = Number.isFinite(grossNum) ? grossNum - traysWeight : null
  const netIsNegative = netPreview !== null && netPreview < 0

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
      name: name.trim(),
      food_category_code: categoryCode,
      gross_weight_kg: Number(grossWeightKg),
      trays,
      collection_date: collectionDate,
      notes: notes.trim() || null
    }

    const result = createEntrySchema.safeParse(candidate)
    if (!result.success) {
      setErrors(result.error.issues.map((i) => i.message))
      return
    }
    if (netIsNegative) {
      setErrors(['Selected trays weigh more than the gross weight entered -- check the weight and tray selection'])
      return
    }

    setSubmitting(true)
    try {
      await createEntry(result.data)
      setLastLocation(LAST_DESTINATION_KEY, destinationId)
      setSaved(true)
      setName('')
      setGrossWeightKg('')
      setTrayQuantities({})
      setNotes('')
    } catch {
      enqueueEntry(result.data)
      setLastLocation(LAST_DESTINATION_KEY, destinationId)
      setSavedOffline(true)
      setName('')
      setGrossWeightKg('')
      setTrayQuantities({})
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div class="mx-auto max-w-sm px-4 py-8">
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">Food Out</h1>
      <p class="mb-6 text-sm text-neutral-500">Record parcels leaving the food centre for a hub.</p>

      {saved && (
        <div class="mb-4 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-green-800">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" class="shrink-0">
            <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15" />
            <path
              d="M7 12.5l3 3 7-7.5"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div>
            <p class="text-base font-semibold">Saved</p>
            <a href="/entries" class="text-sm underline">View entries</a>
          </div>
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
          <label class="mb-1 block text-sm font-medium text-neutral-700">Name</label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Category</label>
          <CategorySelector categories={categories} value={categoryCode} onChange={setCategoryCode} />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Weight (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            max="1000"
            required
            value={grossWeightKg}
            onInput={(e) => setGrossWeightKg((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
          <p class="mt-1 text-xs text-neutral-400">What the scale reads -- food and trays together.</p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-700">Trays (optional)</label>
          <TraySelector
            trayTypes={trayTypes}
            quantities={trayQuantities}
            onChange={(code, qty) => setTrayQuantities((prev) => ({ ...prev, [code]: qty }))}
          />
          {trays.length > 0 && netPreview !== null && (
            <p class={`mt-2 text-sm ${netIsNegative ? 'text-red-600' : 'text-neutral-600'}`}>
              Net weight: <span class="font-medium">{netPreview.toFixed(1)} kg</span>
              {netIsNegative && ' -- trays weigh more than the gross weight entered'}
            </p>
          )}
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