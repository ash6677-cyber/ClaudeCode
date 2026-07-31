import { BookOpen, Library, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
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
      <PageHeader
        title="Codex"
        description={
          status === 'ready' && entries.length > 0
            ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
            : undefined
        }
        actions={
          status === 'ready' &&
          entries.length > 0 && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus /> New entry
            </Button>
          )
        }
      />

      {status === 'ready' && entries.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                typeFilter === 'all'
                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
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
                  'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  typeFilter === type
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {ENTRY_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {status === 'loading' || status === 'idle' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
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
          <div className="flex min-h-[70vh] items-center justify-center">
            <EmptyState
              icon={BookOpen}
              title="Your Codex is empty"
              description="Add characters, locations, factions, and lore — everything worth remembering about your world."
              action={
                <Button onClick={() => setFormOpen(true)}>
                  <Plus /> New entry
                </Button>
              }
              className="max-w-md border-none bg-transparent"
            />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching entries"
            description="Try a different search term or filter."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
