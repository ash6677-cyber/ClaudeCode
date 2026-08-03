import type { BaseEntity } from './base'
import type { ChapterKind } from './editor'
import type { StructureMode } from './project'

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
  /**
   * The structure this format wants, if it only makes sense in one.
   *
   * A poem is one writable thing and so is a diary entry; splitting either
   * into scenes would give every poem a "Scene 1" under it and nothing else.
   * A format that says so switches the project to it when picked. Left unset
   * — as a novel leaves it — the writer's own choice stands.
   */
  structureMode?: StructureMode
  parts: TemplatePart[]
}
