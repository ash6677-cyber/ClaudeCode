import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'
import { registerServiceWorker, requestPersistentStorage } from '@/lib/storage/durability'
import { trackViewport } from '@/lib/viewport'

import './index.css'

// Asked before anything is written, so the very first project is already
// covered rather than being the one left at risk.
void requestPersistentStorage()
registerServiceWorker()

// Before the first render, so the shell is sized to the visible screen from
// the outset rather than laying out against the full height and correcting.
trackViewport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
