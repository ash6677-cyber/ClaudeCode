import { chapterKind, isNumbered } from '@/features/templates/lib/templates'
import type { Chapter, ChapterKind, Scene } from '@/types'

export interface BookChapter {
  id: string
  title: string
  kind: ChapterKind
  /**
   * Its number within its own kind, or null for the divisions that don't take
   * one. A book with a prologue, twelve chapters and an epilogue has twelve
   * chapters; numbering by position would call the prologue chapter one and
   * be one out for the whole novel.
   */
  number: number | null
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

  const counts = new Map<ChapterKind, number>()

  return [...chapters]
    .sort((a, b) => a.order - b.order)
    .map((chapter) => {
      const chapterScenes = byChapter.get(chapter.id) ?? []
      const kind = chapterKind(chapter)
      let number: number | null = null
      if (isNumbered(kind)) {
        number = (counts.get(kind) ?? 0) + 1
        counts.set(kind, number)
      }
      return {
        id: chapter.id,
        title: chapter.title,
        kind,
        number,
        scenes: chapterScenes,
        wordCount: chapterScenes.reduce((sum, scene) => sum + scene.wordCount, 0),
      }
    })
}

export function totalWordCount(book: BookChapter[]): number {
  return book.reduce((sum, chapter) => sum + chapter.wordCount, 0)
}
