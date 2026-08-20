import { currentUser, clearSession } from '../store/session'
import { route } from 'preact-router'

export function Settings() {
  const user = currentUser.value

  const handleSignOut = () => {
    // No server-side sign-out endpoint is in the V1 contract (no DELETE
    // /me/session or similar) -- clearing local state is enough for now
    // since the httpOnly cookie simply expires after ACCESS_TOKEN_TTL.
    // A real "sign out everywhere" would need a server-side revoke list,
    // worth flagging as a V2 gap rather than pretending this fully signs
    // the session out server-side.
    clearSession()
    route('/login', true)
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

      <div class="mb-6 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <p class="mb-2 font-medium text-neutral-900">Install this app</p>
        <p>
          On Android/Chrome, use the browser menu → "Add to Home screen". On iPhone/Safari, tap
          Share → "Add to Home Screen".
        </p>
      </div>

      <button
        onClick={handleSignOut}
        class="w-full rounded-lg border border-neutral-300 px-4 py-2 text-neutral-700 hover:bg-neutral-50"
      >
        Sign out
      </button>
    </div>
  )
}
