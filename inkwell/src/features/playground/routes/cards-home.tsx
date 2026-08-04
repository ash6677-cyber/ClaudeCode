import { Download, Library, Plus, SearchX, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { CardFormDialog } from '@/features/playground/components/card-form-dialog'
import { CardToolbar } from '@/features/playground/components/card-toolbar'
import { ImportCharactersDialog } from '@/features/playground/components/import-characters-dialog'
import { CharacterCardTile } from '@/features/playground/components/character-card-tile'
import {
  EMPTY_FILTER,
  applyCardFilter,
  filterIsEmpty,
} from '@/features/playground/lib/card-filter'
import { useCardStore } from '@/stores/card-store'
import type { CharacterCard } from '@/types'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'

export function CardsHome() {
  useDocumentTitle('Cards', 'Playground')
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')

  const { cards, status, error, loadProject, createCard, deleteCard } = useCardStore()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [deletingCard, setDeletingCard] = useState<CharacterCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Local to the screen on purpose: a filter is a way of looking at the cast
  // right now, not a setting to be remembered and wondered about later.
  const [filter, setFilter] = useState(EMPTY_FILTER)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])

  async function handleCreate(input: Parameters<typeof createCard>[0]) {
    const card = await createCard(input)
    toast({ title: `"${card.displayName}" added` })
  }

  async function handleConfirmDelete() {
    if (!deletingCard) return
    setDeleting(true)
    try {
      await deleteCard(deletingCard.id)
      toast({ title: `"${deletingCard.displayName}" deleted` })
      setDeletingCard(null)
    } catch {
      toast({ title: 'Could not delete the card', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="No project selected"
          description="Open a project from the Projects page to view its character cards."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const shown = applyCardFilter(cards, filter)

  return (
    <div className="flex h-full flex-col">
      {status === 'ready' && cards.length > 0 && (
        <div className="shrink-0 px-4 pt-4 sm:px-6">
          <CardToolbar
            cards={cards}
            filter={filter}
            onChange={setFilter}
            actions={
              <>
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <Download /> Import
                </Button>
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus /> New card
                </Button>
              </>
            }
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {status === 'loading' || status === 'idle' ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : status === 'error' ? (
          <EmptyState
            icon={Users}
            title="Couldn't load character cards"
            description={error ?? 'Something went wrong reading from local storage.'}
            action={
              <Button variant="outline" onClick={() => projectId && loadProject(projectId)}>
                Try again
              </Button>
            }
          />
        ) : cards.length === 0 ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <EmptyState
              icon={Users}
              title="No character cards yet"
              description="Give your cast a face and a voice — portraits, personality, and speech patterns you can chat with."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => setImportOpen(true)}>
                    <Download /> Import from the Almanac
                  </Button>
                  <Button variant="outline" onClick={() => setFormOpen(true)}>
                    <Plus /> New card
                  </Button>
                </div>
              }
              className="max-w-md border-none bg-transparent"
            />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nobody matches"
            description="No character in this book has all of that. Try fewer words, or fewer tags."
            action={
              <Button variant="outline" onClick={() => setFilter(EMPTY_FILTER)}>
                Clear filters
              </Button>
            }
            className="max-w-md border-none bg-transparent"
          />
        ) : (
          <>
            {!filterIsEmpty(filter) && (
              <p className="mb-3 text-sm text-muted-foreground">
                {shown.length} of {cards.length}
              </p>
            )}
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((card) => (
                <CharacterCardTile
                  key={card.id}
                  card={card}
                  projectId={projectId}
                  onDelete={() => setDeletingCard(card)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <CardFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={handleCreate} />

      <ImportCharactersDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
      />

      <ConfirmDeleteDialog
        open={deletingCard !== null}
        onOpenChange={(open) => !open && setDeletingCard(null)}
        title={`Delete "${deletingCard?.displayName}"?`}
        description="This permanently deletes the character card from this device. This can't be undone."
        pending={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
