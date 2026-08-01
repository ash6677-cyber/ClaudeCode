import { useCallback, useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

/** Gap between adjacent columns in the flow. Never visible — pages are
 * clipped to exactly one column — but it must be non-zero so a glyph can't
 * straddle the boundary between two pages. */
export const COLUMN_GAP = 64

export interface PageMetrics {
  width: number
  height: number
  padTop: number
  padBottom: number
  padOuter: number
  padSpine: number
}

function columnWidth(metrics: PageMetrics): number {
  return metrics.width - metrics.padOuter - metrics.padSpine
}

/**
 * One page of the book.
 *
 * The whole chapter is laid out once as a CSS multi-column flow and this
 * clips to a single column, sliding the flow sideways to choose which page
 * is showing. That keeps the text as real, selectable, resolution-
 * independent DOM — it re-flows on resize and stays sharp at any DPI —
 * where rendering pages to images or canvas would pin them to one
 * resolution and blur on a high-DPI display.
 */
export function PageSurface({
  metrics,
  pageIndex,
  side,
  children,
  className,
  onPageCount,
}: {
  metrics: PageMetrics
  pageIndex: number
  side: 'left' | 'right'
  children: React.ReactNode
  className?: string
  /** Called with the number of pages this content flows into. */
  onPageCount?: (count: number) => void
}) {
  const flowRef = useRef<HTMLDivElement | null>(null)
  const colWidth = columnWidth(metrics)

  const measure = useCallback(() => {
    const flow = flowRef.current
    if (!flow || !onPageCount) return
    // scrollWidth spans every column the content spilled into, including
    // the ones overflowing the clipped box.
    const span = flow.scrollWidth + COLUMN_GAP
    const count = Math.max(1, Math.round(span / (colWidth + COLUMN_GAP)))
    onPageCount(count)
  }, [colWidth, onPageCount])

  useLayoutEffect(measure)

  return (
    <div
      className={cn('book-page', className)}
      style={{
        width: metrics.width,
        height: metrics.height,
        paddingTop: metrics.padTop,
        paddingBottom: metrics.padBottom,
        paddingLeft: side === 'left' ? metrics.padOuter : metrics.padSpine,
        paddingRight: side === 'left' ? metrics.padSpine : metrics.padOuter,
      }}
    >
      <div
        ref={flowRef}
        className="book-flow"
        style={{
          width: colWidth,
          height: metrics.height - metrics.padTop - metrics.padBottom,
          columnWidth: colWidth,
          columnGap: COLUMN_GAP,
          transform: `translateX(-${pageIndex * (colWidth + COLUMN_GAP)}px)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
