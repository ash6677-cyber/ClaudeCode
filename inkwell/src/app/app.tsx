import { RouterProvider } from 'react-router-dom'

import { AuthBridge } from '@/app/auth-bridge'
import { DesktopBootGate } from '@/app/desktop-boot-gate'
import { DesktopMenuBridge } from '@/app/desktop-menu-bridge'
import { ThemeProvider } from '@/app/providers/theme-provider'
import { router } from '@/app/router'
import { ImportConfirmDialog } from '@/components/common/import-confirm-dialog'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSyncEditorFont } from '@/lib/editor/use-sync-editor-font'

export function App() {
  useSyncEditorFont()
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <DesktopBootGate>
          <RouterProvider router={router} />
          <DesktopMenuBridge />
          <ImportConfirmDialog />
          <AuthBridge />
        </DesktopBootGate>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
