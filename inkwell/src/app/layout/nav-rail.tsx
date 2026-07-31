import {
  BarChart3,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Feather,
  Image,
  LayoutList,
  Library,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { ThemeToggle } from '@/components/common/theme-toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editor-store'
import { useUiStore } from '@/stores/ui-store'

const NAV_ITEMS = [
  { to: '/projects', label: 'Projects', icon: Library, projectScoped: false },
  { to: '/editor', label: 'Editor', icon: Feather, projectScoped: true },
  { to: '/codex', label: 'Codex', icon: BookOpen, projectScoped: true },
  { to: '/cards', label: 'Cards', icon: Users, projectScoped: true },
  { to: '/planning', label: 'Planning', icon: LayoutList, projectScoped: true },
  { to: '/covers', label: 'Covers', icon: Image, projectScoped: true },
  { to: '/stats', label: 'Stats', icon: BarChart3, projectScoped: false },
] as const

export function NavRail() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const activeProjectId = useEditorStore((s) => s.projectId)

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <div className={cn('flex h-14 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Feather className="size-4" strokeWidth={2} />
        </div>
        {!collapsed && (
          <span className="font-serif text-base font-semibold tracking-tight text-sidebar-foreground">
            Inkwell
          </span>
        )}
      </div>

      <div className={cn('px-2 pb-1', collapsed && 'px-2')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette"
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border px-2.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                collapsed && 'justify-center border-none px-0',
              )}
            >
              <Search className="size-3.5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Jump to…</span>
                  <kbd className="rounded border border-sidebar-border px-1 font-mono text-[10px]">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Jump to… (⌘K)</TooltipContent>}
        </Tooltip>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <NavRailLink
            key={item.to}
            to={
              item.projectScoped && activeProjectId
                ? `${item.to}?project=${activeProjectId}`
                : item.to
            }
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div
        className={cn(
          'flex items-center gap-1 border-t border-sidebar-border p-2',
          collapsed && 'flex-col',
        )}
      >
        <ThemeToggle />
        <NavRailLink
          to="/settings"
          label="Settings"
          icon={Settings}
          collapsed={collapsed}
          className="flex-1"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {collapsed ? (
                <ChevronsRight className="size-4" />
              ) : (
                <ChevronsLeft className="size-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Expand' : 'Collapse'}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}

function NavRailLink({
  to,
  label,
  icon: Icon,
  collapsed,
  className,
}: {
  to: string
  label: string
  icon: typeof Feather
  collapsed: boolean
  className?: string
}) {
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed && 'justify-center px-0',
          isActive && 'bg-accent text-accent-foreground',
          className,
        )
      }
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.9} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
