import { useEffect, useState } from 'preact/hooks'
import { route } from 'preact-router'
import { verifyMagicLink } from '../services/api'
import { currentUser } from '../store/session'

export function AuthVerify() {
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('error')
      return
    }
    verifyMagicLink(token)
      .then(({ user }) => {
        currentUser.value = user
        route('/', true)
      })
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'error') {
    return (
      <div class="flex min-h-screen items-center justify-center px-4">
        <div class="max-w-sm text-center">
          <h1 class="mb-2 text-xl font-semibold text-neutral-900">Link expired or already used</h1>
          <p class="mb-4 text-neutral-500">
            Sign-in links only work once and expire after 15 minutes. Request a new one.
          </p>
          <a href="/login" class="text-csf-purple underline">
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div class="flex min-h-screen items-center justify-center text-neutral-500">Signing you in…</div>
  )
}
