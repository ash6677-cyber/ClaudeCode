import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export interface CastItem {
  id: string
  name: string
  role: string
  personality: string
  addToCodex: boolean
}

interface CastStepProps {
  castCount: number
  onCastCountChange: (n: number) => void
  cast: CastItem[]
  onAdd: () => void
  onUpdate: (id: string, changes: Partial<CastItem>) => void
  onRemove: (id: string) => void
  onGenerate: () => void
  generating: boolean
  aiAvailable: boolean
  error: string | null
}

export function CastStep({
  castCount,
  onCastCountChange,
  cast,
  onAdd,
  onUpdate,
  onRemove,
  onGenerate,
  generating,
  aiAvailable,
  error,
}: CastStepProps) {
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <div>
        <h2 className="font-serif text-xl font-semibold">Sketch a starter cast</h2>
        <p className="text-sm text-muted-foreground">
          Add a few characters to get started. Each one becomes a character card you can
          flesh out — and optionally a linked Codex entry.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="wizard-cast-count" className="text-xs">
            Characters to suggest
          </Label>
          <Input
            id="wizard-cast-count"
            type="number"
            min={1}
            max={12}
            value={castCount}
            onChange={(e) => onCastCountChange(Number(e.target.value) || 1)}
            className="w-24"
          />
        </div>
        <Button type="button" onClick={onGenerate} disabled={!aiAvailable || generating} className="gap-1.5">
          <Sparkles className="size-4" />
          {generating ? 'Generating…' : 'Suggest cast'}
        </Button>
        {!aiAvailable && (
          <p className="text-xs text-muted-foreground">
            No AI provider configured —{' '}
            <Link to="/settings" className="underline">
              set one up
            </Link>{' '}
            or add characters manually below.
          </p>
        )}
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {cast.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No characters yet. Suggest a cast or add one manually.
          </p>
        ) : (
          cast.map((character) => (
            <div key={character.id} className="grid gap-2 rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <Input
                    value={character.name}
                    onChange={(e) => onUpdate(character.id, { name: e.target.value })}
                    placeholder="Name"
                    className="font-medium"
                  />
                  <Input
                    value={character.role}
                    onChange={(e) => onUpdate(character.id, { role: e.target.value })}
                    placeholder="Role — e.g. protagonist"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(character.id)}
                  aria-label={`Delete ${character.name || 'character'}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Textarea
                value={character.personality}
                onChange={(e) => onUpdate(character.id, { personality: e.target.value })}
                placeholder="Personality, voice, or a defining trait"
                rows={2}
                className="text-sm"
              />
              <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                Also add to Codex
                <Switch
                  checked={character.addToCodex}
                  onCheckedChange={(v) => onUpdate(character.id, { addToCodex: v })}
                />
              </label>
            </div>
          ))
        )}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-fit gap-1.5">
        <Plus className="size-3.5" /> Add character
      </Button>
    </div>
  )
}
