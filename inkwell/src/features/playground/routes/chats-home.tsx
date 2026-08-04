import { Library, MessageCircle, MessageSquarePlus } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CardFacePreview } from '@/features/playground/components/card-face'
import { playgroundPath } from '@/features/playground/lib/playground-nav'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { useCardStore } from '@/stores/card-store'
import { useChatStore } from '@/stores/chat-store'
import { activeContent } from '@/stores/chat-store'
import type { CardChat, CharacterCard } from '@/types'

/** "3 days ago" beats a date nobody reads for something this recent. */
function whenText(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(at).toLocaleDateString()
}

function lastLine(chat: CardChat): string {
  const last = chat.messages[chat.messages.length - 1]
  if (!last) return 'No messages yet'
  const text = activeContent(last).replace(/\s+/g, ' ').trim()
  if (!text) return 'No messages yet'
  return last.role === 'user' ? `You: ${text}` : text
}

export function ChatsHome() {
  useDocumentTitle('Chats', 'Playground')
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const navigate = useNavigate()

  const chats = useChatStore((s) => s.chats)
  const status = useChatStore((s) => s.status)
  const loadProject = useChatStore((s) => s.loadProject)

  const cards = useCardStore((s) => s.cards)
  const loadCardsProject = useCardStore((s) => s.loadProject)

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])
  useEffect(() => {
    if (projectId) loadCardsProject(projectId)
  }, [projectId, loadCardsProject])

  const cardById = useMemo(
    () => new Map<string, CharacterCard>(cards.map((c) => [c.id, c])),
    [cards],
  )

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="No project selected"
          description="Open a project from the Projects page to see its conversations."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={MessageSquarePlus}
          title="No conversations yet"
          description="Conversations you have with your characters will gather here, whoever you had them with."
          action={
            <Button onClick={() => navigate(playgroundPath('cards', projectId))}>
              <MessageCircle /> Pick a character
            </Button>
          }
          className="max-w-md border-none bg-transparent"
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <ul className="mx-auto flex max-w-3xl flex-col gap-2">
        {chats.map((chat) => {
          const card = cardById.get(chat.cardId)
          return (
            <li key={chat.id}>
              <Link
                to={playgroundPath('chats', projectId, `/${chat.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="w-12 shrink-0">
                  {card ? (
                    <CardFacePreview card={card} compact />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-md bg-muted">
                      <MessageCircle className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {card?.displayName ?? 'Deleted character'}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {whenText(chat.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{chat.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                    {lastLine(chat)}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
