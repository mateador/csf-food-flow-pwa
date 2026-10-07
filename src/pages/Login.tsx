import { useState } from 'preact/hooks'
import { route } from 'preact-router'
import { checkPinStatus, setPin as apiSetPin, loginWithPin, ApiError, isUnreachable } from '../services/api'
import { signedIn, signInNotice } from '../store/session'
import { requestSync } from '../store/autoSync'
import { PinFields } from '../components/PinFields'

const NO_CONNECTION = 'No connection. Signing in needs a connection -- try again when you have signal.'

/**
 * Three-step flow on a single page/route: email, then either "choose a
 * PIN" (first sign-in ever) or "enter your PIN" (every time after),
 * decided by /auth/pin/check once the email is submitted. Same
 * single-tab reasoning as the emailed-code flow this replaced (still
 * available server-side, just not wired up here -- see services/api.ts):
 * everything happens in the tab the person is already looking at, no
 * second browser context that could end up authenticated instead.
 */
export function Login() {
  const [step, setStep] = useState<'email' | 'setup' | 'login'>('email')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const finishSignIn = (user: Parameters<typeof signedIn>[0]) => {
    signedIn(user)
    // Upload anything this person recorded here while signed out.
    void requestSync()
    route('/', true)
  }

  const handleContinue = async (e: Event) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const { needs_setup } = await checkPinStatus(email.trim())
      setStep(needs_setup ? 'setup' : 'login')
    } catch (err) {
      if (isUnreachable(err)) {
        setError(NO_CONNECTION)
      } else {
        // Same fallback either way -- don't let a server error reveal
        // anything about whether the email exists.
        setStep('login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSetPin = async (e: Event) => {
    e.preventDefault()
    if (pin.length !== 4) return
    if (pin !== pinConfirm) {
      setError("PINs don't match. Try again.")
      return
    }
    setLoading(true)
    setError('')
    try {
      const { user } = await apiSetPin(email.trim(), pin, pinConfirm)
      finishSignIn(user)
    } catch (err) {
      if (isUnreachable(err)) {
        setError(NO_CONNECTION)
        return
      }
      if (err instanceof ApiError && err.code === 'PIN_ALREADY_SET') {
        setError('This account already has a PIN -- enter it below instead.')
        setStep('login')
        setPin('')
        setPinConfirm('')
        return
      }
      setError('Could not set your PIN. Try again.')
      setPin('')
      setPinConfirm('')
    } finally {
      setLoading(false)
    }
  }

  const handleLoginWithPin = async (e: Event) => {
    e.preventDefault()
    if (pin.length !== 4) return
    setLoading(true)
    setError('')
    try {
      const { user } = await loginWithPin(email.trim(), pin)
      finishSignIn(user)
    } catch (err) {
      if (isUnreachable(err)) {
        setError(NO_CONNECTION)
        return // keep the PIN -- it's still valid
      }
      setError('Incorrect email or PIN.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const backToEmail = () => {
    setStep('email')
    setPin('')
    setPinConfirm('')
    setError('')
  }

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <h1 class="mb-1 text-2xl font-semibold text-csf-purple">Cambridge Sustainable Food</h1>

        {step === 'email' && (
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
            <form onSubmit={handleContinue} class="space-y-3">
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
                {loading ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'setup' && (
          <>
            <p class="mb-6 text-neutral-500">
              First time signing in -- choose a 4-digit PIN. You'll use it to sign in on this and
              other devices from now on.
            </p>
            {error && (
              <div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <form onSubmit={handleSetPin} class="space-y-3">
              <PinFields
                pin={pin}
                onPinChange={setPin}
                pinConfirm={pinConfirm}
                onPinConfirmChange={setPinConfirm}
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || pin.length !== 4 || pinConfirm.length !== 4}
                class="w-full rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Choose PIN and sign in'}
              </button>
              <button
                type="button"
                onClick={backToEmail}
                class="w-full text-center text-sm text-neutral-500 underline"
              >
                Use a different email
              </button>
            </form>
          </>
        )}

        {step === 'login' && (
          <>
            <p class="mb-6 text-neutral-500">Enter your 4-digit PIN.</p>
            {error && (
              <div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <form onSubmit={handleLoginWithPin} class="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                required
                autoFocus
                placeholder="0000"
                value={pin}
                onInput={(e) =>
                  setPin((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))
                }
                class="w-full rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-csf-purple"
              />
              <button
                type="submit"
                disabled={loading || pin.length !== 4}
                class="w-full rounded-lg bg-csf-purple px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Checking…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={backToEmail}
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
