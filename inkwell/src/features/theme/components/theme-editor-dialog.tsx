import { useTheme } from 'next-themes'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColorRow } from '@/features/theme/components/color-row'
import { PageEdgeEditor } from '@/features/theme/components/page-edge-editor'
import { ShapeEditor } from '@/features/theme/components/shape-editor'
import { TypographyEditor } from '@/features/theme/components/typography-editor'
import { applyTheme, readBaseTokens, type ColorMode } from '@/features/theme/lib/apply-theme'
import { parseOklch } from '@/features/theme/lib/oklch'
import { shapeIsDefault } from '@/features/theme/lib/shape'
import { typeIsDefault } from '@/features/theme/lib/typography'
import {
  clearColor,
  effectiveColor,
  isOverridden,
  overrideCount,
  pruneRedundant,
  rotatePalette,
  setColor,
} from '@/features/theme/lib/palette-edit'
import { TOKEN_GROUPS } from '@/features/theme/lib/tokens'
import { cn } from '@/lib/utils'
import {
  activeThemeId,
  resolveTheme,
  useThemeStore,
  type ThemeChoice,
  type ThemeDraft,
} from '@/stores/theme-store'
import type { ThemePalette } from '@/types'

interface ThemeEditorDialogProps {
  /** The look to start from — an existing custom theme, or a preset to copy. */
  start: ThemeChoice
  /** Set when editing in place; absent means this saves as a new theme. */
  editingId?: string
  onOpenChange: (open: boolean) => void
  onSaved: (id: string) => void
}

export function ThemeEditorDialog({
  start,
  editingId,
  onOpenChange,
  onSaved,
}: ThemeEditorDialogProps) {
  const save = useThemeStore((s) => s.save)
  const { resolvedTheme, setTheme } = useTheme()
  const mode: ColorMode = resolvedTheme === 'light' ? 'light' : 'dark'

  const [draft, setDraft] = useState<ThemeDraft>(() => ({
    name: editingId ? start.name : `${start.name} copy`,
    description: start.description,
    light: { ...start.light },
    dark: { ...start.dark },
    page: start.page ? { ...start.page } : undefined,
    shape: start.shape ? { ...start.shape } : undefined,
    type: start.type ? { ...start.type } : undefined,
  }))
  const [nameError, setNameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [hueShift, setHueShift] = useState(0)
  // The palette the hue drag started from. Rotating from the previous frame
  // instead would keep turning the wheel while the slider sat still.
  const rotationBase = useRef<ThemePalette | null>(null)

  const base = readBaseTokens(mode)
  const palette = mode === 'dark' ? draft.dark : draft.light

  function setPalette(next: ThemePalette) {
    setDraft((d) => (mode === 'dark' ? { ...d, dark: next } : { ...d, light: next }))
  }

  // Live, on the whole app rather than in a swatch box: the point of a theme
  // is what the app looks like, and a preview pane would be showing a guess.
  useEffect(() => {
    applyTheme(draft, mode)
  }, [draft, mode])

  // Put back whatever was really on when the editor closes — including after
  // saving, where the store has by then made this the active theme anyway.
  useEffect(() => {
    return () => {
      const state = useThemeStore.getState()
      applyTheme(resolveTheme(state.custom, activeThemeId(state)), mode)
    }
  }, [mode])

  function beginRotate() {
    rotationBase.current = palette
  }

  function rotate(degrees: number) {
    setHueShift(degrees)
    setPalette(rotatePalette(rotationBase.current ?? palette, base, degrees))
  }

  function commitRotate() {
    rotationBase.current = null
    setHueShift(0)
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setNameError('Give the theme a name.')
      return
    }
    setSaving(true)
    try {
      const id = await save(
        {
          ...draft,
          name: draft.name.trim(),
          // Overrides identical to the app's own colours are dropped, so a
          // theme keeps tracking the design everywhere it did not decide.
          light: pruneRedundant(draft.light, readBaseTokens('light')),
          dark: pruneRedundant(draft.dark, readBaseTokens('dark')),
          // Kept only when it draws something, so a theme does not carry a
          // switched-off edge around forever.
          page: draft.page?.enabled ? draft.page : undefined,
          // Same again: a shape identical to the app's own is not stored, so
          // the theme keeps following the design where it did not decide.
          shape: shapeIsDefault(draft.shape) ? undefined : draft.shape,
          // And once more for the faces: a theme that chose none of them is
          // not carrying a copy of the app's own typography around.
          type: typeIsDefault(draft.type) ? undefined : draft.type,
        },
        editingId,
      )
      onSaved(id)
    } finally {
      setSaving(false)
    }
  }

  const changed = overrideCount(draft.light) + overrideCount(draft.dark)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit theme' : 'New theme'}</DialogTitle>
          <DialogDescription>
            Every colour in the app, live as you change it. Anything you leave alone keeps the
            app’s own colour and follows it if the design changes.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="theme-name">Name</Label>
              <Input
                id="theme-name"
                value={draft.name}
                onChange={(e) => {
                  setDraft({ ...draft, name: e.target.value })
                  setNameError(null)
                }}
                aria-invalid={nameError !== null}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="theme-description">Description</Label>
              <Input
                id="theme-description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="What this look is for"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <p className="text-xs font-medium">Editing the {mode} palette</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A theme holds both. Switch to set the other — you edit what you can see.
              </p>
            </div>
            <div className="flex overflow-hidden rounded-md border border-border">
              {(['light', 'dark'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  aria-pressed={mode === option}
                  className={cn(
                    'px-3 py-1 text-xs capitalize transition-colors',
                    mode === option
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <TypographyEditor type={draft.type} onChange={(type) => setDraft({ ...draft, type })} />

          <ShapeEditor shape={draft.shape} onChange={(shape) => setDraft({ ...draft, shape })} />

          <PageEdgeEditor edge={draft.page} onChange={(page) => setDraft({ ...draft, page })} />

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="theme-hue">Turn every hue</Label>
              <span className="tabular-nums text-xs text-muted-foreground">
                {hueShift > 0 ? '+' : ''}
                {hueShift}°
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recolours the whole palette at once, keeping every relationship inside it.
            </p>
            <input
              id="theme-hue"
              type="range"
              min={-180}
              max={180}
              step={1}
              value={hueShift}
              aria-label="Turn every hue"
              onPointerDown={beginRotate}
              onKeyDown={() => rotationBase.current ?? beginRotate()}
              onChange={(e) => rotate(Number(e.target.value))}
              onPointerUp={commitRotate}
              onBlur={commitRotate}
              className="mt-2 h-1 w-full accent-primary"
            />
          </div>

          {TOKEN_GROUPS.map((group) => (
            <section key={group.id} className="space-y-1.5">
              <div>
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>
              <ul className="space-y-1.5">
                {group.tokens.map((spec) => {
                  const color = effectiveColor(palette, base, spec.token)
                  if (!color) return null
                  const againstValue = spec.against
                    ? (palette[spec.against] ?? base[spec.against])
                    : undefined
                  return (
                    <ColorRow
                      key={spec.token}
                      spec={spec}
                      color={color}
                      against={againstValue ? parseOklch(againstValue) : null}
                      overridden={isOverridden(palette, spec.token)}
                      onChange={(next) => setPalette(setColor(palette, spec.token, next))}
                      onReset={() => setPalette(clearColor(palette, spec.token))}
                    />
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {changed === 0
              ? 'Nothing changed yet — every colour is the app’s own.'
              : `${changed} ${changed === 1 ? 'colour' : 'colours'} changed across both palettes.`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {editingId ? 'Save theme' : 'Create theme'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
