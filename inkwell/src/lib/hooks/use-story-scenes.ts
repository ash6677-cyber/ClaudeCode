import { useLiveQuery } from 'dexie-react-hooks'

import type { StoryScene } from '@/lib/ai/story-context'
import { chapterRepo, sceneRepo } from '@/lib/db/repositories'

/**
 * The manuscript, flattened into reading order, for a character to remember.
 *
 * A live query rather than a one-off read: a writer who talks to a character,
 * goes and writes the scene where that character is finally told the truth,
 * and comes back to the same conversation should find them already changed by
 * it. Anything cached at mount would leave them a chapter behind.
 */
export function useStoryScenes(projectId: string | null | undefined): StoryScene[] {
  return (
    useLiveQuery(async () => {
      if (!projectId) return []
      const [chapters, scenes] = await Promise.all([chapterRepo.list(), sceneRepo.list()])
      const mine = chapters.filter((chapter) => chapter.projectId === projectId)
      const orderById = new Map(mine.map((chapter) => [chapter.id, chapter.order]))
      const titleById = new Map(mine.map((chapter) => [chapter.id, chapter.title]))
      return scenes
        .filter((scene) => orderById.has(scene.chapterId) && scene.plainText.trim())
        .map((scene) => ({
          id: scene.id,
          chapterId: scene.chapterId,
          title: scene.title,
          plainText: scene.plainText,
          order: scene.order,
          chapterOrder: orderById.get(scene.chapterId) ?? 0,
          chapterTitle: titleById.get(scene.chapterId) ?? '',
        }))
        .sort((a, b) => a.chapterOrder - b.chapterOrder || a.order - b.order)
    }, [projectId]) ?? []
  )
}
