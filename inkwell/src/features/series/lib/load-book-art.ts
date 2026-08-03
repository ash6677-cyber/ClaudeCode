/**
 * Getting each book's cover art out of storage and into a form the renderer
 * can paint with.
 *
 * A project's art can be in one of three states, and the box set has to look
 * finished in all of them: an exported cover PNG from Cover Studio, a source
 * image with a cover design that was never exported, or nothing at all.
 */

import { renderCoverToCanvas } from '@/features/covers/lib/render-cover'
import { ASPECT_DIMENSIONS } from '@/features/covers/lib/aspect'
import { db } from '@/lib/db/schema'
import type { Cover, Project } from '@/types'

import type { BoxSetBook } from './box-set-scene'

interface LoadedArt {
  source: CanvasImageSource
  width: number
  height: number
}

function decode(blob: Blob): Promise<LoadedArt | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

/**
 * Redraws a cover design that was never exported.
 *
 * Cover Studio only writes a PNG when the writer presses export, so a design
 * that has been composed but not exported would otherwise show as a blank
 * jacket in the box set even though the app plainly knows what it looks like.
 * Re-running the same renderer the studio uses keeps the two identical.
 */
async function renderUnexported(cover: Cover): Promise<LoadedArt | null> {
  const source = cover.sourceImageId ? await db.imageAssets.get(cover.sourceImageId) : undefined
  const art = source ? await decode(source.blob) : null

  const { w, h } = ASPECT_DIMENSIONS[cover.aspectPreset]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  renderCoverToCanvas(ctx, w, h, (art?.source as HTMLImageElement) ?? null, cover)
  return { source: canvas, width: w, height: h }
}

/** Resolves the best available art for one project. */
export async function loadBookArt(project: Project): Promise<LoadedArt | null> {
  if (!project.coverId) return null
  const cover = await db.covers.get(project.coverId)
  if (!cover) return null

  if (cover.exportedImageId) {
    const exported = await db.imageAssets.get(cover.exportedImageId)
    if (exported) {
      const decoded = await decode(exported.blob)
      if (decoded) return decoded
    }
  }

  return renderUnexported(cover)
}

/**
 * Turns the ordered books of a series into renderer input.
 *
 * Art is loaded in parallel and a failure for one book is not allowed to
 * take out the set: a cover that won't decode simply becomes a typographic
 * jacket, which is the same thing that happens to a book with no art.
 */
export async function loadBoxSetBooks(
  projects: Project[],
  wordCounts: Record<string, number>,
): Promise<BoxSetBook[]> {
  const art = await Promise.all(
    projects.map((project) => loadBookArt(project).catch(() => null)),
  )

  return projects.map((project, index) => ({
    projectId: project.id,
    title: project.title,
    author: project.author,
    wordCount: wordCounts[project.id] ?? 0,
    volume: index + 1,
    cover: art[index],
  }))
}
