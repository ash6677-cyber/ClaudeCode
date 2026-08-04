import { useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'

import { RouteLoading } from '@/components/common/route-loading'
import { chatToOpenFor } from '@/features/playground/lib/open-chat'
import { playgroundPath } from '@/features/playground/lib/playground-nav'
import { useCardStore } from '@/stores/card-store'
import { useChatStore } from '@/stores/chat-store'

/**
 * `/cards/:cardId/chat` — the address a conversation used to have.
 *
 * Conversations are addressed by their own id now, and the old URL names a
 * *card*, so this has to resolve one before it can redirect: find the card's
 * most recent conversation, or start one. Both stores must answer first,
 * which is why this is a component rather than a route-level `<Navigate>`.
 *
 * A card that no longer exists falls back to the Cards list rather than
 * creating an orphan conversation for it.
 */
export function LegacyChatRedirect() {
  const { cardId } = useParams<{ cardId: string }>()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')

  const cards = useCardStore((s) => s.cards)
  const cardStatus = useCardStore((s) => s.status)
  const loadCards = useCardStore((s) => s.loadProject)
  const loadChats = useChatStore((s) => s.loadProject)
  const chatStatus = useChatStore((s) => s.status)

  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) loadCards(projectId)
  }, [projectId, loadCards])
  useEffect(() => {
    if (projectId) loadChats(projectId)
  }, [projectId, loadChats])

  const ready = cardStatus === 'ready' && chatStatus === 'ready'
  const card = ready ? cards.find((c) => c.id === cardId) : undefined

  useEffect(() => {
    if (!projectId || !card || target) return
    let cancelled = false
    void chatToOpenFor(projectId, card).then((id) => {
      if (!cancelled) setTarget(playgroundPath('chats', projectId, `/${id}`))
    })
    return () => {
      cancelled = true
    }
  }, [projectId, card, target])

  if (!projectId) return <Navigate to={playgroundPath('cards')} replace />
  // A card that no longer exists gets the list, not an orphan conversation
  // created on its behalf.
  if (ready && !card) return <Navigate to={playgroundPath('cards', projectId)} replace />
  if (target) return <Navigate to={target} replace />
  return <RouteLoading />
}
