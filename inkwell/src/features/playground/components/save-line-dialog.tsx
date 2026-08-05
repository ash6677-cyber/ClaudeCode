import { BookOpen, Feather, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { appendToEntry, appendToSummary, quoteFrom } from '@/features/playground/lib/writeback'
import { codexRepo, sceneRepo } from '@/lib/db/repositories'
import { cn } from '@/lib/utils'
import type { CodexEntry, Scene } from '@/types'

type Target = 'almanac' | 'scene'

interface SaveLineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** Who said it, for the attribution. */
  speaker: string
  text: string
  /** The entry this character is linked to, offered first when there is one. */
  linkedEntryId: string | null
}

/**
 * Keeping a line a character just said.
 *
 * Two destinations, because a line is usually one of two things: something
 * true about the character, which belongs in the Almanac, or something that
 * happens in a scene, which belongs in that scene's notes. Both append and
 * neither replaces — the whole point is that discovering something in a chat
 * should cost nothing to keep.
 */
export function SaveLineDialog({
  open,
  onOpenChange,
  projectId,
  speaker,
  text,
  linkedEntryId,
}: SaveLineDialogProps) {
  const { toast } = useToast()
  const [target, setTarget] = useState<Target>('almanac')
  const [entries, setEntries] = useState<CodexEntry[] | null>(null)
  const [scenes, setScenes] = useState<Scene[] | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.all([codexRepo.list(), sceneRepo.list()]).then(([allEntries, allScenes]) => {
      if (cancelled) return
      setEntries(
        allEntries
          .filter((e) => e.projectId === projectId)
          // The character's own entry first: it is the answer nine times in ten.
          .sort((a, b) =>
            a.id === linkedEntryId ? -1 : b.id === linkedEntryId ? 1 : a.name.localeCompare(b.name),
          ),
      )
      setScenes(allScenes.filter((s) => s.projectId === projectId))
    })
    return () => {
      cancelled = true
    }
  }, [open, projectId, linkedEntryId])

  const quote = quoteFrom(speaker, text)

  async function saveToEntry(entry: CodexEntry) {
    setSaving(entry.id)
    try {
      const next = appendToEntry(entry.body, entry.plainText, [quote])
      await codexRepo.update(entry.id, { body: next.body, plainText: next.plainText })
      toast({ title: `Added to ${entry.name}` })
      onOpenChange(false)
    } catch {
      toast({ title: 'Could not save that', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  async function saveToScene(scene: Scene) {
    setSaving(scene.id)
    try {
      await sceneRepo.update(scene.id, { summary: appendToSummary(scene.summary, quote) })
      toast({ title: `Added to ${scene.title}` })
      onOpenChange(false)
    } catch {
      toast({ title: 'Could not save that', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  const list = target === 'almanac' ? entries : scenes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keep this line</DialogTitle>
          <DialogDescription>
            It is added to the end. Nothing already written is replaced.
          </DialogDescription>
        </DialogHeader>

        <blockquote className="rounded-md border-l-2 border-primary bg-accent/30 px-3 py-2 text-sm italic">
          {quote || 'Nothing to save.'}
        </blockquote>

        <div className="flex gap-1.5">
          {(
            [
              ['almanac', 'An Almanac entry', BookOpen],
              ['scene', 'A scene’s notes', Feather],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={target === value}
              onClick={() => setTarget(value)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                target === value
                  ? 'border-primary bg-primary/10 font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {list === null && <p className="py-6 text-center text-sm text-muted-foreground">Looking…</p>}
          {list?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {target === 'almanac'
                ? 'No Almanac entries in this book yet.'
                : 'No scenes in this book yet.'}
            </p>
          )}
          {list?.map((item) => {
            const name = 'name' in item ? item.name : item.title
            const busy = saving === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={saving !== null || !quote}
                  onClick={() =>
                    target === 'almanac' ? saveToEntry(item as CodexEntry) : saveToScene(item as Scene)
                  }
                  className="flex w-full items-center gap-2 rounded-md border border-border p-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {item.id === linkedEntryId && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">linked</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
