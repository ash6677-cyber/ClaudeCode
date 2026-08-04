import { Boxes, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SpineStrip } from '@/features/series/components/spine-strip'
import { sortByReadingOrder, useSeriesStore } from '@/stores/series-store'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'

export function SeriesHome() {
  useDocumentTitle('Series')
  const series = useSeriesStore((s) => s.series)
  const projects = useSeriesStore((s) => s.projects)
  const wordCounts = useSeriesStore((s) => s.wordCounts)
  const status = useSeriesStore((s) => s.status)
  const fetchAll = useSeriesStore((s) => s.fetchAll)
  const createSeries = useSeriesStore((s) => s.createSeries)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const booksBySeries = useMemo(() => {
    const map = new Map<string, typeof projects>()
    for (const project of projects) {
      if (!project.seriesId) continue
      map.set(project.seriesId, [...(map.get(project.seriesId) ?? []), project])
    }
    for (const [id, books] of map) map.set(id, sortByReadingOrder(books))
    return map
  }, [projects])

  async function submit() {
    const created = await createSeries({ name, description, sharedCodex: false })
    setCreating(false)
    setName('')
    setDescription('')
    void created
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Series"
        description="Group books into a series and see the set as it would be boxed."
        actions={
          <Button className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New series
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {status === 'loading' && series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading series…</p>
        ) : series.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No series yet"
            description="A series collects books that belong together — a trilogy, a saga, a set of standalones in one world. Once a series has books in it, you get a box set you can turn around and look at."
            action={
              <Button className="gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New series
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {series.map((entry) => {
              const books = booksBySeries.get(entry.id) ?? []
              return (
                <li key={entry.id}>
                  <Link
                    to={`/series/${entry.id}`}
                    className="group block overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50 hover:shadow-md"
                  >
                    {/* A flat strip of spines rather than the 3D scene: a
                        grid of live WebGL canvases would mean one renderer
                        per card, and the list is for choosing, not admiring. */}
                    <SpineStrip
                      books={books.map((book) => ({
                        id: book.id,
                        title: book.title,
                        wordCount: wordCounts[book.id] ?? 0,
                      }))}
                      caseColor={entry.boxSet.caseColor}
                    />
                    <div className="p-4">
                      <h2 className="truncate font-serif text-lg font-semibold">{entry.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {books.length === 0
                          ? 'No books yet'
                          : books.length === 1
                            ? '1 book'
                            : `${books.length} books`}
                      </p>
                      {entry.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New series</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="series-name">Name</Label>
              <Input
                id="series-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The name of the series"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="series-description">Description</Label>
              <Textarea
                id="series-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Create series</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
