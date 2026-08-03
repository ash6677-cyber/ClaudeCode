import { spineThicknessCm } from '@/features/series/lib/box-set-layout'
import { clothColorsFor, readableInk, shade } from '@/features/series/lib/palette'
import { cn } from '@/lib/utils'

interface SpineStripProps {
  books: { id: string; title: string; wordCount: number }[]
  caseColor: string
  className?: string
}

/**
 * The series card's thumbnail: a row of spines, in proportion, in plain CSS.
 *
 * Deliberately not the 3D scene. Every WebGL canvas is its own renderer with
 * its own context, and browsers cap how many can exist at once — a list of
 * series would either exhaust that limit or spend a GPU on thumbnails nobody
 * is looking at. The widths still come from the same physical model as the
 * real thing, so a fat book looks fat here too.
 */
export function SpineStrip({ books, caseColor, className }: SpineStripProps) {
  const widths = books.map((book) => spineThicknessCm(book.wordCount))
  const colors = clothColorsFor(books.map((book) => book.id))
  const total = widths.reduce((sum, w) => sum + w, 0)

  return (
    <div
      className={cn('flex h-32 items-end gap-px overflow-hidden px-4 pt-5', className)}
      style={{ background: `linear-gradient(160deg, ${shade(caseColor, 0.12)}, ${shade(caseColor, -0.3)})` }}
      aria-hidden
    >
      {books.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center pb-5">
          <span className="text-xs" style={{ color: readableInk(caseColor), opacity: 0.65 }}>
            Empty case
          </span>
        </div>
      ) : (
        books.map((book, index) => {
          const color = colors[index]
          return (
            <div
              key={book.id}
              className="h-full min-w-[6px] rounded-t-[2px] shadow-[inset_-2px_0_4px_rgba(0,0,0,0.35)]"
              style={{
                // Proportional to real spine width, so the strip reads as the
                // same set the 3D view shows.
                flexGrow: widths[index] / (total || 1),
                flexBasis: 0,
                background: `linear-gradient(90deg, ${shade(color, -0.25)}, ${color} 32%, ${shade(color, -0.18)})`,
              }}
            />
          )
        })
      )}
    </div>
  )
}
