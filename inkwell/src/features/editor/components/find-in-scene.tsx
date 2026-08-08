import type { Editor } from '@tiptap/react'
import { CaseSensitive, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { findMatches, replaceAllMatches, replaceRange } from '@/features/editor/lib/text-search'

interface FindInSceneProps {
  editor: Editor | null
  onClose: () => void
  initialQuery?: string
}

export function FindInScene({ editor, onClose, initialQuery }: FindInSceneProps) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [docVersion, setDocVersion] = useState(0)

  useEffect(() => {
    if (!editor) return
    const handler = () => setDocVersion((v) => v + 1)
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  }, [editor])

  const matches = useMemo(() => {
    if (!editor) return []
    return findMatches(editor, query, caseSensitive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, query, caseSensitive, docVersion])

  // Jump back to the first match whenever the search criteria change, adjusted
  // during render (React's recommended pattern) rather than via an effect.
  const [renderedCriteria, setRenderedCriteria] = useState({ query, caseSensitive })
  if (renderedCriteria.query !== query || renderedCriteria.caseSensitive !== caseSensitive) {
    setRenderedCriteria({ query, caseSensitive })
    setActiveIndex(0)
  }

  useEffect(() => {
    if (!editor || matches.length === 0) return
    const clamped = Math.min(activeIndex, matches.length - 1)
    const match = matches[clamped]
    editor.chain().setTextSelection(match).scrollIntoView().run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, matches])

  function goNext() {
    if (matches.length === 0) return
    setActiveIndex((i) => (i + 1) % matches.length)
  }

  function goPrev() {
    if (matches.length === 0) return
    setActiveIndex((i) => (i - 1 + matches.length) % matches.length)
  }

  function replaceCurrent() {
    if (!editor || matches.length === 0) return
    const match = matches[Math.min(activeIndex, matches.length - 1)]
    replaceRange(editor, match, replacement)
  }

  function replaceAll() {
    if (!editor || !query) return
    replaceAllMatches(editor, query, replacement, caseSensitive)
  }

  return (
    <div className="absolute right-4 top-3 z-20 w-80 rounded-lg border border-border bg-card p-2.5 shadow-lg animate-slide-in">
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) goPrev()
              else goNext()
            }
            if (e.key === 'Escape') {
              // Consumed, and said so: the focus-mode Escape handler on
              // window checks defaultPrevented to know the key already did
              // its job here. Without this, closing the find bar re-renders
              // mid-bubble and the same keystroke falls through and exits
              // focus mode too.
              e.preventDefault()
              onClose()
            }
          }}
          placeholder="Find in scene"
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant={caseSensitive ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8 shrink-0"
          aria-label="Toggle case-sensitive"
          aria-pressed={caseSensitive}
          onClick={() => setCaseSensitive((v) => !v)}
        >
          <CaseSensitive className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onClose}
          aria-label="Close find"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {query
            ? matches.length > 0
              ? `${activeIndex + 1} of ${matches.length}`
              : 'No results'
            : ''}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={goPrev}
            aria-label="Previous match"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={goNext}
            aria-label="Next match"
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <button
            type="button"
            onClick={() => setShowReplace((v) => !v)}
            className={cn(
              'ml-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent',
              showReplace && 'bg-accent text-accent-foreground',
            )}
          >
            Replace
          </button>
        </div>
      </div>

      {showReplace && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with"
            className="h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={replaceCurrent}
          >
            Replace
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={replaceAll}
          >
            All
          </Button>
        </div>
      )}
    </div>
  )
}
