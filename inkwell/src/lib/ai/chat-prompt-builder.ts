import type { AiPreset, CardChat, CharacterCard, ChatMessage, Lorebook, Persona } from '@/types'

import { contextItem, excluded, makePlan, trimToTokens, type ContextItem, type ContextPlan } from './context-plan'
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

export interface BuiltChatPrompt {
  messages: AiChatMessage[]
  estimatedTokens: number
  /** Everything considered, sent or not, with reasons. */
  plan: ContextPlan
}

function activeContent(message: ChatMessage): string {
  return message.role === 'assistant' ? (message.swipes[message.activeSwipe] ?? '') : message.content
}

/**
 * Which world info reaches the model, and — the part that used to be
 * invisible — which does not.
 *
 * A lorebook entry can miss for four different reasons, and a writer wondering
 * why their character has never heard of the salt tax deserves to be told
 * which one it was rather than left to guess at the machinery.
 */
function planLorebook(
  lorebooks: Lorebook[],
  recentText: string,
  tokenBudget: number,
): { text: string; items: ContextItem[] } {
  const haystack = recentText.toLowerCase()
  const items: ContextItem[] = []
  const kept: string[] = []

  const named = lorebooks.flatMap((lb) => lb.entries.map((entry) => ({ entry, book: lb.name })))
  const label = (e: (typeof named)[number]) =>
    e.entry.keywords.filter((k) => k.trim())[0]?.trim() || 'Untitled entry'

  const candidates: typeof named = []
  for (const item of named) {
    const { entry } = item
    if (!entry.enabled) {
      items.push(excluded(entry.id, label(item), entry.content, 'Switched off in the lorebook.', item.book))
      continue
    }
    if (entry.constant) {
      candidates.push(item)
      continue
    }
    const hit = entry.keywords.some((kw) => kw.trim() && haystack.includes(kw.trim().toLowerCase()))
    if (!hit) {
      items.push(
        excluded(
          entry.id,
          label(item),
          entry.content,
          'None of its keywords appear in the recent conversation.',
          item.book,
        ),
      )
      continue
    }
    candidates.push(item)
  }

  candidates.sort((a, b) => b.entry.priority - a.entry.priority)

  const budget = tokenBudget > 0 ? tokenBudget : Infinity
  let used = 0
  for (const item of candidates) {
    const { entry } = item
    const remaining = budget - used
    if (remaining <= 0) {
      items.push(excluded(entry.id, label(item), entry.content, 'The world-info budget was already full.', item.book))
      continue
    }
    const entryBudget = entry.tokenBudget > 0 ? Math.min(entry.tokenBudget, remaining) : remaining
    const { text, trimmed } = trimToTokens(entry.content, entryBudget)
    const tokens = estimateTokens(text)
    if (tokens === 0) {
      items.push(excluded(entry.id, label(item), entry.content, 'No room left in the world-info budget.', item.book))
      continue
    }
    kept.push(text)
    used += tokens
    items.push(
      contextItem(entry.id, label(item), text, {
        outcome: trimmed ? 'trimmed' : 'included',
        reason: trimmed ? 'Cut short to fit the world-info budget.' : undefined,
        source: item.book,
      }),
    )
  }

  return { text: kept.join('\n\n'), items }
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
  const lorebookPlan = preset.contextRules.includeLorebook
    ? planLorebook(lorebooks, recentText, preset.contextRules.lorebookTokenBudget)
    : {
        text: '',
        items: lorebooks
          .flatMap((lb) => lb.entries.map((entry) => ({ entry, book: lb.name })))
          .map(({ entry, book }) =>
            excluded(
              entry.id,
              entry.keywords.filter((k) => k.trim())[0]?.trim() || 'Untitled entry',
              entry.content,
              'World info is switched off for this preset.',
              book,
            ),
          ),
      }
  const lorebookContext = lorebookPlan.text

  const systemParts = [characterPrompt]
  if (lorebookContext) systemParts.push(`World info:\n${lorebookContext}`)
  if (preset.systemPrompt.trim()) systemParts.push(preset.systemPrompt.trim())
  const systemPrompt = systemParts.join('\n\n---\n\n')

  const historyMessages: AiChatMessage[] = history
    .map((m) => ({ role: m.role, content: activeContent(m) }))
    .filter((m) => m.content.trim())

  const messages: AiChatMessage[] = [{ role: 'system', content: systemPrompt }, ...historyMessages]

  const items: ContextItem[] = [
    contextItem('character', `Who ${card.displayName} is`, characterPrompt, { source: 'This card' }),
  ]
  if (persona) {
    items.push(
      contextItem('persona', `Who you are (${persona.name})`, persona.description || persona.name, {
        source: 'Persona',
      }),
    )
  }
  items.push(...lorebookPlan.items)
  if (preset.systemPrompt.trim()) {
    items.push(
      contextItem('preset-system', 'Your own instructions', preset.systemPrompt.trim(), {
        source: preset.name,
      }),
    )
  }
  items.push(
    contextItem(
      'history',
      `The conversation so far (${historyMessages.length} ${historyMessages.length === 1 ? 'message' : 'messages'})`,
      historyMessages.map((m) => m.content).join('\n\n'),
      { source: 'This chat' },
    ),
  )

  const plan = makePlan(items)
  return { messages, estimatedTokens: plan.includedTokens, plan }
}
