import { useState } from 'preact/hooks'
import { route } from 'preact-router'
import { verifyMagicLink, ApiError } from '../services/api'
import { currentUser } from '../store/session'

export function AuthVerify() {
  const [status, setStatus] = useState('ready') // 'ready' | 'verifying' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const token = new URLSearchParams(window.location.search).get('token')

  async function handleConfirm() {
    if (!token) return
    setStatus('verifying')
    try {
      const { user } = await verifyMagicLink(token)
      currentUser.value = user
      route('/', true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_USED') {
        setErrorMessage('This link has already been used — each sign-in link only works once.')
      } else if (err instanceof ApiError && err.code === 'EXPIRED') {
        setErrorMessage('This link has expired. Request a new one below.')
      } else {
        setErrorMessage('Link expired or already used. Request a new one below.')
      }
      setStatus('error')
    }
  }

  if (!token || status === 'error') {
    return (
      <div class="flex min-h-screen items-center justify-center px-4">
        <div class="max-w-sm text-center">
          <h1 class="mb-2 text-xl font-semibold text-neutral-900">
            {!token ? 'Missing sign-in link' : 'Sign-in failed'}
          </h1>
          <p class="mb-4 text-neutral-500">
            {!token
              ? 'This page needs a sign-in link to work — open the link from your email again.'
              : errorMessage}
          </p>
          <a href="/login" class="text-csf-purple underline">
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  if (status === 'verifying') {
    return (
      <div class="flex min-h-screen items-center justify-center text-neutral-500">
        Signing you in…
      </div>
    )
  }

  return (
    <div class="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <p class="text-neutral-600">Tap below to finish signing in.</p>
      <button
        onClick={handleConfirm}
        class="rounded-lg bg-csf-purple px-6 py-3 font-medium text-white"
      >
        Confirm sign-in
      </button>
    </div>
  )
}
