interface PinFieldsProps {
  pin: string
  onPinChange: (value: string) => void
  pinConfirm: string
  onPinConfirmChange: (value: string) => void
  pinLabel?: string
  confirmLabel?: string
  autoFocus?: boolean
}

function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4)
}

const PIN_INPUT_CLASS =
  'w-full rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-csf-purple'

/**
 * The two-field "choose a PIN" shape -- shared by first-time setup, the
 * self-service "change my PIN" form, and the admin PIN reset, so the one
 * piece of UI/validation that actually matters here (two matching 4-digit
 * fields) exists once, not three times.
 */
export function PinFields({
  pin,
  onPinChange,
  pinConfirm,
  onPinConfirmChange,
  pinLabel = 'PIN',
  confirmLabel = 'Confirm PIN',
  autoFocus = false
}: PinFieldsProps) {
  return (
    <>
      <div>
        <label class="mb-1 block text-sm font-medium text-neutral-700">{pinLabel}</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          required
          autoFocus={autoFocus}
          placeholder="0000"
          value={pin}
          onInput={(e) => onPinChange(sanitizeDigits((e.target as HTMLInputElement).value))}
          class={PIN_INPUT_CLASS}
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-neutral-700">{confirmLabel}</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          required
          placeholder="0000"
          value={pinConfirm}
          onInput={(e) => onPinConfirmChange(sanitizeDigits((e.target as HTMLInputElement).value))}
          class={PIN_INPUT_CLASS}
        />
      </div>
    </>
  )
}
