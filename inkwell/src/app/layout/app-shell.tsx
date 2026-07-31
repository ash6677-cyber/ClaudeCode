import { Outlet } from 'react-router-dom'

import { CommandPalette } from '@/app/command-palette'
import { useUiStore } from '@/stores/ui-store'

import { MobileTopBar } from './mobile-topbar'
import { NavRail } from './nav-rail'

export function AppShell() {
  const focusMode = useUiStore((s) => s.focusMode)

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      {!focusMode && <NavRail />}
      {!focusMode && <MobileTopBar />}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
