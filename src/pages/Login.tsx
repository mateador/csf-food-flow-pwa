import { useState } from 'preact/hooks'
import { route } from 'preact-router'
import { requestLoginCode, verifyLoginCode, ApiError, isUnreachable } from '../services/api'
import { signedIn, signInNotice } from '../store/session'
import { requestSync } from '../store/autoSync'

const NO_CONNECTION = 'No connection. Signing in needs a connection -- try again when you have signal.'

/**
 * Two-step flow on a single page/route, not a separate page a link
 * lands on. Requesting the code and entering it always happen in the
 * same tab the person is already looking at -- there's no second
 * browser context (email client, WebView, a different device) that can
 * end up authenticated instead of this one, which was the actual root
 * cause of every cross-device/cross-browser bug the old magic-link flow
 * had.
 */
export function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRequestCode = async (e: Event) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await requestLoginCode(email.trim())
      setStep('code')
    } catch (err) {
      if (isUnreachable(err)) {
        // No code can have been sent, so don't send them to wait for one.
        setError(NO_CONNECTION)
      } else {
        // Any answer from the server moves on to the code step -- the API
        // deliberately never reveals whether the email exists, so the UI
        // shouldn't either.
        setStep('code')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: Event) => {
    e.preventDefault()
    if (code.trim().length !== 4) return
    setLoading(true)
    setError('')
    try {
      const { user } = await verifyLoginCode(email.trim(), code.trim())
      signedIn(user)
      // Upload anything this person recorded here while signed out.
      void requestSync()
      route('/', true)
    } catch (err) {
      if (isUnreachable(err)) {
        setError(NO_CONNECTION)
        return // keep the code -- it's still valid
      }
      if (err instanceof ApiError && err.code === 'TOO_MANY_ATTEMPTS') {
        setError('Too many incorrect attempts. Request a new code below.')
      } else if (err instanceof ApiError && err.code === 'EXPIRED') {
        setError('This code has expired. Request a new one below.')
      } else {
        setError('Incorrect code. Try again.')
      }
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <h1 class="mb-1 text-2xl font-semibold text-csf-purple">Cambridge Sustainable Food</h1>

        {step === 'email' ? (
          <>
            <p class="mb-6 text-neutral-500">Sign in with your email to continue.</p>
            {signInNotice.value && (
              <div class="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {signInNotice.value}
              </div>
            )}
            {error && (
              <div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <form onSubmit={handleRequestCode} class="space-y-3">
              <input
                type="email"
                required
                autoFocus
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
                {loading ? 'Sending…' : 'Send code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p class="mb-6 text-neutral-500">
              If that email is registered, a 4-digit code is on its way. Enter it below --
              you can read it on any device, then type it in right here.
            </p>
            {error && (
              <div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <form onSubmit={handleVerifyCode} class="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                required
                autoFocus
                placeholder="0000"
                value={code}
                onInput={(e) =>
                  setCode((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))
                }
                class="w-full rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-csf-purple"
              />
              <button
                type="submit"
                disabled={loading || code.length !== 4}
                class="w-full rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Checking…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError('')
                }}
                class="w-full text-center text-sm text-neutral-500 underline"
              >
                Use a different email
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}