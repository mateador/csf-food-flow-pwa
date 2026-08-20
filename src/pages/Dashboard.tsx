import { Link } from '../components/RouterLink'
import { currentUser } from '../store/session'
import { offlineQueue } from '../store/offlineQueue'

export function Dashboard() {
  const role = currentUser.value?.role
  const pending = offlineQueue.value.length

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">
        Hi, {currentUser.value?.name?.split(' ')[0]}
      </h1>
      <p class="mb-6 text-sm text-neutral-500">What would you like to record?</p>

      <div class="grid grid-cols-2 gap-3">
        <Link
          href="/weigh-in"
          class="rounded-xl border border-neutral-200 p-5 text-center hover:border-csf-purple"
        >
          <div class="text-lg font-medium text-neutral-900">Weigh In</div>
          <div class="text-sm text-neutral-500">Record surplus arriving</div>
        </Link>
        {(role === 'FOOD_CENTRE' || role === 'ADMIN') && (
          <Link
            href="/weigh-out"
            class="rounded-xl border border-neutral-200 p-5 text-center hover:border-csf-purple"
          >
            <div class="text-lg font-medium text-neutral-900">Weigh Out</div>
            <div class="text-sm text-neutral-500">Record parcels leaving</div>
          </Link>
        )}
        <Link
          href="/entries"
          class="rounded-xl border border-neutral-200 p-5 text-center hover:border-csf-purple"
        >
          <div class="text-lg font-medium text-neutral-900">Recent Entries</div>
          <div class="text-sm text-neutral-500">Review what's logged</div>
        </Link>
        <Link
          href="/sync"
          class="rounded-xl border border-neutral-200 p-5 text-center hover:border-csf-purple"
        >
          <div class="text-lg font-medium text-neutral-900">Sync Status</div>
          <div class="text-sm text-neutral-500">
            {pending > 0 ? `${pending} pending` : 'All synced'}
          </div>
        </Link>
      </div>
    </div>
  )
}
