import { Link } from './RouterLink'
import { currentUser } from '../store/session'
import { offlineQueue } from '../store/offlineQueue'

export function NavBar() {
  const role = currentUser.value?.role
  const pendingCount = offlineQueue.value.length

  return (
    <nav class="border-b border-neutral-200 bg-white px-4 py-3">
      <div class="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" class="text-lg font-semibold text-csf-purple">
          CSF
        </Link>
        <div class="flex items-center gap-4 text-sm">
          <Link href="/weigh-in" class="text-neutral-600 hover:text-csf-purple">
            Weigh In
          </Link>
          {(role === 'FOOD_CENTRE' || role === 'ADMIN') && (
            <Link href="/weigh-out" class="text-neutral-600 hover:text-csf-purple">
              Weigh Out
            </Link>
          )}
          <Link href="/entries" class="text-neutral-600 hover:text-csf-purple">
            Entries
          </Link>
          <Link href="/reports/weekly" class="text-neutral-600 hover:text-csf-purple">
            Reports
          </Link>
          <Link href="/sync" class="relative text-neutral-600 hover:text-csf-purple">
            Sync
            {pendingCount > 0 && (
              <span class="absolute -right-3 -top-2 rounded-full bg-csf-purple px-1.5 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </Link>
          {role === 'ADMIN' && (
            <Link href="/admin/locations" class="text-neutral-600 hover:text-csf-purple">
              Admin
            </Link>
          )}
          <Link href="/settings" class="text-neutral-600 hover:text-csf-purple">
            {currentUser.value?.name}
          </Link>
        </div>
      </div>
    </nav>
  )
}
