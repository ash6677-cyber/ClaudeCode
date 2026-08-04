import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'

import {
  SUBSECTIONS,
  activeSubsection,
  playgroundPath,
} from '@/features/playground/lib/playground-nav'
import { cn } from '@/lib/utils'

/**
 * The Playground's one header, shared by all four subsections.
 *
 * Tabs rather than a second sidebar, matching Settings' `?tab=` row that
 * writers already know — and deliberately *not* a third level of navigation.
 * The subsections are siblings, so back always leaves the subsection in one
 * press instead of unwinding a hierarchy.
 *
 * The detail screens (a card, a conversation) opt out of the chrome entirely
 * by rendering their own header; the shell only draws for the four indexes,
 * which is why `bare` exists rather than a separate layout route.
 */
export function PlaygroundShell() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const active = activeSubsection(location.pathname)

  // A card's own page and a single conversation are full screens of their
  // own; the tab row above them would be noise on a phone and a lie about
  // where "back" goes.
  const bare = /^\/playground\/(cards|chats)\/[^/]+/.test(location.pathname)
  if (bare) return <Outlet />

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border/70 px-4 pt-3.5 sm:px-6">
        <h1 className="font-serif text-xl font-semibold tracking-tight">Playground</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your cast, the conversations you have with them, and what they know.
        </p>
        <nav
          aria-label="Playground sections"
          className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1"
        >
          {SUBSECTIONS.map((section) => (
            <NavLink
              key={section.slug}
              to={playgroundPath(section.slug, projectId)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                section.slug === active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <section.icon className="size-4 shrink-0" />
              {section.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
