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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ProjectFormInput } from '@/stores/project-store'
import type { Project } from '@/types'

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project
  onSubmit: (input: ProjectFormInput) => Promise<void>
}

const EMPTY_FORM: ProjectFormInput = {
  title: '',
  author: '',
  genre: '',
  synopsis: '',
  targetWordCount: 80000,
  status: 'planning',
  pov: 'third-limited',
  tense: 'past',
}

function formFromProject(project: Project): ProjectFormInput {
  return {
    title: project.title,
    author: project.author,
    genre: project.genre,
    synopsis: project.synopsis,
    targetWordCount: project.targetWordCount,
    status: project.status,
    pov: project.settings.pov,
    tense: project.settings.tense,
  }
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSubmit,
}: ProjectFormDialogProps) {
  const titleId = useId()
  // Remounted via a `key` from the parent each time it opens, so these
  // initializers run fresh instead of needing an effect to resync on reopen.
  const [form, setForm] = useState<ProjectFormInput>(() =>
    project ? formFromProject(project) : EMPTY_FORM,
  )
  const [titleError, setTitleError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setTitleError('Give your project a title.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(form)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{project ? 'Project settings' : 'New project'}</DialogTitle>
            <DialogDescription>
              {project
                ? 'Update the basics. You can change these again any time.'
                : 'Give your novel a home. You can fill in the rest later.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`${titleId}-title`}>Title</Label>
              <Input
                id={`${titleId}-title`}
                autoFocus
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value })
                  if (titleError) setTitleError(null)
                }}
                placeholder="The name of your novel"
                aria-invalid={titleError ? true : undefined}
                aria-describedby={titleError ? `${titleId}-title-error` : undefined}
              />
              {titleError && (
                <p id={`${titleId}-title-error`} className="text-xs text-destructive">
                  {titleError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor={`${titleId}-author`}>Author</Label>
                <Input
                  id={`${titleId}-author`}
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="Your name or pen name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${titleId}-genre`}>Genre</Label>
                <Input
                  id={`${titleId}-genre`}
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                  placeholder="Fantasy, thriller, ..."
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`${titleId}-synopsis`}>Synopsis</Label>
              <Textarea
                id={`${titleId}-synopsis`}
                value={form.synopsis}
                onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                placeholder="A sentence or two about what this book is about"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor={`${titleId}-target`}>Target word count</Label>
                <Input
                  id={`${titleId}-target`}
                  type="number"
                  min={0}
                  step={1000}
                  value={form.targetWordCount}
                  onChange={(e) =>
                    setForm({ ...form, targetWordCount: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: ProjectFormInput['status']) =>
                    setForm({ ...form, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="drafting">Drafting</SelectItem>
                    <SelectItem value="revising">Revising</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Point of view</Label>
                <Select
                  value={form.pov}
                  onValueChange={(value: ProjectFormInput['pov']) =>
                    setForm({ ...form, pov: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">First person</SelectItem>
                    <SelectItem value="second">Second person</SelectItem>
                    <SelectItem value="third-limited">Third limited</SelectItem>
                    <SelectItem value="third-omniscient">Third omniscient</SelectItem>
                    <SelectItem value="multiple">Multiple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tense</Label>
                <Select
                  value={form.tense}
                  onValueChange={(value: ProjectFormInput['tense']) =>
                    setForm({ ...form, tense: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="past">Past</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : project ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
