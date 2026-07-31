import { useEffect } from 'react'

import { syncEngine } from '@/lib/sync/sync-engine'
import { startSyncRefreshBridge } from '@/lib/sync/sync-refresh'
import { useAuthStore } from '@/stores/auth-store'
import { useSyncStore } from '@/stores/sync-store'

/**
 * Subscribes to Firebase auth state once at app boot and starts/stops cloud
 * sync to match. Renders nothing.
 */
export function AuthBridge() {
  useEffect(() => useAuthStore.getState().init(), [])
  useEffect(() => useSyncStore.getState().init(), [])
  useEffect(() => startSyncRefreshBridge(), [])

  // Signing in begins syncing this device's library; signing out tears the
  // listeners down and leaves the local copy exactly as it is, so the app
  // keeps working offline-only afterwards.
  useEffect(() => {
    // Covers a restored session that resolved before this subscription was
    // set up; `start()` is a no-op when already running for that uid.
    const current = useAuthStore.getState().user
    if (current) void syncEngine.start(current.uid)

    return useAuthStore.subscribe((state, previous) => {
      if (state.user?.uid === previous.user?.uid) return
      if (state.user) void syncEngine.start(state.user.uid)
      else syncEngine.stop()
    })
  }, [])

  return null
}
