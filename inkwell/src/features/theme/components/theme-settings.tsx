import { Check, Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ThemeEditorDialog } from '@/features/theme/components/theme-editor-dialog'
import { readBaseTokens } from '@/features/theme/lib/apply-theme'
import { effectiveValue } from '@/features/theme/lib/palette-edit'
import { DEFAULT_THEME_ID } from '@/features/theme/lib/presets'
import { readThemeFile, themeToFile } from '@/features/theme/lib/theme-file'
import { cn } from '@/lib/utils'
import { themeChoices, useThemeStore, type ThemeChoice } from '@/stores/theme-store'

/** Five colours from a theme, as a strip — enough to tell them apart at a glance. */
function Swatches({ choice }: { choice: ThemeChoice }) {
  // Drawn from the dark palette because that is what most of this app is
  // looked at in, and a strip built from the light one would show five
  // near-whites for half the themes on offer.
  const base = readBaseTokens('dark')
  const tokens = ['background', 'card', 'primary', 'brand-2', 'border'] as const
  return (
    <span className="flex overflow-hidden rounded-md border border-border">
      {tokens.map((token) => (
        <span
          key={token}
          className="size-5"
          style={{ background: effectiveValue(choice.dark, base, token) }}
        />
      ))}
    </span>
  )
}

export function ThemeSettings() {
  const custom = useThemeStore((s) => s.custom)
  const activeId = useThemeStore((s) => s.activeId)
  const load = useThemeStore((s) => s.load)
  const setActive = useThemeStore((s) => s.setActive)
  const save = useThemeStore((s) => s.save)
  const remove = useThemeStore((s) => s.remove)
  const { toast } = useToast()

  const [editing, setEditing] = useState<{ start: ThemeChoice; editingId?: string } | null>(null)
  const [deleting, setDeleting] = useState<ThemeChoice | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void load()
  }, [load])

  const choices = themeChoices(custom)
  const active = choices.find((c) => c.id === activeId) ?? choices[0]

  function handleExport(choice: ThemeChoice) {
    const blob = new Blob([themeToFile(choice)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${choice.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.inkwell-theme.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    const parsed = readThemeFile(await file.text())
    if (!parsed) {
      toast({ title: 'That file is not an Inkwell theme', variant: 'destructive' })
      return
    }
    const id = await save(parsed)
    setActive(id)
    toast({ title: `Added “${parsed.name}”` })
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Theme</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Every colour in the app is yours to set. A theme only holds what you change, so
            anything you leave alone keeps the app’s own colour.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-3.5" /> Import
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setEditing({ start: active })}
          >
            <Plus className="size-3.5" /> New theme
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void handleImport(file)
          }}
        />
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {choices.map((choice) => {
          const isActive = choice.id === active?.id
          return (
            <li
              key={choice.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border bg-card p-2.5',
                isActive ? 'border-primary ring-1 ring-primary' : 'border-border',
              )}
            >
              <button
                type="button"
                onClick={() => setActive(choice.id)}
                aria-pressed={isActive}
                aria-label={`Use ${choice.name}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <Swatches choice={choice} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{choice.name}</span>
                    {isActive && <Check className="size-3.5 shrink-0 text-primary" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {choice.description || 'No description'}
                  </span>
                </span>
              </button>

              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label={`Export ${choice.name}`}
                  onClick={() => handleExport(choice)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Download className="size-3.5" />
                </button>
                {choice.custom ? (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${choice.name}`}
                      onClick={() => setEditing({ start: choice, editingId: choice.id })}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${choice.name}`}
                      onClick={() => setDeleting(choice)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                ) : (
                  // A preset cannot be edited, so the way in is a copy of it.
                  // Starting from something is a far better beginning than
                  // twenty-seven colours you have to invent from nothing.
                  <button
                    type="button"
                    aria-label={`Duplicate ${choice.name}`}
                    onClick={() => setEditing({ start: choice })}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {editing && (
        <ThemeEditorDialog
          start={editing.start}
          editingId={editing.editingId}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={(id) => {
            setActive(id)
            setEditing(null)
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="The theme is removed from every device. Your writing is not affected."
        confirmLabel="Delete theme"
        onConfirm={async () => {
          if (!deleting) return
          await remove(deleting.id)
          setDeleting(null)
        }}
      />

      {active?.id !== DEFAULT_THEME_ID && (
        <p className="text-xs text-muted-foreground">
          Themes follow you between devices. Which one is on does not — a bright laptop and a
          dark desk deserve different answers.
        </p>
      )}
    </section>
  )
}
