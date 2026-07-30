import type { BaseEntity } from './base'

export interface Goal extends BaseEntity {
  projectId: string | null
  dailyWordTarget: number
  active: boolean
}

export interface SessionLog extends BaseEntity {
  projectId: string
  wordsWritten: number
  startedAt: number
  endedAt: number | null
}
