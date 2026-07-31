import { RouterProvider } from 'react-router-dom'

import { DesktopBootGate } from '@/app/desktop-boot-gate'
import { ThemeProvider } from '@/app/providers/theme-provider'
import { router } from '@/app/router'
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
        </DesktopBootGate>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
