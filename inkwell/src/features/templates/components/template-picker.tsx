import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TemplateEditorDialog } from '@/features/templates/components/template-editor-dialog'
import {
  CHAPTER_KIND_LABEL,
  expandTemplate,
  templateSize,
} from '@/features/templates/lib/templates'
import { cn } from '@/lib/utils'
import {
  findTemplate,
  templateChoices,
  useTemplateStore,
  type TemplateChoice,
} from '@/stores/template-store'
import type { StructureMode } from '@/types'

interface TemplatePickerProps {
  value: string | null
  onChange: (id: string) => void
  structureMode: StructureMode
}

/** The first few chapters a template would make, so the choice is visible. */
function Preview({ choice, structureMode }: { choice: TemplateChoice; structureMode: StructureMode }) {
  const plan = expandTemplate(choice, {
    scenesPerChapter: structureMode === 'chapters-only' ? 'one' : 'template',
  })
  if (plan.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        The manuscript starts empty. Add chapters as you write them.
      </p>
    )
  }
  const size = templateSize(plan)
  const shown = plan.slice(0, 6)

  return (
    <div className="space-y-2">
      <ol className="space-y-1">
        {shown.map((chapter, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
              {CHAPTER_KIND_LABEL[chapter.kind]}
            </span>
            <span className="truncate font-medium">{chapter.title}</span>
            {structureMode === 'scenes' && chapter.scenes.length > 1 && (
              <span className="shrink-0 text-muted-foreground">
                · {chapter.scenes.length} scenes
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {plan.length > shown.length && `…and ${plan.length - shown.length} more · `}
        {size.chapters} {size.chapters === 1 ? 'chapter' : 'chapters'}
        {structureMode === 'scenes' && `, ${size.scenes} ${size.scenes === 1 ? 'scene' : 'scenes'}`}
      </p>
    </div>
  )
}

export function TemplatePicker({ value, onChange, structureMode }: TemplatePickerProps) {
  const custom = useTemplateStore((s) => s.custom)
  const load = useTemplateStore((s) => s.load)
  const remove = useTemplateStore((s) => s.remove)
  const [editing, setEditing] = useState<{ id?: string } | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const choices = templateChoices(custom)
  const selected = findTemplate(choices, value) ?? choices[0]

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Format</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setEditing({})}
        >
          <Plus className="size-3.5" /> New format
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {choices.map((choice) => {
          const active = choice.id === selected?.id
          return (
            <div key={choice.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onChange(choice.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  choice.custom && 'rounded-r-none border-r-0',
                  active
                    ? 'border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {choice.name}
              </button>
              {choice.custom && (
                <span
                  className={cn(
                    'flex items-center rounded-r-full border py-0.5 pr-1.5',
                    active ? 'border-primary ring-1 ring-primary' : 'border-border',
                  )}
                >
                  <button
                    type="button"
                    aria-label={`Edit ${choice.name}`}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditing({ id: choice.id })}
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${choice.name}`}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await remove(choice.id)
                      if (active) onChange(choices[0]?.id ?? '')
                    }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="mt-1 rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs text-muted-foreground">{selected.description}</p>
          <Preview choice={selected} structureMode={structureMode} />
        </div>
      )}

      {editing && (
        <TemplateEditorDialog
          templateId={editing.id}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={(id) => {
            onChange(id)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
