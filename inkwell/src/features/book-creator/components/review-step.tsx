import { BookOpen, Rows3, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { MergedChapter } from '@/features/book-creator/lib/merge-outline'
import { STRUCTURE_OPTIONS } from '@/features/projects/lib/structure-options'
import { CHAPTER_KIND_LABEL, titleStatesKind } from '@/features/templates/lib/templates'
import type { ConceptDraft } from './concept-step'
import type { CastItem } from './cast-step'

interface ReviewStepProps {
  concept: ConceptDraft
  /** The manuscript as it will actually be made — format and outline merged. */
  chapters: MergedChapter[]
  cast: CastItem[]
}

export function ReviewStep({ concept, chapters, cast }: ReviewStepProps) {
  const structure = STRUCTURE_OPTIONS.find((s) => s.value === concept.structureMode)
  const scenes = chapters.reduce((n, c) => n + c.scenes.length, 0)

  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <div>
        <h2 className="font-serif text-xl font-semibold">Ready to create your book</h2>
        <p className="text-sm text-muted-foreground">
          Here's everything that will be set up. You can change any of it afterward.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="font-serif text-lg font-semibold">{concept.title || 'Untitled'}</h3>
        <p className="text-sm text-muted-foreground">
          {concept.author || 'No author set'}
          {concept.genre && ` · ${concept.genre}`}
        </p>
        {concept.synopsis && <p className="mt-2 text-sm text-muted-foreground">{concept.synopsis}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="outline">{structure?.label}</Badge>
          <Badge variant="outline">{concept.targetWordCount.toLocaleString()} words</Badge>
          <Badge variant="outline">{concept.pov}</Badge>
          <Badge variant="outline">{concept.tense} tense</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Rows3 className="size-4" /> {chapters.length}{' '}
          {chapters.length === 1 ? 'division' : 'divisions'}
          {concept.structureMode === 'scenes' && scenes > chapters.length && (
            <span className="font-normal text-muted-foreground">
              · {scenes} {scenes === 1 ? 'scene' : 'scenes'}
            </span>
          )}
        </div>
        {chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chapters — you'll start from a blank manuscript.</p>
        ) : (
          // The format's own divisions and the outline, shown as one list,
          // because that merged thing is what will exist a moment from now.
          <ol className="space-y-1 text-sm text-muted-foreground">
            {chapters.map((c, i) => (
              <li key={`${c.title}-${i}`} className="flex items-baseline gap-2">
                {!titleStatesKind(c.title, c.kind) && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {CHAPTER_KIND_LABEL[c.kind]}
                  </span>
                )}
                <span className="truncate">{c.title || 'Untitled chapter'}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Users className="size-4" /> {cast.length} {cast.length === 1 ? 'character' : 'characters'}
        </div>
        {cast.length === 0 ? (
          <p className="text-sm text-muted-foreground">No characters yet — add some from the Cards page later.</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {cast.map((c) => (
              <li key={c.id} className="truncate">
                {c.name || 'Unnamed'}
                {c.role && ` — ${c.role}`}
                {c.addToCodex && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-primary">
                    <BookOpen className="size-3" /> Codex
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
