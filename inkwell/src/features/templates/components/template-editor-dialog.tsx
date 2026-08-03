import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  blankCustomTemplate,
  CHAPTER_KIND_LABEL,
  expandTemplate,
  templateSize,
} from '@/features/templates/lib/templates'
import { useTemplateStore, type TemplateDraft } from '@/stores/template-store'
import type { ChapterKind, ChapterNumbering, StructureMode, TemplatePart } from '@/types'

interface TemplateEditorDialogProps {
  /** Editing an existing format, or undefined to make a new one. */
  templateId?: string
  onOpenChange: (open: boolean) => void
  onSaved: (id: string) => void
}

const KINDS: ChapterKind[] = [
  'prologue',
  'chapter',
  'interlude',
  'part',
  'epilogue',
  'act',
  'poem',
  'entry',
]

/** "Whatever the project uses" is a real answer, so it needs a value. */
const INHERIT = 'inherit'

const STRUCTURES: { value: string; label: string }[] = [
  { value: INHERIT, label: 'Whatever the project uses' },
  { value: 'scenes', label: 'Chapters & scenes' },
  { value: 'chapters-only', label: 'One writable unit each' },
]

const NUMBERING: { value: ChapterNumbering; label: string; example: string }[] = [
  { value: 'words', label: 'Words', example: 'Chapter Twelve' },
  { value: 'digits', label: 'Digits', example: 'Chapter 12' },
  { value: 'roman', label: 'Roman', example: 'Chapter XII' },
]

export function TemplateEditorDialog({
  templateId,
  onOpenChange,
  onSaved,
}: TemplateEditorDialogProps) {
  const existing = useTemplateStore((s) => s.custom.find((t) => t.id === templateId))
  const save = useTemplateStore((s) => s.save)

  const [draft, setDraft] = useState<TemplateDraft>(() =>
    existing
      ? {
          name: existing.name,
          description: existing.description,
          numbering: existing.numbering,
          structureMode: existing.structureMode,
          parts: existing.parts.map((part) => ({ ...part })),
        }
      : blankCustomTemplate(),
  )
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  function setPart(id: string, changes: Partial<TemplatePart>) {
    setDraft((d) => ({
      ...d,
      parts: d.parts.map((part) => (part.id === id ? { ...part, ...changes } : part)),
    }))
  }

  function movePart(index: number, by: number) {
    setDraft((d) => {
      const next = [...d.parts]
      const target = index + by
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...d, parts: next }
    })
  }

  const plan = expandTemplate(draft, {
    scenesPerChapter: draft.structureMode === 'chapters-only' ? 'one' : 'template',
  })
  const size = templateSize(plan)

  async function handleSave() {
    if (!draft.name.trim()) {
      setNameError('Give the format a name.')
      return
    }
    setSaving(true)
    try {
      const id = await save({ ...draft, name: draft.name.trim() }, templateId)
      onSaved(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>{templateId ? 'Edit format' : 'New format'}</DialogTitle>
          <DialogDescription>
            Lay out the divisions your books start with. Write <code>{'{n}'}</code> where the
            number should go — the format decides how it is written.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="format-name">Name</Label>
              <Input
                id="format-name"
                value={draft.name}
                onChange={(e) => {
                  setDraft({ ...draft, name: e.target.value })
                  setNameError(null)
                }}
                placeholder="My format"
                aria-invalid={nameError !== null}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Numbers written as</Label>
              <Select
                value={draft.numbering}
                onValueChange={(v: ChapterNumbering) => setDraft({ ...draft, numbering: v })}
              >
                <SelectTrigger aria-label="Numbers written as">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUMBERING.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} — {option.example}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="format-description">Description</Label>
              <Input
                id="format-description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="What this shape is for"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Structure</Label>
              {/* A poem or a diary entry is one whole thing; a format that
                  knows that switches the project to it when picked, instead
                  of leaving every poem with a lone "Scene 1" underneath. */}
              <Select
                value={draft.structureMode ?? INHERIT}
                onValueChange={(v) =>
                  setDraft({
                    ...draft,
                    structureMode: v === INHERIT ? undefined : (v as StructureMode),
                  })
                }
              >
                <SelectTrigger aria-label="Structure">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Divisions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() =>
                  setDraft({
                    ...draft,
                    parts: [
                      ...draft.parts,
                      {
                        id: crypto.randomUUID(),
                        kind: 'chapter',
                        title: 'Chapter {n}',
                        count: 1,
                        scenesEach: 1,
                      },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </div>

            {draft.parts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No divisions — books made with this format start empty.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {draft.parts.map((part, index) => (
                  <li
                    key={part.id}
                    className="grid grid-cols-[7.5rem_1fr_4.5rem_4.5rem_auto] items-end gap-2 rounded-lg border border-border bg-card p-2"
                  >
                    <div className="grid gap-1">
                      {index === 0 && <span className="text-[10px] text-muted-foreground">Kind</span>}
                      <Select
                        value={part.kind}
                        onValueChange={(v: ChapterKind) => setPart(part.id, { kind: v })}
                      >
                        <SelectTrigger className="h-8" aria-label={`Kind of division ${index + 1}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KINDS.map((kind) => (
                            <SelectItem key={kind} value={kind}>
                              {CHAPTER_KIND_LABEL[kind]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      {index === 0 && (
                        <span className="text-[10px] text-muted-foreground">Title</span>
                      )}
                      <Input
                        className="h-8"
                        value={part.title}
                        aria-label={`Title of division ${index + 1}`}
                        onChange={(e) => setPart(part.id, { title: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      {index === 0 && (
                        <span className="text-[10px] text-muted-foreground">How many</span>
                      )}
                      <Input
                        className="h-8"
                        type="number"
                        min={1}
                        max={200}
                        value={part.count}
                        aria-label={`How many of division ${index + 1}`}
                        onChange={(e) =>
                          setPart(part.id, { count: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                    <div className="grid gap-1">
                      {index === 0 && (
                        <span className="text-[10px] text-muted-foreground">Scenes</span>
                      )}
                      <Input
                        className="h-8"
                        type="number"
                        min={1}
                        max={50}
                        value={part.scenesEach}
                        aria-label={`Scenes in each of division ${index + 1}`}
                        onChange={(e) =>
                          setPart(part.id, { scenesEach: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                    <div className="flex gap-0.5 pb-0.5">
                      <button
                        type="button"
                        aria-label={`Move division ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => movePart(index, -1)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move division ${index + 1} down`}
                        disabled={index === draft.parts.length - 1}
                        onClick={() => movePart(index, 1)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove division ${index + 1}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            parts: draft.parts.filter((p) => p.id !== part.id),
                          })
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium">
              A book started in this format ({size.chapters}{' '}
              {size.chapters === 1 ? 'chapter' : 'chapters'}, {size.scenes}{' '}
              {size.scenes === 1 ? 'scene' : 'scenes'})
            </p>
            {plan.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing — it starts empty.</p>
            ) : (
              <ol className="space-y-0.5">
                {plan.slice(0, 14).map((chapter, index) => (
                  <li key={index} className="flex gap-2 text-xs">
                    <span className="w-16 shrink-0 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                      {CHAPTER_KIND_LABEL[chapter.kind]}
                    </span>
                    <span className="truncate">{chapter.title}</span>
                  </li>
                ))}
                {plan.length > 14 && (
                  <li className="pl-[4.5rem] text-xs text-muted-foreground">
                    …and {plan.length - 14} more
                  </li>
                )}
              </ol>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {templateId ? 'Save format' : 'Create format'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
