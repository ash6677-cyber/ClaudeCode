import { getEditorFont } from '@/lib/editor/fonts'
import type { Cover, CoverTypographyLayer } from '@/types'

import { ASPECT_DIMENSIONS } from './aspect'

export function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** CSS background-image value replicating the overlay for the live preview. */
export function overlayCssBackground(overlay: Cover['overlay']): string | undefined {
  if (!overlay.enabled) return undefined
  if (overlay.direction === 'full') return hexWithAlpha(overlay.color, overlay.opacity)
  const from = hexWithAlpha(overlay.color, 0)
  const to = hexWithAlpha(overlay.color, overlay.opacity)
  return overlay.direction === 'bottom'
    ? `linear-gradient(to bottom, ${from} 40%, ${to} 100%)`
    : `linear-gradient(to top, ${from} 40%, ${to} 100%)`
}

function drawCoverBackground(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  crop: Cover['crop'],
) {
  const baseScale = Math.max(canvasW / image.width, canvasH / image.height)
  const scaledW = image.width * baseScale
  const scaledH = image.height * baseScale
  const offsetX = (canvasW - scaledW) * (crop.x / 100)
  const offsetY = (canvasH - scaledH) * (crop.y / 100)

  ctx.save()
  ctx.translate(canvasW / 2, canvasH / 2)
  ctx.rotate((crop.rotation * Math.PI) / 180)
  ctx.scale(crop.zoom, crop.zoom)
  ctx.translate(-canvasW / 2, -canvasH / 2)
  ctx.drawImage(image, offsetX, offsetY, scaledW, scaledH)
  ctx.restore()
}

function drawOverlay(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, overlay: Cover['overlay']) {
  if (!overlay.enabled) return
  if (overlay.direction === 'full') {
    ctx.fillStyle = hexWithAlpha(overlay.color, overlay.opacity)
    ctx.fillRect(0, 0, canvasW, canvasH)
    return
  }
  const bottom = overlay.direction === 'bottom'
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasH)
  const from = hexWithAlpha(overlay.color, 0)
  const to = hexWithAlpha(overlay.color, overlay.opacity)
  if (bottom) {
    gradient.addColorStop(0, from)
    gradient.addColorStop(0.4, from)
    gradient.addColorStop(1, to)
  } else {
    gradient.addColorStop(0, to)
    gradient.addColorStop(0.6, from)
    gradient.addColorStop(1, from)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvasW, canvasH)
}

function drawTypographyLayer(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  layer: CoverTypographyLayer,
) {
  if (!layer.text.trim()) return
  const fontPx = (layer.fontSize / 100) * canvasW
  const font = getEditorFont(layer.fontFamily)
  ctx.save()
  ctx.font = `${layer.fontWeight} ${fontPx}px ${font.cssFamily}`
  ctx.fillStyle = layer.color
  ctx.textAlign = layer.align
  ctx.textBaseline = 'middle'
  const letterSpacingPx = (layer.letterSpacing / 100) * fontPx
  if ('letterSpacing' in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacingPx}px`
  }
  if (layer.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = fontPx * 0.15
    ctx.shadowOffsetY = fontPx * 0.04
  }
  const x = (layer.x / 100) * canvasW
  const y = (layer.y / 100) * canvasH
  const lines = layer.text.split('\n')
  const lineHeight = fontPx * 1.2
  const startY = y - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight))
  ctx.restore()
}

export function renderCoverToCanvas(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  image: HTMLImageElement | null,
  cover: Cover,
) {
  ctx.clearRect(0, 0, canvasW, canvasH)
  ctx.fillStyle = '#1a1a1f'
  ctx.fillRect(0, 0, canvasW, canvasH)
  if (image) drawCoverBackground(ctx, image, canvasW, canvasH, cover.crop)
  drawOverlay(ctx, canvasW, canvasH, cover.overlay)
  for (const layer of cover.typography) drawTypographyLayer(ctx, canvasW, canvasH, layer)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the source image'))
    img.src = url
  })
}

export async function exportCoverPng(cover: Cover, sourceImageUrl: string | null): Promise<Blob> {
  const { w, h } = ASPECT_DIMENSIONS[cover.aspectPreset]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser')

  const image = sourceImageUrl ? await loadImage(sourceImageUrl) : null
  renderCoverToCanvas(ctx, w, h, image, cover)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not export the cover image'))
    }, 'image/png')
  })
}
