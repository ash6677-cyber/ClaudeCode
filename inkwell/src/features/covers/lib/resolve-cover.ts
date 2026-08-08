/**
 * What a book's cover looks like, right now.
 *
 * There is one design per project, and it lives in the `covers` table linked
 * by `Cover.projectId`. Everything that draws a cover — the shelf, the box
 * set, anything added later — resolves it through here, so all of them agree
 * and none of them has to know how a cover is stored.
 *
 * Two rules make that work:
 *
 * Found by `Cover.projectId`, never by `Project.coverId`. That field holds the
 * id of the last PNG the writer exported, which is a different thing wearing a
 * similar name; reading it as a cover-record id is what made the box set draw
 * blank jackets for books that plainly had art.
 *
 * Drawn from the design, never from the exported PNG. A design that was never
 * exported still has to appear, and one edited after exporting has to appear
 * as it is now rather than as it was when the writer last pressed a button
 * whose actual job is downloading a file. Rendering the live design is the
 * only answer that is right in both cases, and it is the same renderer the
 * studio previews with, so what you see there is what you get everywhere.
 */

import { renderCoverToCanvas } from '@/features/covers/lib/render-cover'
import { ASPECT_DIMENSIONS } from '@/features/covers/lib/aspect'
import { db } from '@/lib/db/schema'
import type { Cover } from '@/types'

export interface CoverArt {
  source: CanvasImageSource
  width: number
  height: number
}

/**
 * Whether there is anything to draw.
 *
 * Merely opening Cover Studio creates a blank cover record, so a record
 * existing is not evidence the writer designed anything. Without this, every
 * book they ever glanced at would show a dark grey rectangle on the shelf
 * where a book with no cover shows its title instead.
 */
export function coverIsEmpty(cover: Cover): boolean {
  return (
    cover.sourceImageId === null &&
    !cover.typography.some((layer) => layer.text.trim().length > 0)
  )
}

/**
 * The design for a project, by the link that cannot be mistaken for another.
 *
 * A project can hold several designs now, and the one marked active is the
 * one the book wears — everywhere at once, which is the whole point of the
 * flag. Newest active wins if two devices marked different ones while offline.
 * With no flag anywhere (every row predates variants, or a sync dropped it),
 * the newest row stands in, which is exactly the old behaviour — so a library
 * from before variants keeps the cover it had without any migration step.
 */
export function pickCoverFor(covers: Cover[], projectId: string): Cover | undefined {
  let bestActive: Cover | undefined
  let bestAny: Cover | undefined
  for (const cover of covers) {
    if (cover.projectId !== projectId) continue
    if (!bestAny || cover.updatedAt > bestAny.updatedAt) bestAny = cover
    if (cover.active && (!bestActive || cover.updatedAt > bestActive.updatedAt)) bestActive = cover
  }
  return bestActive ?? bestAny
}

/** What a design is called, including the rows made before names existed. */
export function coverDisplayName(cover: Cover, index: number): string {
  return cover.name?.trim() || `Cover ${index + 1}`
}

export async function findCoverForProject(projectId: string): Promise<Cover | undefined> {
  return pickCoverFor(await db.covers.toArray(), projectId)
}

function decodeImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

/**
 * Decoded art, shared between everything asking for the same thing.
 *
 * Ten project cards on the shelf and ten jackets in the box set are twenty
 * requests for ten images. Keyed by the cover's `updatedAt` so any edit misses
 * the cache on its own — there is no invalidation to get wrong — and holding
 * the promise rather than the result so simultaneous callers wait on one
 * decode instead of starting their own.
 */
const cache = new Map<string, Promise<CoverArt | null>>()
const CACHE_LIMIT = 48

function remember(key: string, work: () => Promise<CoverArt | null>): Promise<CoverArt | null> {
  const hit = cache.get(key)
  if (hit) return hit
  const pending = work()
  cache.set(key, pending)
  // A failed decode must not be remembered as the answer forever; the source
  // image may simply not have finished syncing down yet.
  void pending.then((art) => {
    if (art === null) cache.delete(key)
  })
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  return pending
}

/** Drops everything cached. Only needed when storage is replaced wholesale. */
export function forgetCoverArt(): void {
  cache.clear()
}

async function draw(cover: Cover, width: number): Promise<CoverArt | null> {
  const aspect = ASPECT_DIMENSIONS[cover.aspectPreset]
  // Every part of the renderer is expressed as a fraction of the canvas, so a
  // thumbnail is the full design at a smaller size rather than a cropped or
  // differently laid out one.
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round((w * aspect.h) / aspect.w))

  const asset = cover.sourceImageId ? await db.imageAssets.get(cover.sourceImageId) : undefined
  const image = asset ? await decodeImage(asset.blob) : null

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  renderCoverToCanvas(ctx, w, h, image, cover)
  return { source: canvas, width: w, height: h }
}

/**
 * A project's cover as something a canvas can paint, or null if it has none.
 *
 * `width` is the widest the art will ever be drawn. Ask for what you need: the
 * shelf wants a thumbnail and the box set wants print resolution, and there is
 * no reason for the shelf to pay for the latter.
 */
export async function resolveCoverArt(
  projectId: string,
  width?: number,
): Promise<CoverArt | null> {
  const cover = await findCoverForProject(projectId)
  if (!cover || coverIsEmpty(cover)) return null
  const target = width ?? ASPECT_DIMENSIONS[cover.aspectPreset].w
  return remember(`${cover.id}:${cover.updatedAt}:${Math.round(target)}`, () =>
    draw(cover, target),
  )
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** The same art as a PNG, for anywhere an `<img>` is wanted over a canvas. */
export async function resolveCoverThumbnail(
  projectId: string,
  width: number,
): Promise<Blob | null> {
  const art = await resolveCoverArt(projectId, width)
  if (!art || !(art.source instanceof HTMLCanvasElement)) return null
  return toBlob(art.source)
}
