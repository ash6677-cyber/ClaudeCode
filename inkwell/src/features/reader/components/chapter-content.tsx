import { Fragment } from 'react'

import { RichText } from '@/features/reader/lib/rich-text'
import type { BookChapter } from '@/features/reader/lib/compile-book'
import { CHAPTER_KIND_LABEL, titleStatesKind } from '@/features/templates/lib/templates'

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
        {/* Only the divisions that take a number get the standfirst line.
            "Chapter 1" over a prologue was wrong twice — the prologue isn't a
            chapter, and every real chapter after it was numbered one too high.
            When the title already says it, the line would only repeat it. */}
        {chapter.number !== null && !titleStatesKind(chapter.title, chapter.kind) && (
          <p className="book-chapter-number">
            {CHAPTER_KIND_LABEL[chapter.kind]} {chapter.number}
          </p>
        )}
        <h1 className="book-chapter-title">{chapter.title}</h1>
      </header>

      {/* Named for what it is. A screenplay's acts were being told they were
          chapters that hadn't been written, and so were poems and diary
          entries. Nothing else on the page is left to say it instead. */}
      {!hasProse ? (
        <p className="book-empty">
          This {CHAPTER_KIND_LABEL[chapter.kind].toLowerCase()} hasn’t been written yet.
        </p>
      ) : (
        // Scene breaks divide prose from prose. An act laid out with six empty
        // scenes was drawing five ornaments under the line saying there was
        // nothing here — dividing nothing from nothing, five times.
        chapter.scenes.map((scene, index) => (
          <Fragment key={scene.id}>
            {index > 0 && (
              <p className="book-scene-break" aria-hidden="true">
                ❧
              </p>
            )}
            <RichText content={scene.content} fallback={scene.plainText} />
          </Fragment>
        ))
      )}
    </>
  )
}
