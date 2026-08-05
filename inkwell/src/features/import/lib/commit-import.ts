import type { DetectedManuscript } from '@/features/import/lib/parse-manuscript'
import { chapterRepo, projectRepo, sceneRepo } from '@/lib/db/repositories'
import type { Project, RichContent } from '@/types'

/**
 * Turning a detected structure into real chapters and scenes.
 *
 * Kept apart from the detection so the judgement can be tested without a
 * database and the writing can be read in one go. Nothing here decides
 * anything — by the time this runs the writer has already seen the structure
 * and said yes to it.
 */

/** Paragraphs as the editor's document format. */
export function paragraphsToContent(paragraphs: string[]): RichContent {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : undefined,
    })),
  } as unknown as RichContent
}

export interface ImportTarget {
  /** An existing book to append to, or null to make a new one. */
  projectId: string | null
  title: string
  author: string
}

export interface ImportResult {
  projectId: string
  chapters: number
  scenes: number
  words: number
}

export async function commitManuscript(
  manuscript: DetectedManuscript,
  target: ImportTarget,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  let project: Project | undefined
  if (target.projectId) {
    project = await projectRepo.get(target.projectId)
  }
  if (!project) {
    project = await projectRepo.create({
      title: target.title.trim() || 'Imported manuscript',
      author: target.author.trim(),
      synopsis: '',
      genre: '',
      targetWordCount: Math.max(10000, Math.round(manuscript.wordCount / 1000) * 1000),
      coverId: null,
      seriesId: null,
      seriesOrder: 0,
      status: 'drafting',
      settings: {
        defaultAiPresetId: null,
        pov: 'third-limited',
        tense: 'past',
        measureWidthCh: 68,
        structureMode: 'scenes',
      },
    })
  }

  // Appending to a book that already has chapters must not renumber the ones
  // already there, so the new work starts after the last of them.
  const existing = await chapterRepo.list()
  let order = existing.filter((c) => c.projectId === project.id).length

  let scenes = 0
  const total = manuscript.chapters.length
  for (const [index, detected] of manuscript.chapters.entries()) {
    const chapter = await chapterRepo.create({
      projectId: project.id,
      title: detected.title,
      order: order++,
      status: 'drafting',
    })
    for (const [sceneIndex, scene] of detected.scenes.entries()) {
      await sceneRepo.create({
        chapterId: chapter.id,
        projectId: project.id,
        title: scene.title,
        order: sceneIndex,
        content: paragraphsToContent(scene.paragraphs),
        plainText: scene.paragraphs.join('\n\n'),
        wordCount: scene.wordCount,
        status: 'drafting',
        povCharacterId: null,
        locationCodexId: null,
        summary: '',
        beats: [],
        labels: [],
        linkedCodexIds: [],
      })
      scenes += 1
    }
    onProgress?.(index + 1, total)
  }

  return {
    projectId: project.id,
    chapters: manuscript.chapters.length,
    scenes,
    words: manuscript.wordCount,
  }
}
