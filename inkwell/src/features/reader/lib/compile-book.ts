import type { Chapter, Scene } from '@/types'

export interface BookChapter {
  id: string
  title: string
  number: number
  scenes: Scene[]
  wordCount: number
}

/**
 * Orders the manuscript the way a reader would meet it: chapters in order,
 * scenes in order within each. Empty chapters are kept — a chapter with no
 * prose still has a title page in a real book, and dropping it would make
 * chapter numbers disagree with the editor's sidebar.
 */
export function compileBook(chapters: Chapter[], scenes: Scene[]): BookChapter[] {
  const byChapter = new Map<string, Scene[]>()
  for (const scene of [...scenes].sort((a, b) => a.order - b.order)) {
    const list = byChapter.get(scene.chapterId)
    if (list) list.push(scene)
    else byChapter.set(scene.chapterId, [scene])
  }

  return [...chapters]
    .sort((a, b) => a.order - b.order)
    .map((chapter, index) => {
      const chapterScenes = byChapter.get(chapter.id) ?? []
      return {
        id: chapter.id,
        title: chapter.title,
        number: index + 1,
        scenes: chapterScenes,
        wordCount: chapterScenes.reduce((sum, scene) => sum + scene.wordCount, 0),
      }
    })
}

export function totalWordCount(book: BookChapter[]): number {
  return book.reduce((sum, chapter) => sum + chapter.wordCount, 0)
}
