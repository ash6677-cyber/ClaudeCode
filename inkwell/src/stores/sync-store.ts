import { create } from 'zustand'

import { syncEngine, type SyncSnapshot } from '@/lib/sync/sync-engine'

interface SyncState extends SyncSnapshot {
  /** Mirrors the engine's status into React. Returns an unsubscribe. */
  init: () => () => void
  syncNow: () => Promise<void>
}

export const useSyncStore = create<SyncState>((set) => ({
  ...syncEngine.getSnapshot(),

  init: () =>
    syncEngine.subscribe((snapshot) => {
      set(snapshot)
    }),

  syncNow: () => syncEngine.syncNow(),
}))
