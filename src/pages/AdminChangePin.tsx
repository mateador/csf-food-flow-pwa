import { useEffect, useState } from 'preact/hooks'
import { route } from 'preact-router'
import { listUsers, resetUserPin, ApiError } from '../services/api'
import { PinFields } from '../components/PinFields'
import type { components } from '../types/api'

type User = components['schemas']['User']

interface AdminChangePinProps {
  userId: string
}

/**
 * Admin recovery path for a forgotten PIN -- no current-PIN check, since
 * the whole point is the admin doesn't know the old one (see
 * PATCH /users/{id}/pin). There's no GET /users/{id}, so the target
 * user's details come from the same list-and-filter pattern EntryDetail
 * already uses, not a dedicated fetch.
 */
export function AdminChangePin({ userId }: AdminChangePinProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    listUsers()
      .then((users) => setUser(users.find((u) => u.id === userId) ?? null))
      .finally(() => setLoadingUser(false))
  }, [userId])

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (pin.length !== 4 || pinConfirm.length !== 4) return
    if (pin !== pinConfirm) {
      setError("PINs don't match.")
      return
    }
    setSubmitting(true)
    try {
      await resetUserPin(userId, pin, pinConfirm)
      setSuccess(true)
      setPin('')
      setPinConfirm('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset this PIN. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div class="mx-auto max-w-sm px-4 py-8">
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">Change PIN</h1>
      <p class="mb-6 text-sm text-neutral-500">
        Sets a new PIN for this user immediately -- their current one stops working.
      </p>

      {loadingUser && <p class="text-neutral-500">Loading…</p>}
      {!loadingUser && !user && <p class="text-red-600">Couldn't find that user.</p>}

      {user && (
        <>
          {error && (
            <div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
          {success && (
            <div class="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              PIN changed for {user.name}.
            </div>
          )}
          <form onSubmit={handleSubmit} class="space-y-3">
            <div>
              <label class="mb-1 block text-sm font-medium text-neutral-700">Email</label>
              <input
                type="email"
                disabled
                value={user.email}
                class="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-neutral-500"
              />
            </div>
            <PinFields
              pin={pin}
              onPinChange={setPin}
              pinConfirm={pinConfirm}
              onPinConfirmChange={setPinConfirm}
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting || pin.length !== 4 || pinConfirm.length !== 4}
              class="w-full rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Set new PIN'}
            </button>
            <button
              type="button"
              onClick={() => route('/admin/users', true)}
              class="w-full text-center text-sm text-neutral-500 underline"
            >
              Back to Users
            </button>
          </form>
        </>
      )}
    </div>
  )
}
