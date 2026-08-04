import { BookMarked, Library, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { LorebookEntryRow } from '@/features/cards/components/lorebook-entry-row'
import { cn } from '@/lib/utils'
import { useLorebookStore } from '@/stores/lorebook-store'
import type { LorebookEntry } from '@/types'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'

export function LorebooksHome() {
  useDocumentTitle('Lorebooks')
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')

  const { lorebooks, status, loadProject, createLorebook, renameLorebook, deleteLorebook, addEntry, updateEntry, removeEntry } =
    useLorebookStore()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])

  // Selects the first lorebook once the list loads, via render-time adjustment rather
  // than an effect — `!activeId` flips false as soon as this runs, so it settles in one pass.
  if (!activeId && lorebooks.length > 0) {
    setActiveId(lorebooks[0].id)
  }

  const active = lorebooks.find((l) => l.id === activeId) ?? null

  const [renderedActiveId, setRenderedActiveId] = useState<string | undefined>(undefined)
  if (active && activeId !== renderedActiveId) {
    setRenderedActiveId(activeId ?? undefined)
    setTitleDraft(active.name)
  }

  async function handleCreate() {
    const lorebook = await createLorebook('New lorebook')
    setActiveId(lorebook.id)
  }

  function handleEntryChange(entry: LorebookEntry, changes: Partial<LorebookEntry>) {
    if (!active) return
    updateEntry(active.id, entry.id, { ...entry, ...changes })
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="No project selected"
          description="Open a project from the Projects page to manage its lorebooks."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Lorebooks"
        description="World info your characters can draw on while chatting."
        actions={
          <Button size="sm" onClick={handleCreate}>
            <Plus /> New lorebook
          </Button>
        }
      />

      {status === 'loading' && lorebooks.length === 0 ? (
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : lorebooks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={BookMarked}
            title="No lorebooks yet"
            description="Create a lorebook to give your characters shared world info that surfaces automatically when it's relevant to the conversation."
            action={
              <Button onClick={handleCreate}>
                <Plus /> New lorebook
              </Button>
            }
            className="max-w-md border-none bg-transparent"
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="w-full shrink-0 border-b border-border p-3 lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {lorebooks.map((lb) => (
                <button
                  key={lb.id}
                  type="button"
                  onClick={() => setActiveId(lb.id)}
                  className={cn(
                    'shrink-0 rounded-md px-3 py-2 text-left text-sm transition-colors lg:w-full',
                    lb.id === activeId
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  {lb.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">({lb.entries.length})</span>
                </button>
              ))}
            </div>
          </div>

          {active && (
            <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto p-5 lg:p-6">
              <div className="flex items-center gap-2">
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => titleDraft.trim() && titleDraft !== active.name && renameLorebook(active.id, titleDraft.trim())}
                  className="h-auto flex-1 border-none px-0 font-serif text-xl font-semibold shadow-none focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  aria-label={`Delete ${active.name}`}
                  onClick={() => setDeletingId(active.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {active.entries.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    No entries yet. Add one to give characters shared world info.
                  </p>
                ) : (
                  active.entries.map((entry) => (
                    <LorebookEntryRow
                      key={entry.id}
                      entry={entry}
                      onChange={(changes) => handleEntryChange(entry, changes)}
                      onDelete={() => removeEntry(active.id, entry.id)}
                    />
                  ))
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  addEntry(active.id, {
                    keywords: [],
                    content: '',
                    constant: false,
                    priority: 0,
                    tokenBudget: 200,
                    enabled: true,
                  })
                }
              >
                <Plus className="size-3.5" /> Add entry
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete this lorebook?"
        description="This permanently deletes the lorebook and all of its entries. This can't be undone."
        onConfirm={async () => {
          if (!deletingId) return
          await deleteLorebook(deletingId)
          if (activeId === deletingId) setActiveId(null)
          setDeletingId(null)
        }}
      />
    </div>
  )
}
