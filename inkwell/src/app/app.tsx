import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'

import { AuthBridge } from '@/app/auth-bridge'
import { DesktopBootGate } from '@/app/desktop-boot-gate'
import { DesktopMenuBridge } from '@/app/desktop-menu-bridge'
import { GlobalShortcuts } from '@/app/global-shortcuts'
import { ThemeProvider } from '@/app/providers/theme-provider'
import { router } from '@/app/router'
import { BackupNudge } from '@/components/common/backup-nudge'
import { ImportConfirmDialog } from '@/components/common/import-confirm-dialog'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSyncEditorFont } from '@/lib/editor/use-sync-editor-font'
import { useTrashStore } from '@/stores/trash-store'

export function App() {
  useSyncEditorFont()

  // Sweeps anything that has sat in the bin past its retention window. Done
  // once at boot rather than on a timer: the bin only grows when someone
  // deletes something, and a writer who has not opened the app has not.
  useEffect(() => {
    void useTrashStore.getState().sweepExpired()
  }, [])

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <DesktopBootGate>
          <RouterProvider router={router} />
          <DesktopMenuBridge />
          <GlobalShortcuts />
          <ImportConfirmDialog />
          <BackupNudge />
          <AuthBridge />
        </DesktopBootGate>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
