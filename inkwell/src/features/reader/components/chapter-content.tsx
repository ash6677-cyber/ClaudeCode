import { Fragment } from 'react'

import { RichText } from '@/features/reader/lib/rich-text'
import type { BookChapter } from '@/features/reader/lib/compile-book'

/**
 * A chapter as it reads in print: an opening title block, then each scene's
 * prose with a typographic break between scenes rather than a visible
 * heading — scene titles are an authoring tool, not something a reader of
 * the finished book should see.
 */
export function ChapterContent({ chapter }: { chapter: BookChapter }) {
  const hasProse = chapter.scenes.some(
    (scene) => scene.plainText.trim().length > 0 || scene.content,
  )

  return (
    <>
      <header className="book-chapter-open">
        <p className="book-chapter-number">Chapter {chapter.number}</p>
        <h1 className="book-chapter-title">{chapter.title}</h1>
      </header>

      {!hasProse && <p className="book-empty">This chapter hasn’t been written yet.</p>}

      {chapter.scenes.map((scene, index) => (
        <Fragment key={scene.id}>
          {index > 0 && (
            <p className="book-scene-break" aria-hidden="true">
              ❧
            </p>
          )}
          <RichText content={scene.content} fallback={scene.plainText} />
        </Fragment>
      ))}
    </>
  )
}
