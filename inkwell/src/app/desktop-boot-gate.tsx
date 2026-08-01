import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { isTauriRuntime } from '@/lib/db/tauri-bridge'
import { initTauriDb } from '@/lib/db/tauri-db'

/** Gates rendering until the desktop shell's library file has been read from
 * disk and hydrated into memory. A no-op passthrough in the browser build,
 * where Dexie opens lazily on first query with nothing to wait for. */
export function DesktopBootGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isTauriRuntime())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isTauriRuntime()) return
    initTauriDb()
      .then(() => setReady(true))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong reading your library.')
      })
  }, [])

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-destructive">Could not load your library</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
