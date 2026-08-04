import { AlertTriangle, RotateCw, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { FAILURE_HINT, type AiFailure } from '@/lib/ai/failure'
import { cn } from '@/lib/utils'

/**
 * A failure a writer can do something about.
 *
 * The old answer to everything was a toast reading "Something went wrong",
 * which is the same sentence for a mistyped key, a rate limit clearing in
 * nine seconds, and a train entering a tunnel. Each of those wants a
 * different next move, so each gets one: a link to Settings, a countdown, or
 * a retry worth pressing.
 *
 * Inline rather than a toast. A toast takes the explanation away after four
 * seconds, which is exactly when someone starts looking for it.
 */
export function AiFailureNotice({
  failure,
  onRetry,
  className,
}: {
  failure: AiFailure
  onRetry?: () => void
  className?: string
}) {
  const [waitLeft, setWaitLeft] = useState(failure.retryAfter ?? 0)

  // Restart the countdown when a new failure arrives, adjusted during render
  // (React's own recommendation) rather than through an effect that would
  // paint one frame of the previous failure's remaining seconds.
  const [shown, setShown] = useState(failure)
  if (failure !== shown) {
    setShown(failure)
    setWaitLeft(failure.retryAfter ?? 0)
  }

  useEffect(() => {
    if (waitLeft <= 0) return
    const timer = setTimeout(() => setWaitLeft((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [waitLeft])

  const waiting = waitLeft > 0
  // Retrying a wrong key or a refused prompt would fail identically, and
  // offering the button anyway would be a lie told with a spinner.
  const canRetry = Boolean(onRetry) && failure.retryable && !waiting

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs',
        className,
      )}
    >
      <AlertTriangle className="size-3.5 shrink-0 translate-y-0.5 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{failure.message}</p>
        <p className="mt-0.5 text-muted-foreground">
          {waiting
            ? `${FAILURE_HINT[failure.kind]} Try again in ${waitLeft}s.`
            : FAILURE_HINT[failure.kind]}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {failure.kind === 'auth' && (
          <Button variant="outline" size="sm" asChild className="h-7 gap-1.5">
            <Link to="/settings?tab=ai">
              <Settings className="size-3.5" /> Settings
            </Link>
          </Button>
        )}
        {onRetry && failure.retryable && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            disabled={!canRetry}
            onClick={onRetry}
          >
            <RotateCw className="size-3.5" /> {waiting ? `${waitLeft}s` : 'Try again'}
          </Button>
        )}
      </div>
    </div>
  )
}
