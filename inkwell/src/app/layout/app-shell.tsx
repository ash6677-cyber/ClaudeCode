import { Outlet } from 'react-router-dom'

import { NavRail } from './nav-rail'

export function AppShell() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <NavRail />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
