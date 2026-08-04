import {
  BarChart3,
  BookMarked,
  BookOpen,
  Boxes,
  Feather,
  Image,
  LayoutList,
  Library,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface Destination {
  to: string
  label: string
  icon: LucideIcon
  /** Carries `?project=` when a book is open. */
  projectScoped: boolean
  /** In the nav rail and the mobile sheet, or only in the command palette. */
  inRail: boolean
}

/**
 * Everywhere a writer can go, written down once.
 *
 * The command palette used to keep a second copy of this list, and the two
 * had already drifted: Read and Series were in the rail and simply
 * unreachable by ⌘K. A rename done in one place and not the other is silent,
 * which is the worst kind of wrong — so there is one list, and both surfaces
 * read it.
 *
 * `inRail` is what separates them. The rail is for the places a writer moves
 * between while working on a book; Settings and the Book Creator have their
 * own entry points and would only dilute it. Neither should be missing from
 * the palette, though, which is the app's index rather than its shortlist.
 */
export const DESTINATIONS: readonly Destination[] = [
  { to: '/projects', label: 'Projects', icon: Library, projectScoped: false, inRail: true },
  { to: '/editor', label: 'Editor', icon: Feather, projectScoped: true, inRail: true },
  { to: '/read', label: 'Read', icon: BookMarked, projectScoped: true, inRail: true },
  { to: '/almanac', label: 'Almanac', icon: BookOpen, projectScoped: true, inRail: true },
  { to: '/playground', label: 'Playground', icon: Users, projectScoped: true, inRail: true },
  { to: '/planning', label: 'Planning', icon: LayoutList, projectScoped: true, inRail: true },
  { to: '/covers', label: 'Cover Studio', icon: Image, projectScoped: true, inRail: true },
  { to: '/series', label: 'Series', icon: Boxes, projectScoped: false, inRail: true },
  { to: '/stats', label: 'Stats', icon: BarChart3, projectScoped: false, inRail: true },
  {
    to: '/book-creator',
    label: 'Book Creator',
    icon: Sparkles,
    projectScoped: false,
    inRail: false,
  },
  { to: '/settings', label: 'Settings', icon: Settings, projectScoped: false, inRail: false },
]

export const NAV_ITEMS = DESTINATIONS.filter((d) => d.inRail)

/** The destination a path belongs to, for page titles and active states. */
export function destinationFor(pathname: string): Destination | undefined {
  return DESTINATIONS.find((d) => pathname === d.to || pathname.startsWith(`${d.to}/`))
}
