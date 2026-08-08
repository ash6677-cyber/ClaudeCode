import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  analyseProse,
  chapterPacing,
  findCrutchWords,
  per10k,
  type ChapterPace,
  type CrutchWord,
  type ProseReport,
  type WordTally,
} from '@/features/stats/lib/prose-analysis'
import { db } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

interface ProseReportPanelProps {
  projects: Project[]
}

/**
 * Sentence lengths in order, drawn as a ribbon.
 *
 * The average alone hides the thing worth seeing. A chapter of uniform
 * fifteen-word sentences and one that alternates four and forty have the same
 * mean and read nothing alike, and rhythm is only visible as a shape.
 */
function RhythmRibbon({ lengths }: { lengths: number[] }) {
  if (lengths.length === 0) return null
  const peak = Math.max(...lengths, 1)
  // A long chapter has more sentences than pixels; sampling keeps every bar
  // wide enough to see rather than rendering two thousand hairlines.
  const step = Math.max(1, Math.ceil(lengths.length / 160))
  const sampled = lengths.filter((_, i) => i % step === 0)

  return (
    <div
      className="flex h-20 items-end gap-px overflow-hidden rounded-md bg-muted/40 p-1.5"
      role="img"
      aria-label={`Sentence length across the text, longest ${peak} words`}
    >
      {sampled.map((length, index) => (
        <div
          key={index}
          className={cn(
            'min-w-[2px] flex-1 rounded-t-[1px]',
            length > 40 ? 'bg-amber-500/70' : 'bg-primary/55',
          )}
          style={{ height: `${Math.max(4, (length / peak) * 100)}%` }}
        />
      ))}
    </div>
  )
}

/**
 * The book as a silhouette: one bar per chapter, in order.
 *
 * Length is the bar; the brighter core is how much of it is dialogue. A
 * sagging middle, a talky act, one strangely short chapter — the things a
 * writer senses but cannot see from inside a scene are all silhouettes.
 */
function BookShape({ pacing }: { pacing: ChapterPace[] }) {
  const max = Math.max(...pacing.map((chapter) => chapter.words), 1)
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
      {pacing.map((chapter, index) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="w-28 shrink-0 truncate text-xs text-muted-foreground"
            title={chapter.title}
          >
            {chapter.title}
          </span>
          <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm bg-muted/40">
            <div
              className="absolute inset-y-0 left-0 rounded-sm bg-primary/40"
              style={{ width: `${(chapter.words / max) * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-sm bg-primary/85"
              style={{ width: `${(chapter.words / max) * chapter.dialogueRatio * 100}%` }}
            />
          </div>
          <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {chapter.words.toLocaleString()} w · ⌀{chapter.meanSentenceLength}
          </span>
        </div>
      ))}
    </div>
  )
}

function Measure({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-serif text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function TallyList({ title, items, empty }: { title: string; items: WordTally[]; empty: string }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.slice(0, 12).map((item) => (
            <li
              key={item.word}
              className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs"
            >
              {item.word}{' '}
              <span className="tabular-nums text-muted-foreground">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ProseReportPanel({ projects }: ProseReportPanelProps) {
  // Only an explicit choice is stored; the default is derived. Holding the
  // first project in state instead would mean an effect writing state during
  // render just to pick a default, and a stale id whenever the list changes.
  const [chosenId, setChosenId] = useState<string>('')
  const projectId = projects.some((project) => project.id === chosenId)
    ? chosenId
    : (projects[0]?.id ?? '')
  interface Source {
    text: string
    chapterTexts: { title: string; text: string }[]
    castNames: string[]
  }
  const [source, setSource] = useState<Source | null>(null)

  // The whole book's prose, in reading order. Read once per project rather
  // than analysed per scene and summed: sentence rhythm and repetition both
  // cross scene boundaries, and measuring each scene alone would miss them.
  // Chapter-grained texts ride along for the pacing view, and the Almanac's
  // cast comes too so nobody's protagonist is reported as an overused word.
  useEffect(() => {
    let cancelled = false
    // No project means the panel has already returned its empty state above,
    // so there is nothing to clear and no reason to write state here.
    if (!projectId) return
    void (async () => {
      const [chapters, scenes, entries] = await Promise.all([
        db.chapters.toArray(),
        db.scenes.toArray(),
        db.codexEntries.toArray(),
      ])
      const mineChapters = chapters
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.order - b.order)
      const order = new Map(mineChapters.map((c) => [c.id, c.order]))
      const mineScenes = scenes
        .filter((scene) => scene.projectId === projectId)
        .sort(
          (a, b) =>
            (order.get(a.chapterId) ?? 0) - (order.get(b.chapterId) ?? 0) || a.order - b.order,
        )
      const chapterTexts = mineChapters.map((chapter) => ({
        title: chapter.title,
        text: mineScenes
          .filter((scene) => scene.chapterId === chapter.id)
          .map((scene) => scene.plainText)
          .join('\n\n'),
      }))
      const castNames = entries
        .filter((entry) => entry.projectId === projectId)
        .flatMap((entry) => [entry.name, ...entry.aliases])
      if (!cancelled) {
        setSource({
          text: mineScenes.map((scene) => scene.plainText).join('\n\n'),
          chapterTexts,
          castNames,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const report: ProseReport | null = useMemo(
    () => (source === null ? null : analyseProse(source.text)),
    [source],
  )
  const pacing: ChapterPace[] = useMemo(
    () => (source === null ? [] : chapterPacing(source.chapterTexts)),
    [source],
  )
  const crutches: CrutchWord[] = useMemo(
    () => (source === null ? [] : findCrutchWords(source.text, source.castNames)),
    [source],
  )

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a project to analyse its prose.</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Prose report</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Measured on this device, from your own text. Nothing is sent anywhere and nothing here
            is a rule — these are habits, shown at a scale you can’t see from inside a scene.
          </p>
        </div>
        <Select value={projectId} onValueChange={setChosenId}>
          <SelectTrigger className="w-56" aria-label="Book to analyse">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {report === null ? (
        <p className="text-sm text-muted-foreground">Reading the manuscript…</p>
      ) : report.words === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing written in this book yet. The report appears once there are words to measure.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Measure
              label="Words"
              value={report.words.toLocaleString()}
              hint={`${report.sentences.toLocaleString()} sentences`}
            />
            <Measure
              label="Mean sentence"
              value={`${report.meanSentenceLength}`}
              hint={`longest ${report.longestSentence} words`}
            />
            <Measure
              label="Dialogue"
              value={`${Math.round(report.dialogueRatio * 100)}%`}
              hint="of all words, in quotes"
            />
            <Measure
              label="Reading ease"
              value={report.readingEase === null ? '—' : `${report.readingEase}`}
              hint="60–70 is ordinary prose"
            />
          </div>

          {pacing.length >= 2 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">The shape of the book</h3>
              <BookShape pacing={pacing} />
              <p className="text-xs text-muted-foreground">
                One bar per chapter: length in words, the brighter core is dialogue, ⌀ is the
                mean sentence length there.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Sentence rhythm</h3>
            <RhythmRibbon lengths={report.sentenceLengths} />
            <p className="text-xs text-muted-foreground">
              Each bar is a sentence, in order. Amber is over forty words.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <Measure
              label="Adverbs"
              value={report.adverbs.toLocaleString()}
              hint={`${per10k(report.adverbs, report.words)} per 10k words`}
            />
            <Measure
              label="Passive constructions"
              value={report.passiveCount.toLocaleString()}
              hint={`${per10k(report.passiveCount, report.words)} per 10k words`}
            />
            <Measure
              label="Close repetitions"
              value={report.repetitions.length.toLocaleString()}
              hint="places a word triples up within 50"
            />
          </div>

          <Card className="space-y-4 p-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold">Your crutch words</h3>
              {crutches.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {report.words < 2000
                    ? 'Appears once the book is long enough for habits to show (about 2,000 words).'
                    : 'No single word is being leaned on across the book. That is rarer than it sounds.'}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {crutches.map((crutch) => (
                    <li
                      key={crutch.word}
                      className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs"
                    >
                      {crutch.word}{' '}
                      <span className="tabular-nums text-muted-foreground">
                        ×{crutch.count} · {crutch.per10k}/10k
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Distinctive words worn into habits across the whole book. Your cast is excused —
                the Almanac vouches for them.
              </p>
            </div>
            <TallyList
              title="Filter words"
              items={report.filterWords}
              empty="None — the prose stays with the thing rather than the noticing of it."
            />
            <TallyList
              title="Hedges and intensifiers"
              items={report.hedgeWords}
              empty="None found."
            />
            <TallyList title="Most-worn verbs" items={report.mostUsedVerbs} empty="None found." />
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold">Words repeating close together</h3>
              {report.repetitions.length === 0 ? (
                <p className="text-xs text-muted-foreground">None.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {report.repetitions.slice(0, 24).map((rep) => (
                    <li
                      key={`${rep.word}-${rep.at}`}
                      className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs"
                    >
                      {rep.word}{' '}
                      <span className="tabular-nums text-muted-foreground">
                        ×{rep.count} · ~word {rep.at.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
