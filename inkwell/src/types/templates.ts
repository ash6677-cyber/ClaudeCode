import type { BaseEntity } from './base'
import type { ChapterKind } from './editor'

/** How a template writes the number in a chapter title. */
export type ChapterNumbering = 'words' | 'digits' | 'roman'

export interface TemplatePart {
  id: string
  kind: ChapterKind
  /**
   * The title, with `{n}` standing in for the number.
   *
   * A template says `Chapter {n}` once and asks for twelve of them rather
   * than listing twelve titles, so changing the wording or the numbering
   * style is one edit instead of twelve.
   */
  title: string
  /** How many of this part to create. */
  count: number
  /** Scenes inside each one. Ignored when the project has no scenes. */
  scenesEach: number
}

/**
 * A shape to start a manuscript in.
 *
 * Built-in templates are constants in code; the ones a writer makes are rows
 * in this table, so they sync between devices and travel in a library export
 * like everything else they have written.
 */
export interface ManuscriptTemplate extends BaseEntity {
  name: string
  description: string
  numbering: ChapterNumbering
  parts: TemplatePart[]
}
