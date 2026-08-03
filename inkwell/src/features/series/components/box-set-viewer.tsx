import { Download, Loader2, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  createBoxSetScene,
  type BoxSetBook,
  type BoxSetScene,
} from '@/features/series/lib/box-set-scene'
import {
  applyDrag,
  applyFlick,
  applyZoom,
  createOrbitState,
  stepOrbit,
  type OrbitState,
} from '@/features/series/lib/orbit-camera'
import type { SeriesBoxSet } from '@/types'

/**
 * Live view is capped at 2× device pixels.
 *
 * Beyond that the extra samples are past what any display resolves while
 * costing four times the fill rate per step — on a 3× phone that is the
 * difference between a set that turns smoothly under your finger and one
 * that stutters. The export path is uncapped, which is where the resolution
 * actually matters.
 */
const MAX_LIVE_PIXEL_RATIO = 2

/** Full UHD, the size the export is advertised as. */
const EXPORT_WIDTH = 3840
const EXPORT_HEIGHT = 2160

/** Movement past which a press counts as a drag rather than a tap. */
const TAP_SLOP_PX = 6

interface BoxSetViewerProps {
  books: BoxSetBook[]
  seriesName: string
  author: string
  boxSet: SeriesBoxSet
  /** Called when a book is drawn out of the case or put back. */
  onSelect?: (projectId: string | null) => void
}

export function BoxSetViewer({ books, seriesName, author, boxSet, onSelect }: BoxSetViewerProps) {
  // The scene is rebuilt whenever its inputs change, and rebuilding means
  // repainting every cover, spine and case panel from scratch. `boxSet`
  // arrives as a fresh object on every refetch of the series even when not a
  // single value in it differs, so depending on its identity threw the whole
  // set away and rebuilt it each time anything else on the screen changed.
  // Rebuilding on the values instead means it happens when the printing
  // actually changes and at no other time.
  const { caseColor, foilColor, finish, reveal } = boxSet
  const printing = useMemo(
    () => ({ caseColor, foilColor, finish, reveal }),
    [caseColor, foilColor, finish, reveal],
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<BoxSetScene | null>(null)
  const orbitRef = useRef<OrbitState>(createOrbitState(60))
  const frameRef = useRef(0)
  /** Set whenever something changed and the canvas needs repainting. */
  const dirtyRef = useRef(true)

  // Probed once, in a lazy initializer rather than in an effect: whether
  // this browser can do WebGL at all is known before the first paint, and
  // discovering it afterwards would mean rendering a canvas and then
  // replacing it. The probe uses a throwaway canvas, never the one being
  // rendered into — a canvas hands back the same context for every later
  // `getContext` call whatever attributes are asked for, so probing the real
  // one would silently lock in the defaults and leave the renderer with no
  // antialiasing and no alpha, with no error to say why.
  const [webglAvailable] = useState(detectWebGL)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const requestFrame = useCallback(() => {
    dirtyRef.current = true
  }, [])

  // ---- scene lifecycle -------------------------------------------------
  // Rebuilt whenever the contents or the printing change. Every texture in
  // it is painted from these inputs, so there is nothing to update in place.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // A failure here despite WebGL being present is genuinely exceptional —
    // out of GPU memory, a driver fault — and belongs to the route's error
    // boundary rather than being caught and turned into a second, vaguer
    // version of the message below.
    const scene = createBoxSetScene({
      canvas,
      books,
      seriesName,
      author,
      boxSet: printing,
    })
    sceneRef.current = scene

    const parent = canvas.parentElement
    const applySize = () => {
      const width = parent?.clientWidth ?? canvas.clientWidth
      const height = parent?.clientHeight ?? canvas.clientHeight
      if (width < 2 || height < 2) return
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_LIVE_PIXEL_RATIO)
      scene.resize(width, height, ratio)
      orbitRef.current = {
        ...orbitRef.current,
        distance: scene.framingDistanceFor(width / height),
      }
      dirtyRef.current = true
    }

    applySize()
    const observer = new ResizeObserver(applySize)
    if (parent) observer.observe(parent)

    let previous = performance.now()
    const tick = (now: number) => {
      frameRef.current = requestAnimationFrame(tick)
      const dt = Math.min((now - previous) / 1000, 0.25)
      previous = now

      const orbit = stepOrbit(orbitRef.current, dt)
      if (orbit !== orbitRef.current) {
        orbitRef.current = orbit
        dirtyRef.current = true
      }
      if (scene.step(dt)) dirtyRef.current = true

      // Repainting only on change: a box set sitting still is a static image,
      // and holding a GPU at 60fps to redraw it identically drains a laptop
      // battery for nothing.
      if (!dirtyRef.current) return
      dirtyRef.current = false
      scene.setOrbit(orbitRef.current)
      scene.render()
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
  }, [webglAvailable, books, seriesName, author, printing])

  // ---- pointer handling ------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /** Live pointers, so a second finger can be told from the first. */
    const active = new Map<number, { x: number; y: number }>()
    /** Last sampled drag speed, in pixels per second, for the release flick. */
    const velocity = { x: 0, y: 0 }
    let last = { x: 0, y: 0, t: 0 }
    let travelled = 0
    let pinchDistance = 0

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId)
      active.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (active.size === 1) {
        last = { x: event.clientX, y: event.clientY, t: event.timeStamp }
        travelled = 0
        // Grabbing a coasting set stops it, the way catching a spinning globe
        // does. `applyDrag` of nothing is exactly that.
        orbitRef.current = applyDrag(orbitRef.current, 0, 0)
        dirtyRef.current = true
      } else if (active.size === 2) {
        pinchDistance = spanOf(active)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!active.has(event.pointerId)) return
      active.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (active.size >= 2) {
        const span = spanOf(active)
        if (pinchDistance > 0 && span > 0) {
          const scene = sceneRef.current
          if (scene) {
            orbitRef.current = applyZoom(
              orbitRef.current,
              pinchDistance / span,
              scene.distanceLimits(),
            )
            dirtyRef.current = true
          }
        }
        pinchDistance = span
        return
      }

      const dx = event.clientX - last.x
      const dy = event.clientY - last.y
      travelled += Math.hypot(dx, dy)
      orbitRef.current = applyDrag(orbitRef.current, dx, dy)
      dirtyRef.current = true

      const dt = Math.max(1, event.timeStamp - last.t) / 1000
      last = { x: event.clientX, y: event.clientY, t: event.timeStamp }
      velocity.x = dx / dt
      velocity.y = dy / dt
    }

    const onPointerUp = (event: PointerEvent) => {
      const scene = sceneRef.current
      const wasSingle = active.size === 1
      active.delete(event.pointerId)
      if (active.size < 2) pinchDistance = 0
      if (!wasSingle || !scene) return

      if (travelled <= TAP_SLOP_PX) {
        // A tap, not a drag: draw that volume out of the case.
        const rect = canvas.getBoundingClientRect()
        const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
        const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
        const hit = scene.pick(ndcX, ndcY)
        scene.togglePulled(hit)
        onSelect?.(scene.pulledProjectId())
        dirtyRef.current = true
        return
      }

      // Only a gesture still moving at release throws the set; letting go of
      // a stationary finger after a slow drag should leave it exactly there.
      if (event.timeStamp - last.t < 120) {
        orbitRef.current = applyFlick(orbitRef.current, velocity.x, velocity.y)
        dirtyRef.current = true
      }
    }

    const onWheel = (event: WheelEvent) => {
      const scene = sceneRef.current
      if (!scene) return
      event.preventDefault()
      // Exponential in the wheel delta so a trackpad's many small events and
      // a mouse's few large ones cover the same ground for the same gesture.
      orbitRef.current = applyZoom(
        orbitRef.current,
        Math.exp(event.deltaY * 0.0012),
        scene.distanceLimits(),
      )
      dirtyRef.current = true
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [onSelect])

  const resetView = useCallback(() => {
    const scene = sceneRef.current
    const canvas = canvasRef.current
    if (!scene || !canvas) return
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    orbitRef.current = createOrbitState(scene.framingDistanceFor(aspect))
    scene.togglePulled(null)
    onSelect?.(null)
    dirtyRef.current = true
  }, [onSelect])

  const exportImage = useCallback(async () => {
    const scene = sceneRef.current
    if (!scene) return
    setExporting(true)
    try {
      // Let the spinner reach the screen first. Rendering 8.3 million pixels
      // and encoding them blocks the main thread in one go, so without a
      // paint in between the button would still look idle for the whole wait
      // and then jump straight to "saved" — on slower hardware, several
      // seconds of the app looking like it ignored the click.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const blob = await scene.renderToBlob(EXPORT_WIDTH, EXPORT_HEIGHT)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${slug(seriesName) || 'box-set'}-4k.png`
      link.click()
      URL.revokeObjectURL(url)
      toast({ title: `Saved a ${EXPORT_WIDTH}×${EXPORT_HEIGHT} render` })
    } catch {
      toast({ title: 'Could not export the render', variant: 'destructive' })
    } finally {
      setExporting(false)
      // The export borrows the renderer's size and hands it back; repaint so
      // the live view is definitely showing the restored one.
      requestFrame()
    }
  }, [seriesName, toast, requestFrame])

  if (!webglAvailable) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">The 3D box set can’t run here</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This browser has no WebGL support, or it is switched off. Everything else about the
          series works normally — the books, their order and their covers are all unaffected.
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        aria-label={`3D box set for ${seriesName}. Drag to turn it, scroll to zoom, tap a book to take it out.`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <p className="rounded-md bg-background/70 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          Drag to turn · scroll to zoom · tap a book
        </p>
        <div className="pointer-events-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={resetView}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button size="sm" className="gap-1.5" onClick={exportImage} disabled={exporting}>
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            4K image
          </Button>
        </div>
      </div>
    </div>
  )
}

function spanOf(pointers: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...pointers.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function detectWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'))
  } catch {
    return false
  }
}
