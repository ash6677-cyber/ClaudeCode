import { CaseSensitive, FileSearch } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/common/empty-state'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { bulkReplaceAcrossScenes } from '@/features/editor/lib/bulk-replace'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editor-store'

interface ManuscriptSearchPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (sceneId: string, query: string) => void
}

interface SceneResult {
  sceneId: string
  sceneTitle: string
  chapterTitle: string
  count: number
  snippet: { before: string; match: string; after: string }
}

function buildSnippet(plainText: string, index: number, matchLength: number) {
  const radius = 42
  const start = Math.max(0, index - radius)
  const end = Math.min(plainText.length, index + matchLength + radius)
  return {
    before: (start > 0 ? '…' : '') + plainText.slice(start, index),
    match: plainText.slice(index, index + matchLength),
    after: plainText.slice(index + matchLength, end) + (end < plainText.length ? '…' : ''),
  }
}

export function ManuscriptSearchPanel({
  open,
  onOpenChange,
  onNavigate,
}: ManuscriptSearchPanelProps) {
  const chapters = useEditorStore((s) => s.chapters)
  const scenes = useEditorStore((s) => s.scenes)
  const projectId = useEditorStore((s) => s.projectId)
  const loadProject = useEditorStore((s) => s.loadProject)
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [confirmingReplaceAll, setConfirmingReplaceAll] = useState(false)
  const [replacing, setReplacing] = useState(false)

  const chapterTitleById = useMemo(() => new Map(chapters.map((c) => [c.id, c.title])), [chapters])

  const results = useMemo<SceneResult[]>(() => {
    if (!query) return []
    const flags = caseSensitive ? 'g' : 'gi'
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, flags)

    const out: SceneResult[] = []
    for (const scene of [...scenes].sort((a, b) => a.order - b.order)) {
      const text = scene.plainText
      let count = 0
      let firstMatchIndex = -1
      let firstMatchLength = 0
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(text))) {
        if (count === 0) {
          firstMatchIndex = m.index
          firstMatchLength = m[0].length
        }
        count++
        if (m[0].length === 0) regex.lastIndex++
      }
      if (count > 0) {
        out.push({
          sceneId: scene.id,
          sceneTitle: scene.title,
          chapterTitle: chapterTitleById.get(scene.chapterId) ?? 'Untitled chapter',
          count,
          snippet: buildSnippet(text, firstMatchIndex, firstMatchLength),
        })
      }
    }
    return out
  }, [query, scenes, caseSensitive, chapterTitleById])

  const totalOccurrences = results.reduce((sum, r) => sum + r.count, 0)

  async function handleReplaceAll() {
    if (!query) return
    setReplacing(true)
    try {
      const { scenesChanged, occurrences } = await bulkReplaceAcrossScenes(
        scenes,
        query,
        replacement,
        caseSensitive,
      )
      if (projectId) await loadProject(projectId)
      toast({
        title: `Replaced ${occurrences} occurrence${occurrences === 1 ? '' : 's'} across ${scenesChanged} scene${scenesChanged === 1 ? '' : 's'}`,
      })
      setConfirmingReplaceAll(false)
      onOpenChange(false)
    } finally {
      setReplacing(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Search manuscript</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across every scene…"
            />
            <Button
              type="button"
              variant={caseSensitive ? 'secondary' : 'ghost'}
              size="icon"
              className="shrink-0"
              aria-label="Toggle case-sensitive"
              aria-pressed={caseSensitive}
              onClick={() => setCaseSensitive((v) => !v)}
            >
              <CaseSensitive className="size-4" />
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setShowReplace((v) => !v)}
            className={cn(
              'w-fit rounded px-1.5 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent',
              showReplace && 'bg-accent text-accent-foreground',
            )}
          >
            {showReplace ? 'Hide replace' : 'Replace across manuscript…'}
          </button>

          {showReplace && (
            <div className="flex items-center gap-1.5">
              <Input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="Replace with"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!query || totalOccurrences === 0}
                onClick={() => setConfirmingReplaceAll(true)}
              >
                Replace all
              </Button>
            </div>
          )}

          <div className="max-h-96 space-y-1 overflow-y-auto">
            {query && results.length === 0 ? (
              <EmptyState
                icon={FileSearch}
                title="No matches"
                description="Try a different search term."
              />
            ) : (
              results.map((result) => (
                <button
                  key={result.sceneId}
                  type="button"
                  onClick={() => {
                    onNavigate(result.sceneId, query)
                    onOpenChange(false)
                  }}
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent"
                >
                  <span className="text-xs text-muted-foreground">
                    {result.chapterTitle} / {result.sceneTitle} · {result.count} match
                    {result.count === 1 ? '' : 'es'}
                  </span>
                  <span className="text-sm">
                    {result.snippet.before}
                    <mark className="search-match">{result.snippet.match}</mark>
                    {result.snippet.after}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingReplaceAll} onOpenChange={setConfirmingReplaceAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace across the manuscript?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces all {totalOccurrences} occurrence{totalOccurrences === 1 ? '' : 's'} of
              "{query}" with "{replacement}" across {results.length} scene
              {results.length === 1 ? '' : 's'}. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={replacing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleReplaceAll()
              }}
              disabled={replacing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {replacing ? 'Replacing…' : 'Replace all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
