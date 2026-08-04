import { useChatStore } from '@/stores/chat-store'
import type { CharacterCard } from '@/types'

/**
 * The conversation a "Chat" button should open.
 *
 * Chatting with a character is one intent, not two, so pressing Chat has to
 * mean "carry on" when there is something to carry on with and "begin" when
 * there isn't. Making the writer choose between those is asking them to know
 * their own filing system before they can say hello.
 *
 * Reads the store directly rather than taking the list as an argument: the
 * old URL `/cards/:id/chat` resolves through here too, from a component that
 * renders nothing and so has no list of its own.
 */
export async function chatToOpenFor(projectId: string, card: CharacterCard): Promise<string> {
  const { chats, createChat } = useChatStore.getState()
  const forCard = chats.filter((c) => c.cardId === card.id)
  if (forCard.length > 0) {
    // The store keeps them newest first, which is the one to resume.
    return forCard[0].id
  }
  const created = await createChat(projectId, card.id, {
    title: 'First conversation',
    firstMessage: card.firstMessage,
  })
  return created.id
}

/** A title for a new conversation that is neither blank nor "Chat 7". */
export function nextChatTitle(existing: number): string {
  return existing === 0 ? 'First conversation' : `Conversation ${existing + 1}`
}
