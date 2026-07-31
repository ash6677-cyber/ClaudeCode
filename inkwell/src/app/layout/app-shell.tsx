import { Outlet } from 'react-router-dom'

import { CommandPalette } from '@/app/command-palette'
import { useUiStore } from '@/stores/ui-store'

import { NavRail } from './nav-rail'

export function AppShell() {
  const focusMode = useUiStore((s) => s.focusMode)

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {!focusMode && <NavRail />}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
