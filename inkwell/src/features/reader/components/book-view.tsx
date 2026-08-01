import { useCallback, useEffect, useRef, useState } from 'react'

import { ChapterContent } from '@/features/reader/components/chapter-content'
import { PageSurface, type PageMetrics } from '@/features/reader/components/page-surface'
import type { BookChapter } from '@/features/reader/lib/compile-book'
import { cn } from '@/lib/utils'

/** Past this fraction of a turn, releasing completes it instead of snapping back. */
const COMMIT_THRESHOLD = 0.5
/** A quick flick completes the turn even from a shallow angle, matching the
 * feel of throwing a real page. px/ms. */
const FLICK_VELOCITY = 0.45
const MAX_SETTLE_MS = 460

type Direction = 'forward' | 'backward'

interface TurnState {
  direction: Direction
  /** Page index shown on the face that starts flat on the right. */
  frontPage: number
  /** Page index on the reverse, which lands on the left. */
  backPage: number
}

interface FlatPage {
  chapterIndex: number
  localIndex: number
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function BookView({
  book,
  pageCounts,
  metrics,
  columns,
  pageIndex,
  onPageIndexChange,
  flatPages,
}: {
  book: BookChapter[]
  pageCounts: number[]
  metrics: PageMetrics
  columns: 1 | 2
  pageIndex: number
  onPageIndexChange: (index: number) => void
  flatPages: FlatPage[]
}) {
  const totalPages = flatPages.length
  const leafRef = useRef<HTMLDivElement | null>(null)
  const frontShadeRef = useRef<HTMLDivElement | null>(null)
  const backShadeRef = useRef<HTMLDivElement | null>(null)
  const spineShadowRef = useRef<HTMLDivElement | null>(null)

  const [turn, setTurn] = useState<TurnState | null>(null)

  // Live drag values are kept in refs, never state: a pointermove that
  // triggers a React render can't hold a frame budget at 120Hz, and the
  // turn has to stay glued to the cursor.
  const progressRef = useRef(0)
  const draggingRef = useRef(false)
  const pointerStartRef = useRef(0)
  const lastMoveRef = useRef({ x: 0, t: 0 })
  const velocityRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const turnRef = useRef<TurnState | null>(null)

  // The left page of the current spread. In two-column mode a spread always
  // starts on an even page so the pair stays stable as you turn.
  const leftPage = columns === 2 ? pageIndex - (pageIndex % 2) : pageIndex
  const rightPage = columns === 2 ? leftPage + 1 : leftPage

  const canGoForward = (columns === 2 ? leftPage + 2 : leftPage + 1) < totalPages
  const canGoBackward = leftPage > 0

  const paint = useCallback(
    (progress: number) => {
      const leaf = leafRef.current
      if (!leaf) return
      const angle = -180 * progress
      leaf.style.transform = `rotateY(${angle}deg)`

      // Light falls off as the sheet rotates away, and returns as the
      // reverse comes into view — the cue that sells it as paper rather
      // than a flat rectangle spinning.
      const front = frontShadeRef.current
      const back = backShadeRef.current
      if (front) front.style.opacity = String(Math.min(0.55, progress * 1.1))
      if (back) back.style.opacity = String(Math.min(0.5, (1 - progress) * 1.0))

      // The lifted sheet casts onto the spread underneath, strongest when
      // it stands upright.
      const spine = spineShadowRef.current
      if (spine) spine.style.opacity = String(Math.sin(progress * Math.PI) * 0.28)
    },
    [],
  )

  const finishTurn = useCallback(
    (committed: boolean) => {
      const state = turnRef.current
      turnRef.current = null
      setTurn(null)
      progressRef.current = 0
      if (!state || !committed) return
      const step = columns === 2 ? 2 : 1
      onPageIndexChange(
        state.direction === 'forward'
          ? Math.min(totalPages - 1, leftPage + step)
          : Math.max(0, leftPage - step),
      )
    },
    [columns, leftPage, onPageIndexChange, totalPages],
  )

  /** Eases the leaf to 0 or 1 and then commits, without React in the loop. */
  const settle = useCallback(
    (target: 0 | 1) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // Which end of the rotation counts as "turned" depends on direction:
      // a forward turn finishes lying open on the left (1), a backward turn
      // finishes lying flat on the right (0).
      const committedAt = turnRef.current?.direction === 'backward' ? 0 : 1
      const committed = target === committedAt

      const from = progressRef.current
      const distance = Math.abs(target - from)
      if (distance < 0.001) {
        finishTurn(committed)
        return
      }
      const duration = Math.max(140, MAX_SETTLE_MS * distance)
      const start = performance.now()

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const value = from + (target - from) * easeOutCubic(t)
        progressRef.current = value
        paint(value)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step)
        } else {
          rafRef.current = null
          finishTurn(committed)
        }
      }
      rafRef.current = requestAnimationFrame(step)
    },
    [finishTurn, paint],
  )

  const beginTurn = useCallback(
    (direction: Direction): boolean => {
      if (turnRef.current) return false
      if (direction === 'forward' && !canGoForward) return false
      if (direction === 'backward' && !canGoBackward) return false

      const state: TurnState =
        direction === 'forward'
          ? {
              direction,
              frontPage: columns === 2 ? rightPage : leftPage,
              backPage: columns === 2 ? leftPage + 2 : leftPage + 1,
            }
          : {
              direction,
              frontPage: columns === 2 ? leftPage - 1 : leftPage - 1,
              backPage: columns === 2 ? leftPage : leftPage,
            }

      turnRef.current = state
      setTurn(state)
      // Backward turns start lying open on the left and rotate closed.
      progressRef.current = direction === 'forward' ? 0 : 1
      return true
    },
    [canGoBackward, canGoForward, columns, leftPage, rightPage],
  )

  // Paint the starting angle as soon as the leaf mounts, so a backward turn
  // doesn't flash at 0deg (flat on the right) for a frame before jumping.
  useEffect(() => {
    if (turn) paint(progressRef.current)
  }, [turn, paint])

  const jump = useCallback(
    (direction: Direction) => {
      if (!beginTurn(direction)) return
      requestAnimationFrame(() => settle(direction === 'forward' ? 1 : 0))
    },
    [beginTurn, settle],
  )

  function handlePointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const relative = (event.clientX - bounds.left) / bounds.width
    const direction: Direction = relative > 0.5 ? 'forward' : 'backward'
    if (!beginTurn(direction)) return

    draggingRef.current = true
    pointerStartRef.current = event.clientX
    lastMoveRef.current = { x: event.clientX, t: performance.now() }
    velocityRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    leafRef.current?.style.setProperty('will-change', 'transform')
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!draggingRef.current || !turnRef.current) return
    const dx = event.clientX - pointerStartRef.current
    const span = metrics.width

    const base = turnRef.current.direction === 'forward' ? 0 : 1
    const delta = turnRef.current.direction === 'forward' ? -dx / span : -dx / span
    const next = Math.max(0, Math.min(1, base + delta))

    const now = performance.now()
    const dt = now - lastMoveRef.current.t
    if (dt > 0) velocityRef.current = (event.clientX - lastMoveRef.current.x) / dt
    lastMoveRef.current = { x: event.clientX, t: now }

    progressRef.current = next
    paint(next)
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (!draggingRef.current || !turnRef.current) return
    draggingRef.current = false
    leafRef.current?.style.removeProperty('will-change')
    try {
      ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {
      // Capture can already be gone if the pointer left the window.
    }

    const forward = turnRef.current.direction === 'forward'
    const progress = progressRef.current
    const velocity = velocityRef.current

    // A decisive flick wins over position: dragging left (negative velocity)
    // completes a forward turn even if the sheet has barely lifted.
    const flickedComplete = forward ? velocity < -FLICK_VELOCITY : velocity > FLICK_VELOCITY
    const flickedCancel = forward ? velocity > FLICK_VELOCITY : velocity < -FLICK_VELOCITY

    let target: 0 | 1
    if (flickedComplete) target = forward ? 1 : 0
    else if (flickedCancel) target = forward ? 0 : 1
    else if (forward) target = progress > COMMIT_THRESHOLD ? 1 : 0
    else target = progress < 1 - COMMIT_THRESHOLD ? 0 : 1

    settle(target)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        jump('forward')
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        jump('backward')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [jump])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const renderPage = useCallback(
    (index: number, side: 'left' | 'right') => {
      const page = flatPages[index]
      if (!page) return <div className="book-page book-page-blank" style={{ width: metrics.width, height: metrics.height }} />
      return (
        <PageSurface metrics={metrics} pageIndex={page.localIndex} side={side}>
          <ChapterContent chapter={book[page.chapterIndex]} />
        </PageSurface>
      )
    },
    [book, flatPages, metrics],
  )

  const pageNumberFor = (index: number) => (index >= 0 && index < totalPages ? index + 1 : null)

  // While a sheet is lifting, the page it uncovers must already be painted
  // underneath — otherwise you'd see the table through the gap.
  const underRight = turn?.direction === 'forward' ? leftPage + 3 : rightPage
  const underLeft = turn?.direction === 'backward' ? leftPage - 2 : leftPage

  void pageCounts

  return (
    <div
      className={cn('book-stage', columns === 1 && 'book-stage-single')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ width: metrics.width * columns, height: metrics.height }}
    >
      {columns === 2 && (
        <div className="book-side book-side-left">
          {renderPage(underLeft, 'left')}
          <span className="book-folio book-folio-left">{pageNumberFor(underLeft)}</span>
        </div>
      )}

      <div className="book-side book-side-right">
        {renderPage(columns === 2 ? underRight : leftPage, columns === 2 ? 'right' : 'left')}
        <span className="book-folio book-folio-right">
          {pageNumberFor(columns === 2 ? underRight : leftPage)}
        </span>
      </div>

      <div ref={spineShadowRef} className="book-spine-shadow" style={{ opacity: 0 }} />
      {columns === 2 && <div className="book-gutter" />}

      {turn && (
        <div className="book-leaf-anchor" style={{ left: columns === 2 ? metrics.width : 0 }}>
          <div ref={leafRef} className="book-leaf" style={{ width: metrics.width, height: metrics.height }}>
            <div className="book-leaf-face book-leaf-front">
              {renderPage(turn.frontPage, 'right')}
              <span className="book-folio book-folio-right">{pageNumberFor(turn.frontPage)}</span>
              <div ref={frontShadeRef} className="book-leaf-shade" style={{ opacity: 0 }} />
            </div>
            <div className="book-leaf-face book-leaf-back">
              {renderPage(turn.backPage, 'left')}
              <span className="book-folio book-folio-left">{pageNumberFor(turn.backPage)}</span>
              <div ref={backShadeRef} className="book-leaf-shade book-leaf-shade-back" style={{ opacity: 0 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
