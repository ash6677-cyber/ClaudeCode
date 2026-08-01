import { forwardRef, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react'

import { computeCurl } from '@/features/reader/lib/curl-geometry'

/** Segments across the sheet. Enough that the shading gradient reads as a
 * smooth bow rather than visible facets, without paying for more copies of
 * the page than the bend actually needs. */
export const SEGMENT_COUNT = 12

/** Segments are drawn a hair wider than their slot so the hairline gaps that
 * would otherwise open between differently-angled neighbours are covered. */
const SEAM_OVERLAP = 1.2

export interface CurlHandle {
  setProgress: (progress: number) => void
}

interface CurlLeafProps {
  width: number
  height: number
  /** Recto — the face lying to the right of the spine at rest. */
  front: ReactNode
  /** Verso — the reverse, which comes to rest on the left. */
  back: ReactNode
}

/**
 * A page that genuinely bends.
 *
 * The sheet is cut into vertical segments, each a window onto the same page
 * content shifted sideways, and the segments are hinged end to end into an
 * arc. Because every segment carries its own angle, the surface is curved
 * rather than planar, and its shading varies continuously across the bow.
 *
 * The text inside stays live DOM the whole way through — the curve is built
 * out of real transforms rather than by rendering the page to a texture and
 * warping it, so nothing is resampled and nothing softens at high DPI.
 */
export const CurlLeaf = forwardRef<CurlHandle, CurlLeafProps>(function CurlLeaf(
  { width, height, front, back },
  ref,
) {
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([])
  const frontShadeRefs = useRef<(HTMLDivElement | null)[]>([])
  const backShadeRefs = useRef<(HTMLDivElement | null)[]>([])

  const segmentWidth = width / SEGMENT_COUNT
  const indices = useMemo(
    () => Array.from({ length: SEGMENT_COUNT }, (_, index) => index),
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      setProgress(progress: number) {
        const segments = computeCurl(progress, width, SEGMENT_COUNT)
        for (let i = 0; i < SEGMENT_COUNT; i++) {
          const segment = segments[i]
          const node = segmentRefs.current[i]
          if (node) {
            node.style.transform = `translate3d(${segment.x}px, 0, ${segment.z}px) rotateY(${segment.angle}rad)`
          }
          const frontShade = frontShadeRefs.current[i]
          if (frontShade) frontShade.style.opacity = String(segment.frontShade)
          const backShade = backShadeRefs.current[i]
          if (backShade) backShade.style.opacity = String(segment.backShade)
        }
      },
    }),
    [width],
  )

  return (
    <div className="curl-leaf" style={{ width, height }}>
      {indices.map((i) => (
        <div
          key={i}
          ref={(node) => {
            segmentRefs.current[i] = node
          }}
          className="curl-segment"
          style={{ width: segmentWidth + SEAM_OVERLAP, height }}
        >
          <div className="curl-face curl-face-front">
            <div
              className="curl-slide"
              style={{ width, transform: `translateX(${-i * segmentWidth}px)` }}
            >
              {front}
            </div>
            <div
              ref={(node) => {
                frontShadeRefs.current[i] = node
              }}
              className="curl-shade"
            />
          </div>

          <div className="curl-face curl-face-back">
            <div
              className="curl-slide"
              style={{
                width,
                // Counted from the sheet's free edge: flipping the sheet
                // reverses which end of the verso meets the spine.
                transform: `translateX(${-(SEGMENT_COUNT - 1 - i) * segmentWidth}px)`,
              }}
            >
              {back}
            </div>
            <div
              ref={(node) => {
                backShadeRefs.current[i] = node
              }}
              className="curl-shade"
            />
          </div>
        </div>
      ))}
    </div>
  )
})
