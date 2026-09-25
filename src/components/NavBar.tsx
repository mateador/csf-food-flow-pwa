import { useState } from 'preact/hooks'
import { Link } from './RouterLink'
import { currentUser } from '../store/session'
import { pendingFor } from '../store/offlineQueue'

export function NavBar() {
  const role = currentUser.value?.role
  // Only this person's waiting entries -- on a shared tablet, other
  // volunteers' entries aren't theirs to upload.
  const pendingCount = currentUser.value ? pendingFor(currentUser.value.id).length : 0
  const [menuOpen, setMenuOpen] = useState(false)

  // Single source of truth for the link list -- rendered two different
  // ways below (horizontal row on desktop, stacked list on mobile)
  // rather than forcing one block of markup to serve both layouts via
  // mixed responsive classes, which gets fragile fast once a badge is
  // involved.
  const navItems = [
    { href: '/weigh-in', label: 'Food In', show: true },
    { href: '/weigh-out', label: 'Food Out', show: role === 'FOOD_CENTRE' || role === 'ADMIN' },
    { href: '/entries', label: 'Entries', show: true },
    { href: '/reports/weekly', label: 'Reports', show: true },
    { href: '/sync', label: 'Sync', show: true, badge: pendingCount > 0 ? pendingCount : undefined },
    { href: '/admin/locations', label: 'Admin', show: role === 'ADMIN' },
    { href: '/settings', label: currentUser.value?.name, show: true }
  ].filter((item) => item.show)

  return (
    <nav class="border-b border-neutral-200 bg-white px-4 py-3">
      <div class="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" onClick={() => setMenuOpen(false)} class="text-lg font-semibold text-csf-purple">
          CSF
        </Link>

        {/* Desktop: unchanged horizontal row, just now explicitly hidden
            below the md breakpoint instead of always rendering and
            squeezing/wrapping on narrow viewports. */}
        <div class="hidden items-center gap-4 text-sm md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} class="relative text-neutral-600 hover:text-csf-purple">
              {item.label}
              {item.badge !== undefined && (
                <span class="absolute -right-3 -top-2 rounded-full bg-csf-purple px-1.5 text-[10px] text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Mobile: hamburger toggle, only rendered below md */}
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile: stacked panel, same link list, closes itself on tap so
          it never lingers open after navigating. */}
      {menuOpen && (
        <div class="mx-auto mt-3 max-w-3xl border-t border-neutral-100 pt-2 text-sm md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              class="flex items-center justify-between rounded-lg px-2 py-2.5 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100"
            >
              {item.label}
              {item.badge !== undefined && (
                <span class="rounded-full bg-csf-purple px-1.5 py-0.5 text-[10px] text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}