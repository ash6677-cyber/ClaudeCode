import { Download, HardDrive, Loader2, ShieldAlert, ShieldCheck, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
import {
  exportLibraryBlob,
  importLibraryDocument,
  libraryFilename,
} from '@/lib/db/web-library'
import {
  isEvictionProne,
  isInstalled,
  requestPersistentStorage,
  storageEstimate,
  type PersistState,
} from '@/lib/storage/durability'
import { usePreferencesStore } from '@/stores/preferences-store'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(millis: number | null): string {
  if (!millis) return 'never'
  const days = Math.floor((Date.now() - millis) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/**
 * Storage durability and whole-library backup for the browser build.
 *
 * The desktop app keeps its library in a real file and takes its own
 * backups; in a browser the same data sits in IndexedDB, which the browser
 * is entitled to delete — and which iOS Safari deletes on a timer for sites
 * that have not been installed. This is where that risk is made visible and
 * where the user can get their work out.
 */
export function StorageHealth() {
  const { toast } = useToast()
  const lastBackupAt = usePreferencesStore((s) => s.lastBackupAt)
  const markBackedUp = usePreferencesStore((s) => s.markBackedUp)

  const [persist, setPersist] = useState<PersistState | null>(null)
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [pending, setPending] = useState<{ raw: string; name: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [state, estimate] = await Promise.all([requestPersistentStorage(), storageEstimate()])
      if (cancelled) return
      setPersist(state)
      setUsage(estimate)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const installed = isInstalled()
  const atRisk = isEvictionProne()

  async function handleExport() {
    setBusy('export')
    try {
      const blob = await exportLibraryBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = libraryFilename()
      a.click()
      URL.revokeObjectURL(url)
      markBackedUp()
      toast({ title: 'Library exported', description: formatSize(blob.size) })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  async function handleFile(file: File) {
    try {
      const raw = await file.text()
      JSON.parse(raw) // fail here rather than midway through replacing data
      setPending({ raw, name: file.name })
    } catch {
      toast({ title: "That file isn't a readable INKWELL library", variant: 'destructive' })
    }
  }

  async function handleConfirmImport() {
    if (!pending) return
    setBusy('import')
    try {
      await importLibraryDocument(pending.raw)
      toast({ title: 'Library restored', description: 'Reloading…' })
      setTimeout(() => window.location.reload(), 600)
    } catch {
      toast({ title: 'Import failed', variant: 'destructive' })
      setBusy(null)
      setPending(null)
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold">Where your work lives</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          In this browser's storage on this device. It never leaves unless you export it or turn
          on cloud sync.
        </p>

        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
            {persist === 'persisted' ? (
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            ) : (
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            )}
            <div className="min-w-0 text-sm">
              {persist === 'persisted' ? (
                <>
                  <p className="font-medium">Storage is marked persistent</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    This browser has agreed not to clear your library to reclaim space.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Storage is not guaranteed</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {persist === 'unsupported'
                      ? 'This browser has no way to promise your data will be kept.'
                      : 'The browser declined to mark this data as persistent.'}{' '}
                    Keep an exported copy.
                  </p>
                </>
              )}
            </div>
          </div>

          {atRisk && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">Add INKWELL to your Home Screen</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Safari deletes stored data for websites you haven't opened in seven days.
                  Installed apps are exempt — tap Share, then <em>Add to Home Screen</em>, and
                  open INKWELL from that icon.
                </p>
              </div>
            </div>
          )}

          {installed && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <p className="text-sm font-medium">Running as an installed app</p>
            </div>
          )}

          {usage && usage.quota > 0 && (
            <div className="flex items-center gap-2.5 rounded-lg border border-border p-3 text-sm">
              <HardDrive className="size-4 shrink-0 text-muted-foreground" />
              <span>
                Using {formatSize(usage.usage)} of about {formatSize(usage.quota)} available
              </span>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Back up &amp; restore</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Saves everything — projects, chapters, characters, covers, writing history — to one
          file. The same file opens in the desktop app. AI provider keys are deliberately left
          out, so a backup is safe to email yourself.
        </p>
        <p className="mt-1.5 text-xs">
          <span className="text-muted-foreground">Last backup: </span>
          <span className={lastBackupAt ? 'font-medium' : 'font-medium text-amber-500'}>
            {formatWhen(lastBackupAt)}
          </span>
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={handleExport} disabled={busy !== null} className="gap-1.5">
            {busy === 'export' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export library
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            className="gap-1.5"
          >
            <Upload className="size-3.5" />
            Restore from file…
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".inkwell,.json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void handleFile(file)
            }}
          />
        </div>
      </section>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && busy === null && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace everything with this backup?</DialogTitle>
            <DialogDescription>
              Restoring <span className="font-medium text-foreground">{pending?.name}</span>{' '}
              deletes every project currently in this browser and replaces them with the
              contents of the file. This can't be undone — export what's here first if you
              aren't certain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmImport} disabled={busy !== null}>
              {busy === 'import' && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Replace my library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
