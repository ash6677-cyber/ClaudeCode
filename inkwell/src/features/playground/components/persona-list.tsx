import { Check, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { usePersonaStore, type PersonaInput } from '@/stores/persona-store'
import type { Persona } from '@/types'

const EMPTY_FORM: PersonaInput = { name: '', description: '', avatarImageId: null }

/**
 * Managing who you are in a conversation.
 *
 * Personas are global and were only reachable from a button inside a chat,
 * two levels down from anywhere a writer would think to look. The same list
 * is now a Playground screen in its own right, so this is the shared body —
 * the dialog keeps existing because changing persona mid-conversation
 * shouldn't cost you the conversation.
 */
export function PersonaList({ idPrefix = 'persona' }: { idPrefix?: string }) {
  const personas = usePersonaStore((s) => s.personas)
  const createPersona = usePersonaStore((s) => s.createPersona)
  const updatePersona = usePersonaStore((s) => s.updatePersona)
  const deletePersona = usePersonaStore((s) => s.deletePersona)
  const setDefaultPersona = usePersonaStore((s) => s.setDefaultPersona)

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<PersonaInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  function startCreate() {
    setForm(EMPTY_FORM)
    setEditingId('new')
  }

  function startEdit(persona: Persona) {
    setForm({
      name: persona.name,
      description: persona.description,
      avatarImageId: persona.avatarImageId,
    })
    setEditingId(persona.id)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') await createPersona({ ...form, name: form.name.trim() })
      else if (editingId) await updatePersona(editingId, { ...form, name: form.name.trim() })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {personas.length === 0 && editingId === null && (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No personas yet. You'll chat as "You" until you add one.
        </p>
      )}

      {personas.map((persona) =>
        editingId === persona.id ? (
          <PersonaForm
            key={persona.id}
            idPrefix={idPrefix}
            form={form}
            setForm={setForm}
            saving={saving}
            onCancel={() => setEditingId(null)}
            onSave={handleSave}
          />
        ) : (
          <div
            key={persona.id}
            className="flex items-center gap-3 rounded-md border border-border p-2.5"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{persona.name}</p>
              {persona.description && (
                <p className="truncate text-xs text-muted-foreground">{persona.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-7', persona.isDefault && 'text-warning')}
              aria-label={persona.isDefault ? 'Default persona' : `Make ${persona.name} default`}
              onClick={() => setDefaultPersona(persona.id)}
            >
              <Star className={cn('size-3.5', persona.isDefault && 'fill-current')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Edit ${persona.name}`}
              onClick={() => startEdit(persona)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              aria-label={`Delete ${persona.name}`}
              onClick={() => deletePersona(persona.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      )}

      {editingId === 'new' ? (
        <PersonaForm
          idPrefix={idPrefix}
          form={form}
          setForm={setForm}
          saving={saving}
          onCancel={() => setEditingId(null)}
          onSave={handleSave}
        />
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={startCreate}>
          <Plus className="size-3.5" /> New persona
        </Button>
      )}
    </div>
  )
}

function PersonaForm({
  idPrefix,
  form,
  setForm,
  saving,
  onCancel,
  onSave,
}: {
  idPrefix: string
  form: PersonaInput
  setForm: (form: PersonaInput) => void
  saving: boolean
  onCancel: () => void
  onSave: () => void
}) {
  // The dialog and the page can both be mounted at once, and two inputs
  // sharing an id would point every label at whichever rendered first.
  const nameId = `${idPrefix}-name`
  const descriptionId = `${idPrefix}-description`
  return (
    <div className="grid gap-2.5 rounded-md border border-primary/30 bg-accent/30 p-3">
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Ashley, or your character's name in-story"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={descriptionId}>Description</Label>
        <Textarea
          id={descriptionId}
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="How the character should perceive and address you"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!form.name.trim() || saving}
          onClick={onSave}
          className="gap-1.5"
        >
          <Check className="size-3.5" /> Save
        </Button>
      </div>
    </div>
  )
}
