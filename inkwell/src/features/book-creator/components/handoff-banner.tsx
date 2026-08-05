import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { handoffSummary, takeHandoff, type Handoff } from '@/features/book-creator/lib/handoff'

interface HandoffBannerProps {
  projectId: string
}

/**
 * What the Book Creator just made, said once on arrival.
 *
 * The wizard's work is real the moment it finishes and almost none of it is
 * on screen: the chapters are in a tree the writer has not opened yet, and
 * the cast is on a different page entirely. Landing in an editor showing an
 * empty first scene, with no word about any of it, is how a writer concludes
 * that four steps produced nothing.
 *
 * Taken from storage on the first render rather than watched, so it is gone
 * for good once read — including after a reload, which is the case a
 * dismissed-flag approach gets wrong.
 */
export function HandoffBanner({ projectId }: HandoffBannerProps) {
  const [handoff, setHandoff] = useState<Handoff | null>(() => takeHandoff(projectId))
  if (!handoff) return null

  return (
    <div className="flex items-start gap-2.5 border-b border-border bg-primary/5 px-3 py-2.5 sm:px-4">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p>
          {handoffSummary(handoff)}
          {handoff.templateName && (
            <span className="text-muted-foreground"> Laid out as {handoff.templateName}.</span>
          )}
        </p>
        {handoff.cards && (
          <p className="text-muted-foreground">
            Your cast is in the{' '}
            <Link
              to={`/playground/cards?project=${projectId}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Playground
            </Link>
            , where you can give them faces and talk to them.
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => setHandoff(null)}
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
