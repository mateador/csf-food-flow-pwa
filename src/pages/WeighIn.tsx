import { useEffect, useMemo, useState } from 'preact/hooks'
import { createEntrySchema } from '../types/entry-form-schema'
import { submitEntry } from '../services/submitEntry'
import { loadFormLists } from '../store/referenceData'
import { RecordingAs } from '../components/RecordingAs'
import { currentUser } from '../store/session'
import { TraySelector } from '../components/TraySelector'
import { CategorySelector } from '../components/CategorySelector'
import { getLastLocation, setLastLocation } from '../utils/lastLocation'
import type { components } from '../types/api'

type Location = components['schemas']['Location']
type FoodCategory = components['schemas']['FoodCategory']
type TrayType = components['schemas']['TrayType']

const LAST_LOCATION_KEY = 'weigh-in'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WeighIn() {
  const [locations, setLocations] = useState<Location[]>([])
  const [categories, setCategories] = useState<FoodCategory[]>([])
  const [trayTypes, setTrayTypes] = useState<TrayType[]>([])
  const [locationId, setLocationId] = useState('')
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

  const isHub = currentUser.value?.role === 'HUB'

  const [listsIncomplete, setListsIncomplete] = useState(false)

  useEffect(() => {
    // Device copies are used when there's no connection -- see referenceData.ts
    loadFormLists().then((lists) => {
      setLocations(lists.locations)
      setCategories(lists.categories)
      setTrayTypes(lists.trayTypes)
      setListsIncomplete(lists.incomplete)
    })
  }, [])

  // HUB users can only ever weigh in at their own location -- lock it in
  // rather than showing a dropdown they can't meaningfully use.
  useEffect(() => {
    if (isHub && currentUser.value?.location_id) {
      setLocationId(currentUser.value.location_id)
    }
  }, [isHub])

  // FOOD_CENTRE/ADMIN users re-pick a location every visit otherwise --
  // default to whatever they used last time on this device, still fully
  // overridable. Only applies once locations have actually loaded, so we
  // don't default to a location that then turns out to not exist/be
  // inactive.
  useEffect(() => {
    if (!isHub && !locationId && locations.length > 0) {
      const remembered = getLastLocation(LAST_LOCATION_KEY)
      if (remembered && locations.some((l) => l.id === remembered)) {
        setLocationId(remembered)
      }
    }
  }, [isHub, locations])

  const trays = useMemo(
    () =>
      Object.entries(trayQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([tray_type_code, quantity]) => ({ tray_type_code, quantity })),
    [trayQuantities]
  )

  // Live preview only -- purely for the person's own feedback as they
  // select trays. The server recomputes and stores the authoritative
  // net_weight_kg itself; this number is never sent as-is.
  const traysWeight = trays.reduce((sum, t) => {
    const tray = trayTypes.find((tt) => tt.code === t.tray_type_code)
    return sum + (tray ? tray.weight_kg * t.quantity : 0)
  }, 0)
  const grossNum = Number(grossWeightKg)
  const netPreview = Number.isFinite(grossNum) ? grossNum - traysWeight : null
  const netIsNegative = netPreview !== null && netPreview < 0

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setErrors([])
    setSaved(false)
    setSavedOffline(false)

    const candidate = {
      client_uuid: crypto.randomUUID(),
      entry_type: 'IN' as const,
      location_id: locationId,
      destination_location_id: null,
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
      const user = currentUser.value!
      const outcome = await submitEntry(result.data, { id: user.id, name: user.name })
      if (outcome.kind === 'rejected') {
        // The server looked at it and said no. Keep the form filled in so
        // it can be corrected -- nothing was saved anywhere.
        setErrors([outcome.message])
        return
      }
      if (outcome.kind === 'signed_out') return // sessionEnded() has moved to sign-in
      if (!isHub) setLastLocation(LAST_LOCATION_KEY, locationId)
      if (outcome.kind === 'saved') setSaved(true)
      else setSavedOffline(true)
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
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">Food In</h1>
      <p class="mb-6 text-sm text-neutral-500">Record surplus food arriving at a location.</p>

      <RecordingAs />

      {listsIncomplete && (
        <div class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Some of this form's lists couldn't be loaded. Open the app once with a connection so
          they're saved on this device, then come back to this page.
        </div>
      )}

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
          No connection right now -- saved on this device. It uploads automatically when the
          connection is back.{' '}
          <a href="/sync" class="underline">View waiting entries</a>
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
          <label class="mb-1 block text-sm font-medium text-neutral-700">Location</label>
          {isHub ? (
            <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700">
              {locations.find((l) => l.id === locationId)?.name ?? 'Your hub'}
            </div>
          ) : (
            <select
              required
              value={locationId}
              onInput={(e) => setLocationId((e.target as HTMLSelectElement).value)}
              class="w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              <option value="">Select a location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          )}
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
          {submitting ? 'Saving…' : 'Save weigh-in'}
        </button>
      </form>
    </div>
  )
}