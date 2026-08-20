import { Router, Route, route } from 'preact-router'
import { useEffect } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { currentUser, sessionLoading, loadSession } from './store/session'

import { Login } from './pages/Login'
import { AuthVerify } from './pages/AuthVerify'
import { Dashboard } from './pages/Dashboard'
import { WeighIn } from './pages/WeighIn'
import { WeighOut } from './pages/WeighOut'
import { Entries } from './pages/Entries'
import { EntryDetail } from './pages/EntryDetail'
import { ReportsWeekly } from './pages/ReportsWeekly'
import { Sync } from './pages/Sync'
import { Settings } from './pages/Settings'
import { AdminLocations } from './pages/AdminLocations'
import { AdminUsers } from './pages/AdminUsers'
import { NavBar } from './components/NavBar'

function Protected({ children }: { children: ComponentChildren }) {
  useEffect(() => {
    if (!sessionLoading.value && !currentUser.value) {
      route('/login', true)
    }
  }, [sessionLoading.value, currentUser.value])

  if (sessionLoading.value) {
    return (
      <div class="flex min-h-screen items-center justify-center text-neutral-500">Loading…</div>
    )
  }
  if (!currentUser.value) return null
  return <>{children}</>
}

function AdminOnly({ children }: { children: ComponentChildren }) {
  useEffect(() => {
    if (!sessionLoading.value && currentUser.value && currentUser.value.role !== 'ADMIN') {
      route('/', true)
    }
  }, [sessionLoading.value, currentUser.value])

  if (currentUser.value?.role !== 'ADMIN') return null
  return <>{children}</>
}

export function App() {
  useEffect(() => {
    loadSession()
  }, [])

  return (
    <div class="min-h-screen bg-white">
      {currentUser.value && <NavBar />}
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/auth/verify" component={AuthVerify} />
        <Route
          path="/"
          component={() => (
            <Protected>
              <Dashboard />
            </Protected>
          )}
        />
        <Route
          path="/weigh-in"
          component={() => (
            <Protected>
              <WeighIn />
            </Protected>
          )}
        />
        <Route
          path="/weigh-out"
          component={() => (
            <Protected>
              <WeighOut />
            </Protected>
          )}
        />
        <Route
          path="/entries"
          component={() => (
            <Protected>
              <Entries />
            </Protected>
          )}
        />
        <Route
          path="/entries/:entryId"
          component={(props: { entryId?: string }) => (
            <Protected>
              <EntryDetail entryId={props.entryId!} />
            </Protected>
          )}
        />
        <Route
          path="/reports/weekly"
          component={() => (
            <Protected>
              <ReportsWeekly />
            </Protected>
          )}
        />
        <Route
          path="/sync"
          component={() => (
            <Protected>
              <Sync />
            </Protected>
          )}
        />
        <Route
          path="/settings"
          component={() => (
            <Protected>
              <Settings />
            </Protected>
          )}
        />
        <Route
          path="/admin/locations"
          component={() => (
            <Protected>
              <AdminOnly>
                <AdminLocations />
              </AdminOnly>
            </Protected>
          )}
        />
        <Route
          path="/admin/users"
          component={() => (
            <Protected>
              <AdminOnly>
                <AdminUsers />
              </AdminOnly>
            </Protected>
          )}
        />
      </Router>
    </div>
  )
}
