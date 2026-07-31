import { History, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatRelativeTime, formatWordCount } from '@/lib/format'
import { useEditorStore } from '@/stores/editor-store'
import type { Scene, SceneStatus, Snapshot } from '@/types'

const STATUS_OPTIONS: { value: SceneStatus; label: string }[] = [
  { value: 'outline', label: 'Outline' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'revised', label: 'Revised' },
  { value: 'done', label: 'Done' },
]

interface SceneMetadataDrawerProps {
  scene: Scene
  onClose: () => void
  onContentRestored: () => void
  /** Bumped by the parent whenever a new snapshot is saved, so the History list refetches. */
  snapshotVersion: number
}

export function SceneMetadataDrawer({
  scene,
  onClose,
  onContentRestored,
  snapshotVersion,
}: SceneMetadataDrawerProps) {
  const updateSceneMeta = useEditorStore((s) => s.updateSceneMeta)
  const listSnapshots = useEditorStore((s) => s.listSnapshots)
  const restoreSnapshot = useEditorStore((s) => s.restoreSnapshot)
  const deleteSnapshot = useEditorStore((s) => s.deleteSnapshot)

  const [summaryDraft, setSummaryDraft] = useState(scene.summary)
  const [labelDraft, setLabelDraft] = useState('')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [pendingRestore, setPendingRestore] = useState<Snapshot | null>(null)

  // Reset the summary draft whenever the active scene changes, without an effect:
  // React's recommended way to adjust state in response to a prop change.
  const [renderedSceneId, setRenderedSceneId] = useState(scene.id)
  if (scene.id !== renderedSceneId) {
    setRenderedSceneId(scene.id)
    setSummaryDraft(scene.summary)
  }

  useEffect(() => {
    listSnapshots(scene.id).then(setSnapshots)
  }, [scene.id, listSnapshots, snapshotVersion])

  const readingMinutes = Math.max(1, Math.round(scene.wordCount / 200))

  function addLabel() {
    const label = labelDraft.trim()
    if (!label || scene.labels.includes(label)) {
      setLabelDraft('')
      return
    }
    updateSceneMeta(scene.id, { labels: [...scene.labels, label] })
    setLabelDraft('')
  }

  async function handleRestore() {
    if (!pendingRestore) return
    await restoreSnapshot(pendingRestore)
    setPendingRestore(null)
    onContentRestored()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">Scene details</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close details"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-border p-2.5">
            <p className="text-xs text-muted-foreground">Words</p>
            <p className="font-medium tabular-nums">{formatWordCount(scene.wordCount)}</p>
          </div>
          <div className="rounded-md border border-border p-2.5">
            <p className="text-xs text-muted-foreground">Reading time</p>
            <p className="font-medium tabular-nums">{readingMinutes} min</p>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={scene.status}
            onValueChange={(value: SceneStatus) => updateSceneMeta(scene.id, { status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="scene-summary">Summary</Label>
          <Textarea
            id="scene-summary"
            rows={4}
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            onBlur={() => {
              if (summaryDraft !== scene.summary)
                updateSceneMeta(scene.id, { summary: summaryDraft })
            }}
            placeholder="What happens in this scene? Used for planning and AI context later."
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="scene-labels">Labels</Label>
          <div className="flex flex-wrap gap-1.5">
            {scene.labels.map((label) => (
              <Badge key={label} variant="secondary" className="gap-1 pr-1">
                {label}
                <button
                  type="button"
                  aria-label={`Remove label ${label}`}
                  onClick={() =>
                    updateSceneMeta(scene.id, { labels: scene.labels.filter((l) => l !== label) })
                  }
                  className="rounded-full p-0.5 hover:bg-background/60"
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
          <input
            id="scene-labels"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addLabel()
              }
            }}
            onBlur={addLabel}
            placeholder="Add a label and press Enter"
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <History className="size-3.5" /> History
          </div>
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Snapshots appear here automatically as you write.
            </p>
          ) : (
            <ul className="space-y-1">
              {snapshots.map((snap) => (
                <li
                  key={snap.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                >
                  <div>
                    <p className="font-medium">{formatRelativeTime(snap.createdAt)}</p>
                    <p className="text-muted-foreground">{formatWordCount(snap.wordCount)} words</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setPendingRestore(snap)}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label="Delete snapshot"
                      onClick={async () => {
                        await deleteSnapshot(snap.id)
                        setSnapshots((prev) => prev.filter((s) => s.id !== snap.id))
                      }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AlertDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => !open && setPendingRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRestore &&
                `This replaces the scene's current text (${formatWordCount(scene.wordCount)} words) with the version from ${formatRelativeTime(pendingRestore.createdAt)}. The current version is not saved first.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
