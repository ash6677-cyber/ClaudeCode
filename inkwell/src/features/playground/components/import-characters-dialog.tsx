import { ArrowLeft, ArrowRight, Check, Loader2, Undo2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import {
  STRATEGY_HINT,
  STRATEGY_LABEL,
  UNTOUCHED_BY_IMPORT,
  describeMapping,
  planImport,
  summarize,
  type DuplicateStrategy,
} from '@/features/playground/lib/import-characters'
import { loadCharacterEntries, type ImportScope } from '@/features/playground/lib/import-source'
import { runImport, undoImport, type ImportJournal } from '@/features/playground/lib/run-import'
import { cn } from '@/lib/utils'
import { useCardStore } from '@/stores/card-store'
import { useProjectStore } from '@/stores/project-store'
import { useSeriesStore } from '@/stores/series-store'
import type { CodexEntry } from '@/types'

type Step = 'source' | 'select' | 'review' | 'running'

const STRATEGIES: DuplicateStrategy[] = ['skip', 'replace', 'copy']

interface ImportCharactersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

/**
 * Bringing an existing cast into the Playground.
 *
 * Three steps, in the order a person actually decides: where from, who, and
 * then — before anything is written — exactly what will happen to each of
 * them. The review step is not a formality. A bulk import touches records the
 * writer has spent months on, and the only honest way to ask for permission
 * is to show the answer first.
 */
export function ImportCharactersDialog({
  open,
  onOpenChange,
  projectId,
}: ImportCharactersDialogProps) {
  const { toast } = useToast()
  const projects = useProjectStore((s) => s.projects)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)
  const series = useSeriesStore((s) => s.series)
  const fetchSeries = useSeriesStore((s) => s.fetchAll)
  const cards = useCardStore((s) => s.cards)
  const reloadCards = useCardStore((s) => s.loadProject)

  const [step, setStep] = useState<Step>('source')
  const [scope, setScope] = useState<ImportScope>({ kind: 'project', projectId })
  const [entries, setEntries] = useState<CodexEntry[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip')
  const [linked, setLinked] = useState(true)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  // Refreshed every time it opens rather than only when never loaded. This
  // is a chooser: a book or a series created since the app started has to be
  // in the list, and a stale list here reads as "that book doesn't exist".
  useEffect(() => {
    if (!open) return
    void fetchProjects()
    void fetchSeries()
  }, [open, fetchProjects, fetchSeries])

  // A fresh dialog every time: a half-made selection from last week is not a
  // starting point, it is a trap.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStep('source')
      setScope({ kind: 'project', projectId })
      setEntries(null)
      setSelected(new Set())
      setStrategy('skip')
      setLinked(true)
    }
  }

  async function chooseScope(next: ImportScope) {
    setScope(next)
    setEntries(null)
    setStep('select')
    const found = await loadCharacterEntries(next, projects)
    setEntries(found)
    setSelected(new Set(found.map((e) => e.id)))
  }

  const chosen = useMemo(
    () => (entries ?? []).filter((e) => selected.has(e.id)),
    [entries, selected],
  )
  const plan = useMemo(
    () => planImport(chosen, cards, strategy),
    [chosen, cards, strategy],
  )

  async function commit() {
    setStep('running')
    setProgress({ done: 0, total: plan.items.length })
    const outcome = await runImport(plan, {
      projectId,
      linked,
      onProgress: (done, total) => setProgress({ done, total }),
    })
    await reloadCards(projectId)
    onOpenChange(false)

    const journal: ImportJournal = outcome.journal
    const failedNote =
      outcome.failed.length > 0 ? ` · ${outcome.failed.length} could not be imported` : ''
    toast({
      title: summarize(outcome) + failedNote,
      description: outcome.failed[0]?.message,
      // Long enough to be a real offer rather than a flash of blue.
      duration: 30000,
      action: (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            await undoImport(journal)
            await reloadCards(projectId)
            toast({ title: 'Import undone' })
          }}
        >
          <Undo2 className="size-3.5" /> Undo
        </Button>
      ),
    })
  }

  const sourceLabel =
    scope.kind === 'series'
      ? (series.find((s) => s.id === scope.seriesId)?.name ?? 'a series')
      : scope.projectId === projectId
        ? 'this book'
        : (projects.find((p) => p.id === scope.projectId)?.title ?? 'another book')

  const seriesWithBooks = series.filter((s) => projects.some((p) => p.seriesId === s.id))
  const otherProjects = projects.filter((p) => p.id !== projectId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import characters</DialogTitle>
          <DialogDescription>
            {step === 'source' && 'Where should they come from?'}
            {step === 'select' && 'Who would you like?'}
            {step === 'review' && 'Here is exactly what will happen.'}
            {step === 'running' && 'Working…'}
          </DialogDescription>
        </DialogHeader>

        {step === 'source' && (
          <div className="space-y-2">
            <SourceButton
              label="This book"
              hint="Characters in this book’s Almanac."
              onClick={() => chooseScope({ kind: 'project', projectId })}
            />
            {otherProjects.map((p) => (
              <SourceButton
                key={p.id}
                label={p.title}
                hint="Another book you have written."
                onClick={() => chooseScope({ kind: 'project', projectId: p.id })}
              />
            ))}
            {seriesWithBooks.map((s) => (
              <SourceButton
                key={s.id}
                label={s.name}
                hint={`Every book in this series (${projects.filter((p) => p.seriesId === s.id).length}).`}
                onClick={() => chooseScope({ kind: 'series', seriesId: s.id })}
              />
            ))}
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-3">
            {entries === null ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Reading the Almanac…</p>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No character entries there yet.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selected.size} of {entries.length} selected
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelected(
                        selected.size === entries.length
                          ? new Set()
                          : new Set(entries.map((e) => e.id)),
                      )
                    }
                  >
                    {selected.size === entries.length ? 'Select none' : 'Select all'}
                  </Button>
                </div>
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {entries.map((entry) => {
                    const on = selected.has(entry.id)
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            const next = new Set(selected)
                            if (on) next.delete(entry.id)
                            else next.add(entry.id)
                            setSelected(next)
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors',
                            on
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-accent/40',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded border',
                              on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                            )}
                          >
                            {on && <Check className="size-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{entry.name}</span>
                            {entry.summary && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {entry.summary}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {chosen.length} {chosen.length === 1 ? 'character' : 'characters'} from{' '}
              <span className="text-foreground">{sourceLabel}</span>.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">If they are already here</Label>
              <div className="flex flex-wrap gap-1.5">
                {STRATEGIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={strategy === s}
                    onClick={() => setStrategy(s)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      strategy === s
                        ? 'border-primary bg-primary/10 font-medium text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {STRATEGY_LABEL[s]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/80">{STRATEGY_HINT[strategy]}</p>
            </div>

            <div className="rounded-md border border-border">
              <p className="border-b border-border px-3 py-2 text-xs font-medium">
                What each field becomes
              </p>
              <ul className="divide-y divide-border">
                {describeMapping(chosen[0] ?? ({ name: '', aliases: [], tags: [] } as unknown as CodexEntry)).map(
                  (row) => (
                    <li key={row.to} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
                      <span className="w-40 shrink-0 text-muted-foreground">
                        {row.from} → {row.to}
                      </span>
                      <span className={cn('min-w-0 flex-1 truncate', !row.value && 'italic text-muted-foreground/70')}>
                        {row.value || 'left blank'}
                      </span>
                    </li>
                  ),
                )}
              </ul>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground/80">
                Never touched: {UNTOUCHED_BY_IMPORT.join(', ').toLowerCase()}.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-border p-3">
              <Switch checked={linked} onCheckedChange={setLinked} aria-label="Keep linked to the Almanac" />
              <span className="min-w-0 text-xs">
                <span className="block font-medium">Keep linked to the Almanac</span>
                <span className="block text-muted-foreground">
                  {linked
                    ? 'The card remembers where it came from, so you can pull later edits across.'
                    : 'A copy taken now. Later Almanac edits will not reach it — which is what you want if the chat is going to take them somewhere else.'}
                </span>
              </span>
            </label>

            <p className="text-sm">
              <strong>{plan.creates}</strong> to add
              {plan.replaces > 0 && (
                <>
                  , <strong>{plan.replaces}</strong> to update
                </>
              )}
              {plan.skips > 0 && (
                <>
                  , <strong>{plan.skips}</strong> skipped
                </>
              )}
              .
            </p>
          </div>
        )}

        {step === 'running' && (
          <div className="flex items-center gap-3 py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {progress.done} of {progress.total}
            </p>
          </div>
        )}

        {step !== 'running' && (
          <DialogFooter>
            {step !== 'source' && (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setStep(step === 'review' ? 'select' : 'source')}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            {step === 'select' && (
              <Button
                className="gap-1.5"
                disabled={selected.size === 0}
                onClick={() => setStep('review')}
              >
                Review {selected.size} <ArrowRight className="size-4" />
              </Button>
            )}
            {step === 'review' && (
              <Button
                className="gap-1.5"
                disabled={plan.creates + plan.replaces === 0}
                onClick={commit}
              >
                <Users className="size-4" /> Import {plan.creates + plan.replaces}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SourceButton({
  label,
  hint,
  onClick,
}: {
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
