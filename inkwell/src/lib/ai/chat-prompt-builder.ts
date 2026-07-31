import type { AiPreset, CardChat, CharacterCard, ChatMessage, Lorebook, Persona } from '@/types'

import { estimateTokens } from './token-estimate'
import type { AiChatMessage } from './types'

export interface ChatPromptInput {
  card: CharacterCard
  chat: CardChat
  persona: Persona | null
  lorebooks: Lorebook[]
  preset: AiPreset
  history: ChatMessage[]
}

export interface ContextPreviewSection {
  label: string
  content: string
  tokens: number
}

export interface BuiltChatPrompt {
  messages: AiChatMessage[]
  estimatedTokens: number
  sections: ContextPreviewSection[]
}

function activeContent(message: ChatMessage): string {
  return message.role === 'assistant' ? (message.swipes[message.activeSwipe] ?? '') : message.content
}

function buildLorebookContext(lorebooks: Lorebook[], recentText: string, tokenBudget: number): string {
  const haystack = recentText.toLowerCase()
  const candidates = lorebooks
    .flatMap((lb) => lb.entries)
    .filter((entry) => {
      if (!entry.enabled) return false
      if (entry.constant) return true
      return entry.keywords.some((kw) => kw.trim() && haystack.includes(kw.trim().toLowerCase()))
    })
    .sort((a, b) => b.priority - a.priority)

  const budget = tokenBudget > 0 ? tokenBudget : Infinity
  let used = 0
  const blocks: string[] = []
  for (const entry of candidates) {
    const entryBudget = entry.tokenBudget > 0 ? Math.min(entry.tokenBudget, budget - used) : budget - used
    let content = entry.content
    if (estimateTokens(content) > entryBudget && entryBudget > 0) {
      const approxChars = Math.max(0, Math.floor(entryBudget * 4))
      content = content.slice(0, approxChars)
    }
    const tokens = estimateTokens(content)
    if (used + tokens > budget) break
    blocks.push(content)
    used += tokens
  }
  return blocks.join('\n\n')
}

function buildCharacterSystemPrompt(card: CharacterCard, persona: Persona | null, mode: CardChat['mode']): string {
  if (card.systemPromptOverride?.trim()) {
    return card.systemPromptOverride.trim()
  }

  const lines = [`You are ${card.displayName}.`]
  if (card.description.trim()) lines.push(`Description: ${card.description.trim()}`)
  if (card.personality.trim()) lines.push(`Personality: ${card.personality.trim()}`)
  if (card.scenario.trim()) lines.push(`Scenario: ${card.scenario.trim()}`)
  if (card.voiceNotes.trim()) lines.push(`Voice and speech patterns: ${card.voiceNotes.trim()}`)

  if (card.exampleDialogue.length > 0) {
    const personaName = persona?.name || 'User'
    const examples = card.exampleDialogue
      .map((line) => `${personaName}: ${line.input}\n${card.displayName}: ${line.response}`)
      .join('\n\n')
    lines.push(`Example exchanges (for voice and tone only, not part of this conversation):\n${examples}`)
  }

  if (persona) {
    lines.push(
      `You are talking with ${persona.name}.${persona.description.trim() ? ` About them: ${persona.description.trim()}` : ''}`,
    )
  }

  lines.push(
    mode === 'interview'
      ? "The user is the author, stepping out of the story to interview you about yourself. Answer in your own voice, but it's fine to reflect on your own story, motivations, and history with candor — this is character development, not in-scene roleplay."
      : 'Stay fully and permanently in character. Respond only as your character would within the scenario — never break character, never acknowledge being an AI, and never narrate for the other person.',
  )

  return lines.join('\n\n')
}

export function buildChatPrompt(input: ChatPromptInput): BuiltChatPrompt {
  const { card, chat, persona, lorebooks, preset, history } = input

  const characterPrompt = buildCharacterSystemPrompt(card, persona, chat.mode)

  const recentText = history
    .slice(-6)
    .map((m) => activeContent(m))
    .join('\n')
  const lorebookContext = preset.contextRules.includeLorebook
    ? buildLorebookContext(lorebooks, recentText, preset.contextRules.lorebookTokenBudget)
    : ''

  const systemParts = [characterPrompt]
  if (lorebookContext) systemParts.push(`World info:\n${lorebookContext}`)
  if (preset.systemPrompt.trim()) systemParts.push(preset.systemPrompt.trim())
  const systemPrompt = systemParts.join('\n\n---\n\n')

  const sections: ContextPreviewSection[] = [
    { label: 'Character', content: characterPrompt, tokens: estimateTokens(characterPrompt) },
  ]
  if (lorebookContext) {
    sections.push({ label: 'World info', content: lorebookContext, tokens: estimateTokens(lorebookContext) })
  }

  const historyMessages: AiChatMessage[] = history
    .map((m) => ({ role: m.role, content: activeContent(m) }))
    .filter((m) => m.content.trim())

  const messages: AiChatMessage[] = [{ role: 'system', content: systemPrompt }, ...historyMessages]
  const historyTokens = historyMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  sections.push({ label: 'Conversation history', content: `${historyMessages.length} messages`, tokens: historyTokens })

  const estimatedTokens = sections.reduce((sum, s) => sum + s.tokens, 0)

  return { messages, estimatedTokens, sections }
}
