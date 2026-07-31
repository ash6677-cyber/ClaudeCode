import type { BaseEntity } from './base'

export type CodexEntryType =
  'character' | 'location' | 'item' | 'faction' | 'lore' | 'concept' | 'other'

export type AiContextInclusion = 'always' | 'never' | 'when-relevant'

export interface CodexRelationship {
  id: string
  targetEntryId: string
  label: string
}

export interface CodexAttribute {
  id: string
  key: string
  value: string
}

export interface CodexEntry extends BaseEntity {
  projectId: string | null
  seriesId: string | null
  type: CodexEntryType
  name: string
  aliases: string[]
  summary: string
  body: unknown
  plainText: string
  attributes: CodexAttribute[]
  relationships: CodexRelationship[]
  imageId: string | null
  tags: string[]
  aiContext: AiContextInclusion
  aiContextTokenBudget: number | null
}
