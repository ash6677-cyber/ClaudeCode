import { RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { BIN_RETENTION_DAYS, useTrashStore, type BinEntry } from '@/stores/trash-store'

function whenBinned(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function TrashSettings() {
  const entries = useTrashStore((s) => s.entries)
  const status = useTrashStore((s) => s.status)
  const fetchBin = useTrashStore((s) => s.fetchBin)
  const restore = useTrashStore((s) => s.restore)
  const purge = useTrashStore((s) => s.purge)
  const emptyBin = useTrashStore((s) => s.emptyBin)
  const { toast } = useToast()

  const [purging, setPurging] = useState<BinEntry | null>(null)
  const [emptying, setEmptying] = useState(false)

  useEffect(() => {
    void fetchBin()
  }, [fetchBin])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Recently deleted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anything you delete is kept here for {BIN_RETENTION_DAYS} days. Restoring a project or a
            chapter brings back everything that was inside it.
          </p>
        </div>
        {entries.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive"
            onClick={() => setEmptying(true)}
          >
            <Trash2 className="size-3.5" /> Empty
          </Button>
        )}
      </div>

      {status === 'loading' && entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">Nothing deleted recently.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li
              key={`${entry.table}:${entry.id}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.kind} · {whenBinned(entry.deletedAt)}
                  {entry.alsoBinned > 0 &&
                    ` · with ${entry.alsoBinned} ${entry.alsoBinned === 1 ? 'item' : 'items'} inside`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                // Named, because this panel also carries "Restore from file…"
                // for whole-library backups. Two buttons reading just
                // "Restore" a few centimetres apart, one of which replaces
                // the entire library, is not a distinction to leave to
                // context — least of all to a screen reader.
                aria-label={`Restore ${entry.name}`}
                onClick={async () => {
                  await restore(entry)
                  toast({ title: `Restored “${entry.name}”` })
                }}
              >
                <RotateCcw className="size-3.5" /> Restore
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                aria-label={`Delete ${entry.name} permanently`}
                onClick={() => setPurging(entry)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={purging !== null}
        onOpenChange={(open) => !open && setPurging(null)}
        title={`Permanently delete “${purging?.name ?? ''}”?`}
        description={
          purging && purging.alsoBinned > 0
            ? `This removes it and the ${purging.alsoBinned} items inside it for good. There is no way back.`
            : 'This removes it for good. There is no way back.'
        }
        confirmLabel="Delete for good"
        onConfirm={async () => {
          if (!purging) return
          await purge(purging)
          setPurging(null)
        }}
      />

      <ConfirmDeleteDialog
        open={emptying}
        onOpenChange={setEmptying}
        title="Empty the bin?"
        description="Everything in here is removed for good, including anything inside it. There is no way back."
        confirmLabel="Empty the bin"
        onConfirm={async () => {
          await emptyBin()
          setEmptying(false)
        }}
      />
    </section>
  )
}
