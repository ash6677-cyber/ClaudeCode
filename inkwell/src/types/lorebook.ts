import type { BaseEntity } from './base'

export interface LorebookEntry {
  id: string
  keywords: string[]
  content: string
  constant: boolean
  priority: number
  tokenBudget: number
  enabled: boolean
}

export interface Lorebook extends BaseEntity {
  projectId: string
  name: string
  entries: LorebookEntry[]
}
