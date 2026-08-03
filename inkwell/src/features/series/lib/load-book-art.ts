/**
 * Getting each book's cover art into a form the box set renderer can paint
 * with.
 *
 * The resolving is not done here — `resolveCoverArt` owns that, so the jackets
 * in the box set are the same art the shelf shows and the studio previews.
 * What is left is turning a series of projects into renderer input, and doing
 * it in a way that survives one book's art being missing or broken.
 */

import { resolveCoverArt, type CoverArt } from '@/features/covers/lib/resolve-cover'
import type { Project } from '@/types'

import type { BoxSetBook } from './box-set-scene'

/**
 * Jackets are printed onto the box set at full size and then seen close up as
 * the writer turns it, so they are resolved at print width rather than at
 * whatever the canvas happens to be.
 */
const JACKET_WIDTH = 1024

/** Resolves the best available art for one project. */
export function loadBookArt(project: Project): Promise<CoverArt | null> {
  return resolveCoverArt(project.id, JACKET_WIDTH)
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
