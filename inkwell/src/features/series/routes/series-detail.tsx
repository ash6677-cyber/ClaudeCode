import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BoxSetViewer } from '@/features/series/components/box-set-viewer'
import type { BoxSetBook } from '@/features/series/lib/box-set-scene'
import { loadBoxSetBooks } from '@/features/series/lib/load-book-art'
import { sortByReadingOrder, useSeriesStore } from '@/stores/series-store'
import type { BoxSetFinish } from '@/types'

const CASE_COLORS = ['#2a2f3a', '#1c1c1e', '#5c2b2b', '#243b2f', '#3a2c52', '#6b5426', '#e8e2d5']
const FOIL_COLORS = ['#d8c69a', '#e8e2d5', '#c8a15a', '#b0b6c0', '#1a1a1d']

export function SeriesDetail() {
  const { seriesId = '' } = useParams()
  const navigate = useNavigate()

  const series = useSeriesStore((s) => s.series)
  const projects = useSeriesStore((s) => s.projects)
  const wordCounts = useSeriesStore((s) => s.wordCounts)
  const status = useSeriesStore((s) => s.status)
  const fetchAll = useSeriesStore((s) => s.fetchAll)
  const updateBoxSet = useSeriesStore((s) => s.updateBoxSet)
  const deleteSeries = useSeriesStore((s) => s.deleteSeries)
  const addBook = useSeriesStore((s) => s.addBook)
  const removeBook = useSeriesStore((s) => s.removeBook)
  const moveBook = useSeriesStore((s) => s.moveBook)

  const [renderBooks, setRenderBooks] = useState<BoxSetBook[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const entry = series.find((s) => s.id === seriesId)

  const members = useMemo(
    () => sortByReadingOrder(projects.filter((project) => project.seriesId === seriesId)),
    [projects, seriesId],
  )
  const available = useMemo(
    () => projects.filter((project) => !project.seriesId),
    [projects],
  )

  // The set's author line: the one every book shares, or nothing if they
  // disagree — a box set stamped with one author's name over someone else's
  // work would be worse than leaving it off.
  const sharedAuthor = useMemo(() => {
    const names = new Set(members.map((book) => book.author.trim()).filter(Boolean))
    return names.size === 1 ? [...names][0] : ''
  }, [members])

  /**
   * Cover art has to be fetched and decoded before the scene can be built,
   * and rebuilding on every keystroke in the settings would thrash it. This
   * runs only when the membership or order actually changes.
   */
  const membershipKey = members.map((book) => `${book.id}:${wordCounts[book.id] ?? 0}`).join('|')
  useEffect(() => {
    let cancelled = false
    void loadBoxSetBooks(members, wordCounts).then((loaded) => {
      if (!cancelled) setRenderBooks(loaded)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipKey])

  const onSelect = useCallback((projectId: string | null) => setSelected(projectId), [])

  if (status === 'loading' && !entry) {
    return <p className="p-6 text-sm text-muted-foreground">Loading series…</p>
  }

  if (!entry) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">That series no longer exists.</p>
        <Button variant="outline" className="mt-3 gap-1.5" onClick={() => navigate('/series')}>
          <ArrowLeft className="size-4" /> Back to series
        </Button>
      </div>
    )
  }

  const selectedBook = members.find((book) => book.id === selected)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={entry.name}
        description={
          members.length === 0
            ? 'Add books to see the box set'
            : `${members.length} ${members.length === 1 ? 'volume' : 'volumes'}${sharedAuthor ? ` · ${sharedAuthor}` : ''}`
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/series">
                <ArrowLeft className="size-4" /> All series
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="grid flex-1 grid-rows-[minmax(320px,45vh)_auto] overflow-y-auto lg:grid-cols-[1fr_22rem] lg:grid-rows-1 lg:overflow-hidden">
        <div className="relative min-h-0 border-b border-border bg-gradient-to-b from-muted/40 to-background lg:border-b-0 lg:border-r">
          {renderBooks && renderBooks.length > 0 ? (
            <BoxSetViewer
              books={renderBooks}
              seriesName={entry.name}
              author={sharedAuthor}
              boxSet={entry.boxSet}
              onSelect={onSelect}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                {renderBooks ? 'Add a book to build the box set.' : 'Building the box set…'}
              </p>
            </div>
          )}

          {selectedBook && (
            <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-border bg-background/85 px-3 py-2 backdrop-blur">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selectedBook.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(wordCounts[selectedBook.id] ?? 0).toLocaleString()} words
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/editor?project=${selectedBook.id}`}>Open</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="min-h-0 space-y-6 overflow-y-auto p-4 sm:p-5">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Books in reading order</h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No books yet. Add one below and it becomes volume one.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {members.map((book, index) => (
                  <li
                    key={book.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2"
                  >
                    <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{book.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {(wordCounts[book.id] ?? 0).toLocaleString()} words
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Move ${book.title} earlier`}
                      disabled={index === 0}
                      onClick={() => moveBook(entry.id, book.id, -1)}
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Move ${book.title} later`}
                      disabled={index === members.length - 1}
                      onClick={() => moveBook(entry.id, book.id, 1)}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Remove ${book.title} from the series`}
                      onClick={() => removeBook(book.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}

            {available.length > 0 ? (
              <Select onValueChange={(projectId) => addBook(entry.id, projectId)} value="">
                <SelectTrigger className="w-full" aria-label="Add a book to this series">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Plus className="size-3.5" /> Add a book
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {available.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                Every project already belongs to a series.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">The case</h2>

            <div className="space-y-1.5">
              <Label>Board colour</Label>
              <SwatchRow
                colors={CASE_COLORS}
                value={entry.boxSet.caseColor}
                onChange={(caseColor) => updateBoxSet(entry.id, { caseColor })}
                label="Board colour"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Stamped in</Label>
              <SwatchRow
                colors={FOIL_COLORS}
                value={entry.boxSet.foilColor}
                onChange={(foilColor) => updateBoxSet(entry.id, { foilColor })}
                label="Stamp colour"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-finish">Finish</Label>
              <Select
                value={entry.boxSet.finish}
                onValueChange={(finish) =>
                  updateBoxSet(entry.id, { finish: finish as BoxSetFinish })
                }
              >
                <SelectTrigger id="box-finish">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matte">Matte</SelectItem>
                  <SelectItem value="satin">Satin</SelectItem>
                  <SelectItem value="gloss">Gloss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-reveal">
                Books stand proud · {Math.round(entry.boxSet.reveal * 100)}%
              </Label>
              <input
                id="box-reveal"
                type="range"
                min={0}
                max={100}
                value={Math.round(entry.boxSet.reveal * 100)}
                onChange={(e) => updateBoxSet(entry.id, { reveal: Number(e.target.value) / 100 })}
                className="w-full accent-primary"
              />
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDeleteDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete “${entry.name}”?`}
        description="The series is deleted. Every book in it is kept exactly as it is — they simply stop belonging to a series."
        onConfirm={async () => {
          await deleteSeries(entry.id)
          navigate('/series')
        }}
      />
    </div>
  )
}

interface SwatchRowProps {
  colors: string[]
  value: string
  onChange: (color: string) => void
  label: string
}

function SwatchRow({ colors, value, onChange, label }: SwatchRowProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${label} ${color}`}
          aria-pressed={value.toLowerCase() === color.toLowerCase()}
          onClick={() => onChange(color)}
          className={`size-7 rounded-md border-2 transition ${
            value.toLowerCase() === color.toLowerCase()
              ? 'border-primary'
              : 'border-border hover:border-muted-foreground'
          }`}
          style={{ background: color }}
        />
      ))}
    </div>
  )
}
