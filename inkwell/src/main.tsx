import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'
import { registerServiceWorker, requestPersistentStorage } from '@/lib/storage/durability'

import './index.css'

// Asked before anything is written, so the very first project is already
// covered rather than being the one left at risk.
void requestPersistentStorage()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
