import { AlertTriangle, Check, CloudOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { SYNCED_TABLES } from '@/lib/sync/sync-engine'
import { cn } from '@/lib/utils'
import { useSyncStore } from '@/stores/sync-store'

function formatLastSynced(millis: number | null): string {
  if (!millis) return 'not yet'
  const seconds = Math.round((Date.now() - millis) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return new Date(millis).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function SyncStatus() {
  const status = useSyncStore((s) => s.status)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const error = useSyncStore((s) => s.error)
  const syncNow = useSyncStore((s) => s.syncNow)

  const [refreshing, setRefreshing] = useState(false)

  async function handleSyncNow() {
    setRefreshing(true)
    try {
      await syncNow()
    } finally {
      setRefreshing(false)
    }
  }

  const busy = status === 'syncing' || status === 'connecting' || refreshing

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Cloud sync</h2>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={handleSyncNow}
          disabled={busy}
        >
          <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} />
          {busy ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 text-sm">
          {status === 'error' ? (
            <AlertTriangle className="size-4 shrink-0 text-warning" />
          ) : status === 'off' ? (
            <CloudOff className="size-4 shrink-0 text-muted-foreground" />
          ) : busy ? (
            <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Check className="size-4 shrink-0 text-success" />
          )}
          <span className="font-medium">
            {status === 'error'
              ? 'Sync problem'
              : status === 'off'
                ? 'Not syncing'
                : busy
                  ? 'Syncing…'
                  : 'Up to date'}
          </span>
          {pendingCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {pendingCount} change{pendingCount === 1 ? '' : 's'} queued
            </span>
          )}
        </div>

        <p className="mt-1.5 text-xs text-muted-foreground">
          {error ?? `Last synced ${formatLastSynced(lastSyncedAt)}.`}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Your projects, chapters, scenes, Almanac, characters, covers, and images sync across every
        device you sign in on ({SYNCED_TABLES.length} record types). When two devices edit the
        same thing, the most recent edit wins.{' '}
        <strong className="font-medium text-foreground">
          AI provider API keys are never uploaded
        </strong>{' '}
        — those stay only on the device where you entered them.
      </p>
    </section>
  )
}
