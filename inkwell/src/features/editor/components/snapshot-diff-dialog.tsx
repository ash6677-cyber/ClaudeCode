import { useMemo } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { diffWords, summariseDiff } from '@/features/editor/lib/diff'
import type { Snapshot } from '@/types'

interface SnapshotDiffDialogProps {
  snapshot: Snapshot | null
  /** The scene as it stands now — what the snapshot would be replacing. */
  currentText: string
  onOpenChange: (open: boolean) => void
  onRestore: (snapshot: Snapshot) => void
}

/**
 * What restoring a snapshot would actually do.
 *
 * Read in the direction of the action: the older draft is what you would get,
 * the current one is what you would lose. So the diff runs current → snapshot
 * and green marks what restoring brings back, red what it takes away. Running
 * it the other way round would show a correct diff labelled backwards, which
 * is worse than no diff at all when the button underneath is destructive.
 */
export function SnapshotDiffDialog({
  snapshot,
  currentText,
  onOpenChange,
  onRestore,
}: SnapshotDiffDialogProps) {
  const parts = useMemo(
    () => (snapshot ? diffWords(currentText, snapshot.plainText) : []),
    [snapshot, currentText],
  )
  const summary = useMemo(() => summariseDiff(parts), [parts])

  return (
    <Dialog open={snapshot !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>What restoring would change</DialogTitle>
          <DialogDescription>
            {summary.unchanged ? (
              'This snapshot is word for word what you have now.'
            ) : (
              <>
                Restoring brings back{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {summary.wordsAdded} {summary.wordsAdded === 1 ? 'word' : 'words'}
                </span>{' '}
                and removes{' '}
                <span className="font-medium text-destructive">
                  {summary.wordsRemoved} {summary.wordsRemoved === 1 ? 'word' : 'words'}
                </span>{' '}
                you have now.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
          <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
            {parts.map((part, index) => {
              if (part.kind === 'same') return <span key={index}>{part.text}</span>
              if (part.kind === 'added') {
                return (
                  <ins
                    key={index}
                    className="rounded-[2px] bg-emerald-500/20 text-emerald-800 no-underline dark:text-emerald-200"
                  >
                    {part.text}
                  </ins>
                )
              }
              return (
                <del key={index} className="rounded-[2px] bg-destructive/20 text-destructive">
                  {part.text}
                </del>
              )
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            <span className="rounded-[2px] bg-emerald-500/20 px-1">green</span> comes back ·{' '}
            <span className="rounded-[2px] bg-destructive/20 px-1">red</span> is lost
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={summary.unchanged}
              onClick={() => snapshot && onRestore(snapshot)}
            >
              Restore this version
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
