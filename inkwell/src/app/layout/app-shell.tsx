import { Outlet } from 'react-router-dom'

import { CommandPalette } from '@/app/command-palette'
import { useProjectTheme } from '@/features/theme/lib/use-project-theme'
import { useUiStore } from '@/stores/ui-store'

import { MobileTopBar } from './mobile-topbar'
import { NavRail } from './nav-rail'

export function AppShell() {
  const focusMode = useUiStore((s) => s.focusMode)
  // Here rather than at the app root because it reads the open project out of
  // the URL, and the root sits above the router.
  useProjectTheme()

  return (
    // Sized to the region a person can actually see. `h-dvh` measures the
    // screen including whatever the keyboard is covering, which pushed the
    // wizard's Back and Next buttons underneath it.
    <div className="flex h-[var(--vvh,100dvh)] flex-col overflow-hidden lg:flex-row">
      {!focusMode && <NavRail />}
      {!focusMode && <MobileTopBar />}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
