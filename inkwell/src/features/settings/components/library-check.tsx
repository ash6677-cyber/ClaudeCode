import { Check, ClipboardCopy, Loader2, Stethoscope, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { describeRetention } from '@/lib/db/snapshot-retention'
import {
  formatIntegrityReport,
  runIntegrityCheck,
  type IntegrityReport,
} from '@/lib/db/integrity'

/**
 * "Is my library all right?", answered.
 *
 * Everything lives on one device, and until now the only evidence it was
 * intact was that the app happened to render. A scene whose chapter is gone,
 * a card pointing at a portrait that no longer exists — none of that breaks
 * anything visibly. It just sits there meaning nothing.
 *
 * The check reads and reports; it never repairs. What to do about an orphan
 * is the writer's call, and a routine that silently deleted the wrong thing
 * would be a much worse bug than the one it tidied.
 */
export function LibraryCheck() {
  const { toast } = useToast()
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<IntegrityReport | null>(null)

  async function run() {
    setRunning(true)
    try {
      setReport(await runIntegrityCheck())
    } catch {
      toast({ title: 'Could not read the library', variant: 'destructive' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Check the library</h2>
        <Button size="sm" variant="outline" onClick={run} disabled={running} className="gap-1.5">
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Stethoscope className="size-3.5" />
          )}
          {running ? 'Checking…' : 'Run check'}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Counts everything and looks for records that point at something that is no longer there.
        It only reads — nothing is changed or deleted.
      </p>

      {report && (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-border">
            <ul className="divide-y divide-border">
              {report.counts.map((count) => (
                <li key={count.table} className="flex justify-between px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">{count.table}</span>
                  <span className="tabular-nums">{count.records.toLocaleString()}</span>
                </li>
              ))}
              <li className="flex justify-between px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">In the bin</span>
                <span className="tabular-nums">{report.inBin.toLocaleString()}</span>
              </li>
            </ul>
          </div>

          {report.problems.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <Check className="size-3.5" /> Nothing is pointing at anything missing.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {report.problems.map((problem) => (
                <li
                  key={problem.what}
                  className="rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs"
                >
                  <p className="flex items-center gap-1.5 font-medium">
                    <TriangleAlert className="size-3.5 shrink-0 text-warning" />
                    {problem.what} — {problem.count}
                  </p>
                  {problem.examples.length > 0 && (
                    <p className="mt-0.5 pl-5 text-muted-foreground">
                      for example: {problem.examples.join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={async () => {
              await navigator.clipboard.writeText(formatIntegrityReport(report))
              toast({ title: 'Report copied' })
            }}
          >
            <ClipboardCopy className="size-3.5" /> Copy report
          </Button>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Scene history.</span> {describeRetention()}
      </p>
    </section>
  )
}
