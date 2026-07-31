import { BookOpen, Library, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { EntryCard } from '@/features/codex/components/entry-card'
import { EntryFormDialog } from '@/features/codex/components/entry-form-dialog'
import { ENTRY_TYPES, ENTRY_TYPE_LABEL } from '@/features/codex/lib/entry-type'
import { cn } from '@/lib/utils'
import { useCodexStore } from '@/stores/codex-store'
import type { CodexEntryType } from '@/types'

export function CodexHome() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')

  const { entries, status, error, loadProject, createEntry } = useCodexStore()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<CodexEntryType | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.aliases.some((a) => a.toLowerCase().includes(q)) ||
        entry.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [entries, typeFilter, query])

  async function handleCreate(input: Parameters<typeof createEntry>[0]) {
    const entry = await createEntry(input)
    toast({ title: `"${entry.name}" added to the Codex` })
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="No project selected"
          description="Open a project from the Projects page to view its Codex."
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <h1 className="font-serif text-lg font-semibold">Codex</h1>
        {status === 'ready' && entries.length > 0 && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus /> New entry
          </Button>
        )}
      </header>

      {status === 'ready' && entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                typeFilter === 'all'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              All
            </button>
            {ENTRY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  typeFilter === type
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {ENTRY_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {status === 'loading' || status === 'idle' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-lg" />
            ))}
          </div>
        ) : status === 'error' ? (
          <EmptyState
            icon={BookOpen}
            title="Couldn't load the Codex"
            description={error ?? 'Something went wrong reading from local storage.'}
            action={
              <Button variant="outline" onClick={() => projectId && loadProject(projectId)}>
                Try again
              </Button>
            }
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Your Codex is empty"
            description="Add characters, locations, factions, and lore — everything worth remembering about your world."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> New entry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching entries"
            description="Try a different search term or filter."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((entry) => (
              <EntryCard key={entry.id} entry={entry} projectId={projectId} />
            ))}
          </div>
        )}
      </div>

      <EntryFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={handleCreate} />
    </div>
  )
}
