import type { BaseEntity } from './base'

export type SceneStatus = 'outline' | 'drafting' | 'revised' | 'done'

export interface Chapter extends BaseEntity {
  projectId: string
  title: string
  order: number
  status: SceneStatus
}

export interface SceneBeat {
  id: string
  text: string
  order: number
  generated: boolean
}

/** TipTap JSON document. Kept as `unknown` here; validated at the editor boundary. */
export type RichContent = unknown

export interface Scene extends BaseEntity {
  chapterId: string
  projectId: string
  title: string
  order: number
  content: RichContent
  plainText: string
  wordCount: number
  status: SceneStatus
  povCharacterId: string | null
  locationCodexId: string | null
  summary: string
  beats: SceneBeat[]
  labels: string[]
  linkedCodexIds: string[]
}

export interface Snapshot extends BaseEntity {
  sceneId: string
  content: RichContent
  plainText: string
  wordCount: number
  label: string
}
