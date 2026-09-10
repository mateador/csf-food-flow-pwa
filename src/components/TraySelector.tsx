import type { components } from '../types/api'

type TrayType = components['schemas']['TrayType']

interface TraySelectorProps {
  trayTypes: TrayType[]
  quantities: Record<string, number>
  onChange: (code: string, quantity: number) => void
}

/**
 * Every tray type shown as a row with a stepper, always visible -- no
 * separate "pick a type, then set quantity" step. Quantity starts at 0
 * for every row; only rows with quantity > 0 get included when the form
 * submits. With 8 fixed types this is short enough to show all at once
 * rather than hiding most of them behind a search or an "add" flow.
 */
export function TraySelector({ trayTypes, quantities, onChange }: TraySelectorProps) {
  return (
    <div class="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
      {trayTypes.map((tray) => {
        const qty = quantities[tray.code] ?? 0
        return (
          <div key={tray.code} class="flex items-center justify-between px-3 py-2">
            <div>
              <div class="text-sm text-neutral-900">{tray.name}</div>
              <div class="text-xs text-neutral-500">{tray.weight_kg} kg each</div>
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                disabled={qty === 0}
                onClick={() => onChange(tray.code, Math.max(0, qty - 1))}
                class="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 disabled:opacity-30"
                aria-label={`Remove one ${tray.name}`}
              >
                −
              </button>
              <span class="w-4 text-center text-sm text-neutral-900">{qty}</span>
              <button
                type="button"
                onClick={() => onChange(tray.code, qty + 1)}
                class="flex h-7 w-7 items-center justify-center rounded-full border border-csf-purple text-csf-purple"
                aria-label={`Add one ${tray.name}`}
              >
                +
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}