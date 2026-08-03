import type { BaseEntity } from './base'

export type ProjectStatus = 'planning' | 'drafting' | 'revising' | 'complete' | 'archived'
export type PointOfView = 'first' | 'second' | 'third-limited' | 'third-omniscient' | 'multiple'
export type Tense = 'past' | 'present'
/** 'scenes': chapters contain multiple scenes (NovelWriter-style). 'chapters-only':
 * each chapter is a single writable unit with no visible scene subdivision. */
export type StructureMode = 'scenes' | 'chapters-only'

export interface ProjectSettings {
  defaultAiPresetId: string | null
  pov: PointOfView
  tense: Tense
  measureWidthCh: number
  structureMode: StructureMode
}

export interface Project extends BaseEntity {
  title: string
  author: string
  synopsis: string
  genre: string
  targetWordCount: number
  coverId: string | null
  seriesId: string | null
  /**
   * Position in its series — book one, book two, and so on.
   *
   * Reading order is authorial, not chronological: a prequel written last
   * still belongs at the front of the shelf. Nothing about the record's dates
   * can express that, so the writer sets it and the box set is built from it.
   * Meaningless while `seriesId` is null.
   */
  seriesOrder: number
  status: ProjectStatus
  settings: ProjectSettings
}

/** Surface finish of the slipcase board, which decides how it takes light. */
export type BoxSetFinish = 'matte' | 'satin' | 'gloss'

export interface SeriesBoxSet {
  /** Board colour of the slipcase. */
  caseColor: string
  /** Colour the series name is stamped in. */
  foilColor: string
  /** How far the books stand proud of the case, 0 (flush) to 1 (half out). */
  reveal: number
  finish: BoxSetFinish
}

export interface Series extends BaseEntity {
  name: string
  description: string
  sharedCodex: boolean
  boxSet: SeriesBoxSet
}
