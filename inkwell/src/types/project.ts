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
  status: ProjectStatus
  settings: ProjectSettings
}

export interface Series extends BaseEntity {
  name: string
  description: string
  sharedCodex: boolean
}
