import {
  AlertTriangle,
  Database,
  Download,
  FolderOpen,
  History,
  Loader2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { exportLibraryToFile, listLibraryBackups, restoreFromBackup } from '@/lib/db/tauri-db'
import { isTauriRuntime } from '@/lib/db/tauri-bridge'
import type { BackupInfo } from '@/lib/db/tauri-bridge'
import { useImportStore } from '@/stores/import-store'

function formatBackupDate(millis: number): string {
  return new Date(millis).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DataSettings() {
  const { toast } = useToast()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<BackupInfo | null>(null)
  const [restoring, setRestoring] = useState(false)
  const setPendingImportPath = useImportStore((s) => s.setPendingPath)

  const desktop = isTauriRuntime()

  const refreshBackups = useCallback(async () => {
    setLoadingBackups(true)
    try {
      const list = await listLibraryBackups()
      setBackups(list)
    } catch {
      toast({ title: 'Could not read backups', variant: 'destructive' })
    } finally {
      setLoadingBackups(false)
    }
  }, [toast])

  useEffect(() => {
    if (!desktop) return
    // Fetching the backup list from disk on mount is a genuine external-system
    // read, not derived state — the canonical valid use of this pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshBackups()
  }, [desktop, refreshBackups])

  async function handleExport() {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const path = await save({
      title: 'Export INKWELL library',
      defaultPath: `inkwell-library-${new Date().toISOString().slice(0, 10)}.inkwell`,
      filters: [{ name: 'INKWELL library', extensions: ['inkwell', 'json'] }],
    })
    if (!path) return
    setExporting(true)
    try {
      await exportLibraryToFile(path)
      toast({ title: 'Library exported', description: path })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  async function handleChooseImport() {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const path = await open({
      title: 'Import INKWELL library',
      multiple: false,
      filters: [{ name: 'INKWELL library', extensions: ['inkwell', 'json'] }],
    })
    if (!path || Array.isArray(path)) return
    setPendingImportPath(path)
  }

  async function handleConfirmRestore() {
    if (!pendingRestore) return
    setRestoring(true)
    try {
      await restoreFromBackup(pendingRestore.filename)
      toast({ title: 'Backup restored', description: 'Reloading…' })
      window.location.reload()
    } catch {
      toast({ title: 'Restore failed', variant: 'destructive' })
      setRestoring(false)
      setPendingRestore(null)
    }
  }

  if (!desktop) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Database className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-medium">Export, import, and backups</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Available in the INKWELL desktop app, where your library lives on disk instead of in
          browser storage.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold">Storage location</h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen className="size-3.5" />
          <code className="rounded bg-muted px-1.5 py-0.5">%APPDATA%\INKWELL\library.json</code>
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Export &amp; import</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Export your whole library — every project, chapter, character, and setting — to a
          single portable file, or import one to replace what's here now.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Export library…
          </Button>
          <Button size="sm" variant="outline" onClick={handleChooseImport} className="gap-1.5">
            <Upload className="size-3.5" />
            Import library…
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Backups</h2>
          <Button size="sm" variant="ghost" onClick={refreshBackups} disabled={loadingBackups} className="h-7 text-xs">
            {loadingBackups ? <Loader2 className="size-3.5 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A backup is taken automatically before the first save each session, and before any
          import or restore. The most recent 20 are kept.
        </p>
        {backups.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No backups yet — one is created the first time you save.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <History className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{formatBackupDate(backup.createdAt)}</span>
                  <span className="shrink-0 text-muted-foreground">{formatSize(backup.size)}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => setPendingRestore(backup)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={pendingRestore !== null} onOpenChange={(open) => !open && setPendingRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" /> Restore this backup?
            </DialogTitle>
            <DialogDescription>
              {pendingRestore && (
                <>
                  This replaces your current library with the backup from{' '}
                  {formatBackupDate(pendingRestore.createdAt)}. Your current library is backed up
                  first, so this can be undone too.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRestore(null)} disabled={restoring}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRestore} disabled={restoring} className="gap-1.5">
              {restoring && <Loader2 className="size-3.5 animate-spin" />}
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
