import { AlertTriangle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useImportStore } from '@/stores/import-store'

/**
 * Mounted once at the app root so it can react to an import requested from
 * anywhere — the Data Settings page, the native File menu, or a file dropped
 * onto the window — not just when the Settings route happens to be open.
 */
export function ImportConfirmDialog() {
  const pendingPath = useImportStore((s) => s.pendingPath)
  const importing = useImportStore((s) => s.importing)
  const error = useImportStore((s) => s.error)
  const setPendingPath = useImportStore((s) => s.setPendingPath)
  const confirm = useImportStore((s) => s.confirm)

  return (
    <Dialog
      open={pendingPath !== null}
      onOpenChange={(open) => !open && !importing && setPendingPath(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Replace your current library?
          </DialogTitle>
          <DialogDescription>
            {error ??
              "Importing replaces every project, chapter, character, and setting currently in INKWELL with the contents of the chosen file. Your current library is backed up first, so this can be undone by restoring that backup."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingPath(null)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={importing} className="gap-1.5">
            {importing && <Loader2 className="size-3.5 animate-spin" />}
            {importing ? 'Importing…' : 'Replace and import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
