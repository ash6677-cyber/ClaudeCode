import type { BaseEntity } from './base'

export interface ExampleDialogueLine {
  id: string
  input: string
  response: string
}

export interface CharacterCard extends BaseEntity {
  projectId: string
  codexEntryId: string | null
  displayName: string
  avatarImageId: string | null
  cropSettings: { x: number; y: number; zoom: number } | null
  description: string
  personality: string
  scenario: string
  firstMessage: string
  exampleDialogue: ExampleDialogueLine[]
  systemPromptOverride: string | null
  voiceNotes: string
  tags: string[]
}

export type ChatRole = 'user' | 'assistant' | 'system'
export type ChatMode = 'interview' | 'roleplay'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  swipes: string[]
  activeSwipe: number
}

export interface CardChat extends BaseEntity {
  cardId: string
  projectId: string
  mode: ChatMode
  title: string
  personaId: string | null
  aiPresetId: string | null
  messages: ChatMessage[]
}

export interface Persona extends BaseEntity {
  name: string
  description: string
  avatarImageId: string | null
  isDefault: boolean
}
