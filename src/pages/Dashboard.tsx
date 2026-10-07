import type { ComponentChildren } from 'preact'
import { Link } from '../components/RouterLink'
import { currentUser } from '../store/session'
import { pendingFor } from '../store/offlineQueue'

const ICON_PROPS = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const
}

function FoodInIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3v10m0 0l-4-4m4 4l4-4" />
      <path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </svg>
  )
}

function FoodOutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 13V3m0 0l-4 4m4-4l4 4" />
      <path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </svg>
  )
}

function EntriesIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 10a8 8 0 0 1 14-5.3M20 14a8 8 0 0 1-14 5.3" />
      <path d="M18 3v5h-5M6 21v-5h5" />
    </svg>
  )
}

/** One Home tile: an icon in a circle, a title, and a short description --
 * bigger and more scannable at a glance than a plain text card, and with a
 * visible pressed state since this is tapped on a touchscreen, not clicked
 * with a mouse. */
function Tile({
  href,
  icon,
  title,
  description
}: {
  href: string
  icon: ComponentChildren
  title: string
  description: ComponentChildren
}) {
  return (
    <Link
      href={href}
      class="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 p-6 text-center transition-colors hover:border-csf-purple active:scale-[0.98] active:bg-csf-purple-light"
    >
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-csf-purple-light text-csf-purple">
        {icon}
      </span>
      <div class="text-xl font-semibold text-neutral-900">{title}</div>
      <div class="text-sm text-neutral-500">{description}</div>
    </Link>
  )
}

export function Dashboard() {
  const role = currentUser.value?.role
  const pending = currentUser.value ? pendingFor(currentUser.value.id).length : 0

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="mb-1 text-xl font-semibold text-neutral-900">
        Hi, {currentUser.value?.name?.split(' ')[0]}
      </h1>
      <p class="mb-6 text-sm text-neutral-500">What would you like to record?</p>

      <div class="dashboard-tile-grid grid grid-cols-2 gap-4">
        <Tile href="/weigh-in" icon={<FoodInIcon />} title="Food In" description="Record surplus arriving" />
        {(role === 'FOOD_CENTRE' || role === 'ADMIN') && (
          <Tile
            href="/weigh-out"
            icon={<FoodOutIcon />}
            title="Food Out"
            description="Record parcels leaving"
          />
        )}
        <Tile
          href="/entries"
          icon={<EntriesIcon />}
          title="Recent Entries"
          description="Review what's logged"
        />
        <Tile
          href="/sync"
          icon={<SyncIcon />}
          title="Sync Status"
          description={pending > 0 ? `${pending} pending` : 'All synced'}
        />
      </div>
    </div>
  )
}
