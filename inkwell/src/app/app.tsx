import { RouterProvider } from 'react-router-dom'

import { ThemeProvider } from '@/app/providers/theme-provider'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
