import type { BaseEntity } from './base'

export type ProjectStatus = 'planning' | 'drafting' | 'revising' | 'complete' | 'archived'
export type PointOfView = 'first' | 'second' | 'third-limited' | 'third-omniscient' | 'multiple'
export type Tense = 'past' | 'present'

export interface ProjectSettings {
  defaultAiPresetId: string | null
  pov: PointOfView
  tense: Tense
  measureWidthCh: number
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
