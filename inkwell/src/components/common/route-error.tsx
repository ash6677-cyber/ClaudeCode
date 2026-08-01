import { AlertTriangle, RotateCw } from 'lucide-react'
import { Link, useRouteError } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'

/** Best-effort readable text for whatever was thrown. */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Shown in place of a route that failed to render or failed to load.
 *
 * Mounted per-route rather than only at the root, so the nav and the rest of
 * the shell survive: one broken screen shouldn't cost the writer their way
 * back to the manuscript. A failed dynamic import — a stale chunk after a
 * deploy, or a dropped connection — lands here too, which is why reloading
 * is offered as the first remedy.
 */
export function RouteError() {
  const error = useRouteError()
  const message = describe(error)

  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={AlertTriangle}
        title="This screen ran into a problem"
        description="Your work is saved locally and is not affected. Reloading usually clears it."
        className="max-w-md"
        action={
          <div className="w-full space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => window.location.reload()} className="gap-1.5">
                <RotateCw className="size-4" /> Reload
              </Button>
              <Button variant="outline" asChild>
                <Link to="/projects">Back to projects</Link>
              </Button>
            </div>
            {message && (
              <details className="text-left">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-left text-[11px] leading-relaxed text-muted-foreground">
                  {message}
                </pre>
              </details>
            )}
          </div>
        }
      />
    </div>
  )
}
