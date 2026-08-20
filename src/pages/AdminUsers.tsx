import { useEffect, useState } from 'preact/hooks'
import type { components } from '../types/api'

type User = components['schemas']['User']

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // services/api.ts doesn't have a listUsers() helper yet -- GET
    // /users is live on the API (ADMIN-only, verified working) but wasn't
    // wired into the typed client during this pass. Direct fetch here as
    // an interim measure, same credentials:'include' requirement as the
    // rest of the app.
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/users/`, {
      credentials: 'include'
    })
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(setUsers)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="mb-6 text-xl font-semibold text-neutral-900">Users</h1>
      {loading && <p class="text-neutral-500">Loading…</p>}
      {error && <p class="text-red-600">Couldn't load users.</p>}
      <div class="space-y-2">
        {users.map((u) => (
          <div key={u.id} class="rounded-lg border border-neutral-200 px-4 py-3">
            <div class="font-medium text-neutral-900">{u.name}</div>
            <div class="text-sm text-neutral-500">
              {u.email} · {u.role}
            </div>
          </div>
        ))}
      </div>
      <p class="mt-6 text-sm text-neutral-400">
        Create/edit forms are a follow-up -- POST /users and PATCH /users/&#123;id&#125; are
        already live on the API.
      </p>
    </div>
  )
}
