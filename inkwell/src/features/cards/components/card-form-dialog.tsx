import { useId, useState } from 'react'

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
import type { CardInput } from '@/stores/card-store'

interface CardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CardInput) => Promise<void>
}

export function CardFormDialog({ open, onOpenChange, onSubmit }: CardFormDialogProps) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Give this character a name.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        displayName: name.trim(),
        codexEntryId: null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      setName('')
      setTags('')
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New character card</DialogTitle>
            <DialogDescription>
              Start with a name — add a portrait, personality, and voice after.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`${titleId}-name`}>Name</Label>
              <Input
                id={`${titleId}-name`}
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError(null)
                }}
                placeholder="e.g. Mira Voss"
                aria-invalid={nameError ? true : undefined}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`${titleId}-tags`}>Tags</Label>
              <Input
                id={`${titleId}-tags`}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comma-separated: protagonist, antagonist, love interest…"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
