import { BookMarked, Library, Plus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { CardFormDialog } from '@/features/cards/components/card-form-dialog'
import { CharacterCardTile } from '@/features/cards/components/character-card-tile'
import { useCardStore } from '@/stores/card-store'
import type { CharacterCard } from '@/types'

export function CardsHome() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')

  const { cards, status, error, loadProject, createCard, deleteCard } = useCardStore()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [deletingCard, setDeletingCard] = useState<CharacterCard | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Cards"
        description={
          status === 'ready' && cards.length > 0
            ? `${cards.length} ${cards.length === 1 ? 'character' : 'characters'}`
            : undefined
        }
        actions={
          status === 'ready' &&
          cards.length > 0 && (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/lorebooks?project=${projectId}`}>
                  <BookMarked /> Lorebooks
                </Link>
              </Button>
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus /> New card
              </Button>
            </>
          )
        }
      />

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
                <Button onClick={() => setFormOpen(true)}>
                  <Plus /> New card
                </Button>
              }
              className="max-w-md border-none bg-transparent"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <CharacterCardTile
                key={card.id}
                card={card}
                projectId={projectId}
                onDelete={() => setDeletingCard(card)}
              />
            ))}
          </div>
        )}
      </div>

      <CardFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={handleCreate} />

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
