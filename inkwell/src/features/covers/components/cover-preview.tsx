import { ImageOff } from 'lucide-react'
import { useRef, useState } from 'react'

import { getEditorFont } from '@/lib/editor/fonts'
import { cn } from '@/lib/utils'
import type { Cover, CoverTypographyLayer } from '@/types'

import { ASPECT_DIMENSIONS } from '../lib/aspect'
import { overlayCssBackground } from '../lib/render-cover'

interface CoverPreviewProps {
  cover: Cover
  imageUrl: string | null
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onCommitLayerPosition: (id: string, x: number, y: number) => void
  className?: string
}

export function CoverPreview({
  cover,
  imageUrl,
  selectedLayerId,
  onSelectLayer,
  onCommitLayerPosition,
  className,
}: CoverPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<{ id: string; x: number; y: number } | null>(null)
  const { w, h } = ASPECT_DIMENSIONS[cover.aspectPreset]

  function handlePointerDown(e: React.PointerEvent, layer: CoverTypographyLayer) {
    e.stopPropagation()
    onSelectLayer(layer.id)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragState({ id: layer.id, x: layer.x, y: layer.y })
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    setDragState({ id: dragState.id, x, y })
  }

  function handlePointerUp() {
    if (!dragState) return
    onCommitLayerPosition(dragState.id, dragState.x, dragState.y)
    setDragState(null)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden rounded-lg border border-border bg-muted shadow-lg',
        className,
      )}
      style={{ aspectRatio: `${w} / ${h}`, containerType: 'inline-size' }}
      onClick={() => onSelectLayer(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {imageUrl ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: `${cover.crop.x}% ${cover.crop.y}%`,
            transform: `scale(${cover.crop.zoom}) rotate(${cover.crop.rotation}deg)`,
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
            onPointerDown={(e) => handlePointerDown(e, layer)}
            className={cn(
              'absolute max-w-[90%] cursor-move select-none whitespace-pre-wrap px-1 outline-dashed outline-1 outline-transparent hover:outline-primary/50',
              selectedLayerId === layer.id && 'outline-primary',
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
