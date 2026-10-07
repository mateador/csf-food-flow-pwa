import { useState } from 'preact/hooks'
import { currentUser } from '../store/session'
import { syncThenSignOut } from '../store/autoSync'
import { pendingFor } from '../store/offlineQueue'
import { changeMyPin, ApiError } from '../services/api'
import { PinFields } from '../components/PinFields'
import {
  highContrast,
  setHighContrast,
  textSize,
  setTextSize,
  darkMode,
  setDarkMode,
  type TextSize
} from '../store/theme'

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' }
]

export function Settings() {
  const user = currentUser.value

  const [signingOut, setSigningOut] = useState(false)
  const waiting = user ? pendingFor(user.id).length : 0

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [changingPin, setChangingPin] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinChanged, setPinChanged] = useState(false)

  const handleChangePin = async (e: Event) => {
    e.preventDefault()
    setPinError('')
    setPinChanged(false)
    if (currentPin.length !== 4 || newPin.length !== 4) return
    if (newPin !== newPinConfirm) {
      setPinError("New PINs don't match.")
      return
    }
    setChangingPin(true)
    try {
      await changeMyPin(currentPin, newPin, newPinConfirm)
      setPinChanged(true)
      setCurrentPin('')
      setNewPin('')
      setNewPinConfirm('')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_PIN') {
        setPinError('Current PIN is incorrect.')
      } else {
        setPinError('Could not change your PIN. Try again.')
      }
    } finally {
      setChangingPin(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    // Uploads this person's waiting entries first, then expires the session
    // cookie on the server -- clearing local state alone would leave the
    // cookie valid, and on a shared tablet the next volunteer would be
    // signed in as this one.
    await syncThenSignOut()
  }

  return (
    <div class="mx-auto max-w-sm px-4 py-8">
      <h1 class="mb-6 text-xl font-semibold text-neutral-900">Settings</h1>

      <div class="mb-6 space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
        <div class="flex justify-between">
          <span class="text-neutral-500">Name</span>
          <span class="text-neutral-900">{user?.name}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-500">Email</span>
          <span class="text-neutral-900">{user?.email}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-500">Role</span>
          <span class="text-neutral-900">{user?.role}</span>
        </div>
      </div>

      <div class="mb-6 rounded-lg border border-neutral-200 p-4">
        <p class="mb-3 text-sm font-medium text-neutral-900">Change my PIN</p>
        {pinError && (
          <div class="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">{pinError}</div>
        )}
        {pinChanged && (
          <div class="mb-3 rounded-lg bg-green-50 p-2 text-xs text-green-800">PIN changed.</div>
        )}
        <form onSubmit={handleChangePin} class="space-y-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-neutral-700">Current PIN</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              required
              placeholder="0000"
              value={currentPin}
              onInput={(e) =>
                setCurrentPin((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))
              }
              class="w-full rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-csf-purple"
            />
          </div>
          <PinFields
            pin={newPin}
            onPinChange={setNewPin}
            pinConfirm={newPinConfirm}
            onPinConfirmChange={setNewPinConfirm}
            pinLabel="New PIN"
            confirmLabel="Confirm new PIN"
          />
          <button
            type="submit"
            disabled={
              changingPin || currentPin.length !== 4 || newPin.length !== 4 || newPinConfirm.length !== 4
            }
            class="w-full rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {changingPin ? 'Changing…' : 'Change PIN'}
          </button>
        </form>
      </div>

      <div class="mb-3 flex items-center justify-between rounded-lg border border-neutral-200 p-4">
        <div>
          <p class="text-sm font-medium text-neutral-900">High contrast</p>
          <p class="text-xs text-neutral-500">Darker text and borders, easier to read in bright light.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={highContrast.value}
          onClick={() => setHighContrast(!highContrast.value)}
          class={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            highContrast.value ? 'bg-csf-purple' : 'bg-neutral-300'
          }`}
        >
          <span
            class={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${
              highContrast.value ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div class="mb-3 flex items-center justify-between rounded-lg border border-neutral-200 p-4">
        <div>
          <p class="text-sm font-medium text-neutral-900">Dark mode</p>
          <p class="text-xs text-neutral-500">A dark theme for low light -- stays on for this device only.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={darkMode.value}
          onClick={() => setDarkMode(!darkMode.value)}
          class={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            darkMode.value ? 'bg-csf-purple' : 'bg-neutral-300'
          }`}
        >
          <span
            class={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${
              darkMode.value ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div class="mb-6 rounded-lg border border-neutral-200 p-4">
        <p class="text-sm font-medium text-neutral-900">Text size</p>
        <p class="mb-3 text-xs text-neutral-500">
          Bigger text and buttons throughout the app -- stays on this device only.
        </p>
        <div class="grid grid-cols-3 gap-2" role="group" aria-label="Text size">
          {TEXT_SIZE_OPTIONS.map((option) => {
            const isSelected = textSize.value === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setTextSize(option.value)}
                class={
                  isSelected
                    ? 'rounded-lg border-2 border-csf-purple bg-csf-purple px-2 py-2 text-center text-sm font-medium text-white active:scale-[0.98]'
                    : 'rounded-lg border-2 border-neutral-200 bg-white px-2 py-2 text-center text-sm text-neutral-700 active:scale-[0.98]'
                }
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div class="mb-6 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <p class="mb-2 font-medium text-neutral-900">Install this app</p>
        <p>
          On Android/Chrome, use the browser menu → "Add to Home screen". On iPhone/Safari, tap
          Share → "Add to Home Screen".
        </p>
      </div>

      {waiting > 0 && (
        <p class="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          You have {waiting} {waiting === 1 ? 'entry' : 'entries'} waiting to upload. Signing out
          tries to upload {waiting === 1 ? 'it' : 'them'} first; anything that can't go now uploads
          the next time you sign in on this device.
        </p>
      )}

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        class="w-full rounded-lg border border-neutral-300 px-4 py-2 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}