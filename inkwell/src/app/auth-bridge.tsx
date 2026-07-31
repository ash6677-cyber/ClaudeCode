import { useEffect } from 'react'

import { useAuthStore } from '@/stores/auth-store'

/** Subscribes to Firebase auth state once at app boot. Renders nothing. */
export function AuthBridge() {
  useEffect(() => useAuthStore.getState().init(), [])
  return null
}
