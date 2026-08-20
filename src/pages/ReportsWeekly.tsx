import { useEffect, useState } from 'preact/hooks'
import { getWeeklyReport, exportWeeklyCsv } from '../services/api'
import { currentUser } from '../store/session'
import type { components } from '../types/api'

type WeeklyReport = components['schemas']['WeeklyReport']

function mostRecentMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

export function ReportsWeekly() {
  const [weekStart, setWeekStart] = useState(mostRecentMonday())
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = currentUser.value?.role === 'ADMIN'

  useEffect(() => {
    setLoading(true)
    setError(null)
    getWeeklyReport(weekStart)
      .then(setReport)
      .catch((err) => setError(err.message ?? 'Could not load report'))
      .finally(() => setLoading(false))
  }, [weekStart])

  const handleExport = async () => {
    try {
      const csv = await exportWeeklyCsv(weekStart)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `csf-report-${weekStart}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed')
    }
  }

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-neutral-900">Weekly Report</h1>
        {isAdmin && (
          <button
            onClick={handleExport}
            class="rounded-lg border border-csf-purple px-3 py-1.5 text-sm text-csf-purple hover:bg-csf-purple-light"
          >
            Export CSV
          </button>
        )}
      </div>

      <label class="mb-4 block text-sm">
        <span class="mb-1 block text-neutral-700">Week starting (Monday)</span>
        <input
          type="date"
          value={weekStart}
          onInput={(e) => setWeekStart((e.target as HTMLInputElement).value)}
          class="rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>

      {loading && <p class="text-neutral-500">Loading…</p>}
      {error && <p class="text-red-600">{error}</p>}

      {report && (
        <div class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="rounded-lg border border-neutral-200 p-4">
              <h2 class="mb-2 font-medium text-neutral-900">Total In</h2>
              {Object.entries(report.totals.in_by_category ?? {}).map(([cat, kg]) => (
                <div key={cat} class="flex justify-between text-sm">
                  <span class="text-neutral-500">{cat}</span>
                  <span class="text-neutral-900">{kg} kg</span>
                </div>
              ))}
            </div>
            <div class="rounded-lg border border-neutral-200 p-4">
              <h2 class="mb-2 font-medium text-neutral-900">Total Out</h2>
              {Object.entries(report.totals.out_by_category ?? {}).map(([cat, kg]) => (
                <div key={cat} class="flex justify-between text-sm">
                  <span class="text-neutral-500">{cat}</span>
                  <span class="text-neutral-900">{kg} kg</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 class="mb-2 font-medium text-neutral-900">By Location</h2>
            <div class="space-y-2">
              {report.by_location.map((loc) => (
                <div key={loc.location_id} class="rounded-lg border border-neutral-200 p-3 text-sm">
                  <div class="mb-1 font-medium text-neutral-900">{loc.location_name}</div>
                  <div class="text-neutral-500">
                    In:{' '}
                    {Object.entries(loc.in_by_category ?? {})
                      .map(([c, kg]) => `${c} ${kg}kg`)
                      .join(', ')}
                  </div>
                  <div class="text-neutral-500">
                    Out:{' '}
                    {Object.entries(loc.out_by_category ?? {})
                      .map(([c, kg]) => `${c} ${kg}kg`)
                      .join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
