import { BookMarked, MessageCircle, Users, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The Playground's four rooms.
 *
 * "Cards" used to be the name of the whole thing, which was a gallery's name
 * on a product that also held a chat, a set of personas and the lorebooks
 * those chats draw on. A writer looking for "talk to my character" had no
 * scent trail: chats lived *inside* a card, personas two levels inside a
 * chat, and lorebooks behind a corner button. Naming the container after one
 * of its four parts is what hid the other three.
 */
export interface Subsection {
  /** The path segment under /playground. */
  slug: string
  label: string
  icon: LucideIcon
}

export const SUBSECTIONS: readonly Subsection[] = [
  { slug: 'cards', label: 'Cards', icon: Users },
  { slug: 'chats', label: 'Chats', icon: MessageCircle },
  { slug: 'personas', label: 'Personas', icon: UserRound },
  { slug: 'lorebooks', label: 'Lorebooks', icon: BookMarked },
]

export const PLAYGROUND_ROOT = '/playground'

/** A Playground link that keeps the open book with it. */
export function playgroundPath(slug: string, projectId?: string | null, rest = ''): string {
  const base = `${PLAYGROUND_ROOT}/${slug}${rest}`
  return projectId ? `${base}?project=${projectId}` : base
}

/**
 * Which tab to light up.
 *
 * Detail pages belong to their section — a card's own page is still Cards,
 * and a conversation is still Chats — so this matches the segment rather
 * than the whole path. Without that, opening a card would leave every tab
 * unlit and the writer with no idea where they were.
 */
export function activeSubsection(pathname: string): string | null {
  const match = pathname.match(/^\/playground\/([^/?]+)/)
  const slug = match?.[1]
  return slug && SUBSECTIONS.some((s) => s.slug === slug) ? slug : null
}
