import { useState } from 'preact/hooks'
import { requestMagicLink } from '../services/api'

export function Login() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await requestMagicLink(email.trim())
    } finally {
      // Always show the same success state -- the API deliberately never
      // reveals whether the email exists, so the UI shouldn't either.
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <h1 class="mb-1 text-2xl font-semibold text-csf-purple">Cambridge Sustainable Food</h1>
        <p class="mb-6 text-neutral-500">Sign in with your email to continue.</p>

        {submitted ? (
          <div class="rounded-lg border border-csf-purple-light bg-csf-purple-light p-4 text-sm text-neutral-700">
            If that email is registered, a sign-in link is on its way. Check your inbox and tap
            the link to continue.
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.org"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-csf-purple"
            />
            <button
              type="submit"
              disabled={loading}
              class="w-full rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
