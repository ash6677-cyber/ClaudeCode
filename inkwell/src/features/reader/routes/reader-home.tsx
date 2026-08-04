import { BookOpen, ChevronLeft, ChevronRight, Library } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { BookView, type ReaderPage } from '@/features/reader/components/book-view'
import { ChapterContent } from '@/features/reader/components/chapter-content'
import { PageSurface, type PageMetrics } from '@/features/reader/components/page-surface'
import { compileBook } from '@/features/reader/lib/compile-book'
import { projectRepo } from '@/lib/db/repositories'
import { useEditorStore } from '@/stores/editor-store'
import type { Project } from '@/types'

import '@/features/reader/reader.css'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'

/** Roughly a trade paperback: height / width. */
const PAGE_ASPECT = 1.52
/** Below this the spread becomes a single page, as on a phone. */
const TWO_PAGE_MIN_WIDTH = 940

function computeMetrics(width: number, height: number, columns: 1 | 2): PageMetrics {
  const availableW = Math.max(240, width - 56)
  const availableH = Math.max(320, height - 40)
  const pageW = Math.min(availableW / columns, availableH / PAGE_ASPECT)
  const pageH = pageW * PAGE_ASPECT
  return {
    width: Math.floor(pageW),
    height: Math.floor(pageH),
    padTop: Math.round(pageH * 0.072),
    padBottom: Math.round(pageH * 0.086),
    padOuter: Math.round(pageW * 0.108),
    padSpine: Math.round(pageW * 0.128),
  }
}

export function ReaderHome() {
  useDocumentTitle('Read')
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')

  const [project, setProject] = useState<Project | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    const lookup = projectId ? projectRepo.get(projectId) : Promise.resolve(undefined)
    lookup.then((found) => {
      if (!cancelled) setProject(found ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const chapters = useEditorStore((s) => s.chapters)
  const scenes = useEditorStore((s) => s.scenes)
  const status = useEditorStore((s) => s.status)
  const loadProject = useEditorStore((s) => s.loadProject)
  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])

  const book = useMemo(() => compileBook(chapters, scenes), [chapters, scenes])

  const stageRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((prev) =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height },
      )
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const columns: 1 | 2 = box.width >= TWO_PAGE_MIN_WIDTH ? 2 : 1
  const metrics = useMemo(
    () => computeMetrics(box.width, box.height, columns),
    [box.width, box.height, columns],
  )

  // Page counts arrive from hidden measurers, one per chapter — the browser
  // does the pagination via CSS columns and we just read back how many
  // columns the prose spilled into.
  const [pageCounts, setPageCounts] = useState<number[]>([])
  const setChapterCount = useCallback((index: number, count: number) => {
    setPageCounts((prev) => {
      if (prev[index] === count) return prev
      const next = [...prev]
      next[index] = count
      return next
    })
  }, [])

  const flatPages = useMemo(() => {
    // The front page first, then the prose. Tagged rather than a magic index
    // so nothing downstream has to remember that page zero is special.
    const pages: ReaderPage[] = [{ kind: 'front' }]
    book.forEach((_, chapterIndex) => {
      const count = pageCounts[chapterIndex] ?? 0
      for (let localIndex = 0; localIndex < count; localIndex++) {
        pages.push({ kind: 'chapter', chapterIndex, localIndex })
      }
    })
    return pages
  }, [book, pageCounts])

  const [rawPageIndex, setPageIndex] = useState(0)
  // Derived rather than corrected in an effect: re-measuring after a resize
  // can shrink the book, and clamping during render avoids both a cascading
  // re-render and a frame showing an out-of-range page.
  const pageIndex =
    flatPages.length > 0 ? Math.min(rawPageIndex, flatPages.length - 1) : rawPageIndex

  // The front page alone is not a book to read; wait for prose to measure.
  const ready = box.width > 0 && flatPages.length > 1
  const here = flatPages[pageIndex]
  const currentChapter = here?.kind === 'chapter' ? here.chapterIndex : 0
  const progress = flatPages.length > 0 ? (pageIndex + 1) / flatPages.length : 0

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="No project selected"
          description="Open a project from the Projects page to read it as a book."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const noContent = status === 'ready' && book.length === 0

  return (
    <div className="book-reader flex h-full flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-base font-semibold">
            {project?.title ?? 'Reading'}
          </h1>
          {project?.author && (
            <p className="truncate text-xs text-muted-foreground">{project.author}</p>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/editor?project=${projectId}`}>Back to editor</Link>
        </Button>
      </header>

      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        {noContent ? (
          <EmptyState
            icon={BookOpen}
            title="Nothing to read yet"
            description="Add a chapter and write a scene, then come back to see it as a book."
            className="border-none bg-transparent"
          />
        ) : ready ? (
          <BookView
            book={book}
            pageCounts={pageCounts}
            metrics={metrics}
            columns={columns}
            pageIndex={pageIndex}
            onPageIndexChange={setPageIndex}
            flatPages={flatPages}
            projectId={projectId}
            title={project?.title ?? ''}
            author={project?.author ?? ''}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Typesetting your book…</p>
        )}

        {/* Hidden measurers: the same content, same page geometry, laid out
            once per chapter purely to count how many pages it becomes. */}
        {box.width > 0 &&
          book.map((chapter, index) => (
            <div
              key={chapter.id}
              className="book-measure"
              style={{ width: metrics.width, height: metrics.height }}
              aria-hidden="true"
            >
              <PageSurface
                metrics={metrics}
                pageIndex={0}
                side="right"
                onPageCount={(count) => setChapterCount(index, count)}
              >
                <ChapterContent chapter={chapter} />
              </PageSurface>
            </div>
          ))}
      </div>

      {ready && (
        <footer className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Previous page"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex(Math.max(0, pageIndex - columns))}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-1.5 truncate text-center text-[11px] text-muted-foreground">
              {here?.kind === 'front'
                ? project?.title
                : `${book[currentChapter]?.title} · page ${pageIndex} of ${flatPages.length - 1}`}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Next page"
            disabled={pageIndex + columns >= flatPages.length}
            onClick={() => setPageIndex(Math.min(flatPages.length - 1, pageIndex + columns))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </footer>
      )}
    </div>
  )
}
