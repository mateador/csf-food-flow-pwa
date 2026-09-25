import { currentUser, sessionOffline } from '../store/session'
import { syncThenSignOut } from '../store/autoSync'

/**
 * Shown at the top of the weigh forms. On a shared hub tablet the most
 * likely mistake is recording under the previous volunteer's name, so the
 * name is always visible and switching person is one tap away.
 */
export function RecordingAs() {
  const user = currentUser.value
  if (!user) return null

  return (
    <div class="mb-4 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700">
      <div class="flex items-center justify-between gap-3">
        <span>
          Recording as <span class="font-medium text-neutral-900">{user.name}</span>
        </span>
        <button
          type="button"
          onClick={() => void syncThenSignOut()}
          class="text-csf-purple underline"
        >
          Not you? Sign out
        </button>
      </div>
      {sessionOffline.value && (
        <p class="mt-1 text-xs text-amber-700">
          No connection -- entries are saved on this device and upload when it's back.
        </p>
      )}
    </div>
  )
}