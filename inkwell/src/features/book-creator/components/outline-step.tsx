import { ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface OutlineItem {
  id: string
  title: string
  summary: string
}

interface OutlineStepProps {
  chapterCount: number
  onChapterCountChange: (n: number) => void
  chapters: OutlineItem[]
  onAdd: () => void
  onUpdate: (id: string, changes: Partial<OutlineItem>) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onGenerate: () => void
  generating: boolean
  aiAvailable: boolean
  error: string | null
}

export function OutlineStep({
  chapterCount,
  onChapterCountChange,
  chapters,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onGenerate,
  generating,
  aiAvailable,
  error,
}: OutlineStepProps) {
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <div>
        <h2 className="font-serif text-xl font-semibold">Rough out the chapters</h2>
        <p className="text-sm text-muted-foreground">
          Generate a starting outline from your premise, or build it by hand. Either way, you
          can rearrange everything once you're in the manuscript.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="wizard-chapter-count" className="text-xs">
            Chapters to generate
          </Label>
          <Input
            id="wizard-chapter-count"
            type="number"
            min={1}
            max={40}
            value={chapterCount}
            onChange={(e) => onChapterCountChange(Number(e.target.value) || 1)}
            className="w-24"
          />
        </div>
        <Button type="button" onClick={onGenerate} disabled={!aiAvailable || generating} className="gap-1.5">
          <Sparkles className="size-4" />
          {generating ? 'Generating…' : 'Generate outline'}
        </Button>
        {!aiAvailable && (
          <p className="text-xs text-muted-foreground">
            No AI provider configured —{' '}
            <Link to="/settings" className="underline">
              set one up
            </Link>{' '}
            or add chapters manually below.
          </p>
        )}
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {chapters.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No chapters yet. Generate an outline or add one manually.
          </p>
        ) : (
          chapters.map((chapter, index) => (
            <div key={chapter.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => onMove(chapter.id, -1)}
                  disabled={index === 0}
                  aria-label="Move chapter up"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <button
                  type="button"
                  onClick={() => onMove(chapter.id, 1)}
                  disabled={index === chapters.length - 1}
                  aria-label="Move chapter down"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
              <div className="grid gap-1.5">
                <Input
                  value={chapter.title}
                  onChange={(e) => onUpdate(chapter.id, { title: e.target.value })}
                  placeholder="Chapter title"
                  className="font-medium"
                />
                <Textarea
                  value={chapter.summary}
                  onChange={(e) => onUpdate(chapter.id, { summary: e.target.value })}
                  placeholder="What happens in this chapter?"
                  rows={2}
                  className="text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove(chapter.id)}
                aria-label={`Delete ${chapter.title || 'chapter'}`}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-fit gap-1.5">
        <Plus className="size-3.5" /> Add chapter
      </Button>
    </div>
  )
}
