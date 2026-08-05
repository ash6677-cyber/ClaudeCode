import { ImageOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getEditorFont } from '@/lib/editor/fonts'
import { cn } from '@/lib/utils'
import type { Cover, CoverTypographyLayer } from '@/types'

import { ASPECT_DIMENSIONS } from '../lib/aspect'
import {
  coverGeometry,
  panCrop,
  wheelZoomFactor,
  zoomBy,
  type Box,
} from '../lib/crop-geometry'
import { overlayCssBackground } from '../lib/render-cover'

interface CoverPreviewProps {
  cover: Cover
  imageUrl: string | null
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onCommitLayerPosition: (id: string, x: number, y: number) => void
  /** Framing the image by hand, writing the same fields the sliders write. */
  onCropChange?: (crop: Partial<Cover['crop']>) => void
  className?: string
}

/** The image's own dimensions, which the geometry cannot be worked out without. */
function useNaturalSize(url: string | null): Box | null {
  const [loaded, setLoaded] = useState<{ url: string; size: Box } | null>(null)
  useEffect(() => {
    if (!url) return
    let live = true
    const img = new Image()
    img.onload = () => {
      if (live) setLoaded({ url, size: { w: img.naturalWidth, h: img.naturalHeight } })
    }
    img.src = url
    return () => {
      live = false
    }
  }, [url])
  // Compared against the current url during render rather than cleared in an
  // effect: swapping the image would otherwise lay the new one out with the
  // old one's dimensions for a frame, which reads as a jump.
  return loaded && loaded.url === url ? loaded.size : null
}

/** The preview's size on screen, which changes with the window and the panel. */
function useMeasuredSize(ref: React.RefObject<HTMLElement | null>): Box {
  const [size, setSize] = useState<Box>({ w: 0, h: 0 })
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect
      setSize({ w: rect.width, h: rect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return size
}

export function CoverPreview({
  cover,
  imageUrl,
  selectedLayerId,
  onSelectLayer,
  onCommitLayerPosition,
  onCropChange,
  className,
}: CoverPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<{ id: string; x: number; y: number } | null>(null)
  const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  /** Which layer a press began on, and whether it turned into a drag. */
  const tapTargetRef = useRef<string | null>(null)
  const movedRef = useRef(false)
  const { w, h } = ASPECT_DIMENSIONS[cover.aspectPreset]

  const natural = useNaturalSize(imageUrl)
  const measured = useMeasuredSize(containerRef)
  const geometry = natural ? coverGeometry(measured, natural, cover.crop) : null
  const canPan = Boolean(onCropChange && geometry && (geometry.freeX > 0 || geometry.freeY > 0))

  /**
   * A pointer that landed on a piece of text.
   *
   * Two gestures share one surface, and which is which is decided by what is
   * already selected. A title sits in the middle of a cover and is the
   * largest thing on it, so "text always wins" would mean the picture behind
   * it could never be moved at all — which is exactly what the first version
   * of this did.
   *
   * Selection itself happens on release, and only if nothing moved. Doing it
   * on the press instead made a single drag across the title select it, so
   * the *next* drag moved the text rather than the picture — a rule nobody
   * could learn because it depended on what the last gesture had been.
   */
  function handleLayerPointerDown(e: React.PointerEvent, layer: CoverTypographyLayer) {
    tapTargetRef.current = layer.id
    if (selectedLayerId !== layer.id) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragState({ id: layer.id, x: layer.x, y: layer.y })
  }

  /**
   * Dragging the picture itself.
   *
   * Started on the container rather than the image layer because the image
   * layer sits under the text and would never see the pointer. A drag that
   * begins on a text layer stops there — the two gestures look identical and
   * only the starting point tells them apart.
   */
  function handleBackgroundPointerDown(e: React.PointerEvent) {
    // The layer handler runs first, at the target, and has already left
    // behind which layer this press began on; nothing means the picture.
    movedRef.current = false

    if (!onCropChange || !geometry) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    panRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const pan = panRef.current
    if (pan && pan.pointerId === e.pointerId && geometry && onCropChange) {
      const dx = e.clientX - pan.x
      const dy = e.clientY - pan.y
      if (dx === 0 && dy === 0) return
      movedRef.current = true
      panRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
      onCropChange(panCrop(cover.crop, geometry, dx, dy))
      return
    }
    if (!dragState || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    setDragState({ id: dragState.id, x, y })
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (panRef.current?.pointerId === e.pointerId) panRef.current = null
    // A press that never moved was a tap, and a tap is how selection changes
    // — including a tap on the picture, which is how everything deselects.
    if (!movedRef.current && !dragState) onSelectLayer(tapTargetRef.current)
    tapTargetRef.current = null
    movedRef.current = false
    if (!dragState) return
    onCommitLayerPosition(dragState.id, dragState.x, dragState.y)
    setDragState(null)
  }

  function handleWheel(e: React.WheelEvent) {
    if (!onCropChange) return
    // Not preventDefault: the panel scrolls, and stealing every wheel event
    // over a tall preview would trap the page. Ctrl or ⌘ is the universal
    // "this one is a zoom" — the same signal a browser's own zoom uses.
    if (!e.ctrlKey && !e.metaKey) return
    onCropChange({ zoom: zoomBy(cover.crop.zoom, wheelZoomFactor(e.deltaY)) })
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden rounded-lg border border-border bg-muted shadow-lg',
        canPan && 'touch-none',
        className,
      )}
      data-testid="cover-surface"
      style={{ aspectRatio: `${w} / ${h}`, containerType: 'inline-size' }}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      {imageUrl ? (
        <div
          aria-hidden
          data-testid="cover-image"
          className={cn('absolute inset-0', canPan && 'cursor-grab')}
          style={{
            backgroundImage: `url(${imageUrl})`,
            // Laid out in pixels from the shared geometry rather than by
            // `cover` plus a transform, so the preview and the exported PNG
            // are the same arithmetic instead of two that happened to agree.
            ...(geometry
              ? {
                  backgroundSize: `${geometry.w}px ${geometry.h}px`,
                  backgroundPosition: `${geometry.x}px ${geometry.y}px`,
                }
              : { backgroundSize: 'cover', backgroundPosition: 'center' }),
            backgroundRepeat: 'no-repeat',
            transform: `rotate(${cover.crop.rotation}deg)`,
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
          <ImageOff className="size-10 text-muted-foreground/40" strokeWidth={1.25} />
        </div>
      )}

      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: overlayCssBackground(cover.overlay) }} />

      {cover.typography.map((layer) => {
        const font = getEditorFont(layer.fontFamily)
        const pos = dragState?.id === layer.id ? dragState : layer
        return (
          <div
            key={layer.id}
            onPointerDown={(e) => handleLayerPointerDown(e, layer)}
            className={cn(
              'absolute max-w-[90%] select-none whitespace-pre-wrap px-1 outline-dashed outline-1 outline-transparent hover:outline-primary/50',
              selectedLayerId === layer.id ? 'cursor-move outline-primary' : 'cursor-pointer',
            )}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              fontFamily: font.cssFamily,
              fontSize: `${layer.fontSize}cqw`,
              fontWeight: layer.fontWeight,
              color: layer.color,
              letterSpacing: `${(layer.letterSpacing / 100) * layer.fontSize}cqw`,
              textAlign: layer.align,
              textShadow: layer.shadow ? '0 0.4cqw 1.2cqw rgba(0,0,0,0.6)' : undefined,
              lineHeight: 1.2,
            }}
          >
            {layer.text || 'Text'}
          </div>
        )
      })}
    </div>
  )
}
