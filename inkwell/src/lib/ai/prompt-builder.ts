import type { AiActionKind, AiPreset, CodexEntry, PointOfView, Tense } from '@/types'

import { estimateTokens } from './token-estimate'
import type { AiChatMessage } from './types'

export interface PromptBuilderInput {
  preset: AiPreset
  action: AiActionKind
  instruction: string
  precedingText: string
  selectedText?: string
  codexEntries: CodexEntry[]
  pov: PointOfView
  tense: Tense
}

export interface ContextPreviewSection {
  label: string
  content: string
  tokens: number
}

export interface BuiltPrompt {
  messages: AiChatMessage[]
  estimatedTokens: number
  sections: ContextPreviewSection[]
}

const POV_LABEL: Record<PointOfView, string> = {
  first: 'first person',
  second: 'second person',
  'third-limited': 'third person limited',
  'third-omniscient': 'third person omniscient',
  multiple: 'multiple POV',
}

function buildCodexContext(
  entries: CodexEntry[],
  relevanceText: string,
  tokenBudget: number,
): string {
  const haystack = relevanceText.toLowerCase()
  const relevant = entries.filter((entry) => {
    if (entry.aiContext === 'never') return false
    if (entry.aiContext === 'always') return true
    const name = entry.name.toLowerCase()
    return (
      (name && haystack.includes(name)) ||
      entry.aliases.some((alias) => alias.trim() && haystack.includes(alias.toLowerCase()))
    )
  })

  const budget = tokenBudget > 0 ? tokenBudget : Infinity
  let used = 0
  const blocks: string[] = []
  for (const entry of relevant) {
    const attrLines = entry.attributes.map((a) => `- ${a.key}: ${a.value}`).join('\n')
    const block = `### ${entry.name} (${entry.type})\n${entry.summary}${attrLines ? `\n${attrLines}` : ''}`
    const blockTokens = estimateTokens(block)
    if (used + blockTokens > budget) break
    blocks.push(block)
    used += blockTokens
  }
  return blocks.join('\n\n')
}

function lastParagraphs(text: string, count: number): string {
  if (count <= 0) return ''
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim())
  return paragraphs.slice(-count).join('\n\n')
}

function actionInstruction(input: PromptBuilderInput): string {
  const { action, instruction, selectedText } = input
  switch (action) {
    case 'continue':
      return "Continue the prose naturally from exactly where it leaves off, in the established voice, POV, and tense. Don't repeat what's already written, and don't add headings or commentary — prose only."
    case 'rewrite':
      return `Rewrite the following passage.${instruction ? ` Instruction: ${instruction}` : ''} Preserve meaning and continuity with the surrounding scene unless told otherwise. Return only the rewritten passage.\n\nPassage:\n${selectedText ?? ''}`
    case 'describe':
      return `Write a vivid description for: ${instruction || 'the current subject'}. Match the established voice and tense. Keep it to two to four sentences unless told otherwise. Return only the description.`
    case 'brainstorm':
      return `Brainstorm ideas for: ${instruction || 'what could happen next'}. Offer four to six distinct, concrete options as a short list. These are just ideas — not prose to insert.`
    case 'summarise':
      return 'Summarise the scene below in two to three sentences, capturing the key events and character beats. Return only the summary.'
    case 'beats-to-prose':
      return `Expand the following beat into prose, in the established voice, POV, and tense:\n\n${instruction}`
  }
}

export function buildPrompt(input: PromptBuilderInput): BuiltPrompt {
  const { preset, precedingText, codexEntries, pov, tense } = input

  const systemLines = [
    preset.systemPrompt.trim() ||
      'You are a skilled fiction co-writer helping a novelist draft their manuscript.',
    `Write in ${POV_LABEL[pov]}, ${tense} tense.`,
  ]
  if (preset.proseInstructions.trim()) systemLines.push(preset.proseInstructions.trim())
  const systemPrompt = systemLines.join('\n\n')

  const relevanceText = `${precedingText}\n${input.selectedText ?? ''}\n${input.instruction}`
  const codexContext = preset.contextRules.includeCodex
    ? buildCodexContext(codexEntries, relevanceText, preset.contextRules.codexTokenBudget)
    : ''

  const preceding =
    input.action === 'summarise'
      ? precedingText
      : lastParagraphs(precedingText, preset.contextRules.precedingParagraphs)

  const sections: ContextPreviewSection[] = [
    { label: 'System prompt', content: systemPrompt, tokens: estimateTokens(systemPrompt) },
  ]
  if (codexContext) {
    sections.push({ label: 'Codex context', content: codexContext, tokens: estimateTokens(codexContext) })
  }
  if (preceding) {
    sections.push({
      label: input.action === 'summarise' ? 'Scene text' : 'Preceding prose',
      content: preceding,
      tokens: estimateTokens(preceding),
    })
  }
  const instructionText = actionInstruction(input)
  sections.push({ label: 'Instruction', content: instructionText, tokens: estimateTokens(instructionText) })

  const userParts = [
    codexContext && `Relevant worldbuilding context:\n${codexContext}`,
    preceding && `${input.action === 'summarise' ? 'Scene' : 'Preceding text'}:\n${preceding}`,
    instructionText,
  ].filter(Boolean)

  const messages: AiChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userParts.join('\n\n---\n\n') },
  ]

  const estimatedTokens = sections.reduce((sum, s) => sum + s.tokens, 0)

  return { messages, estimatedTokens, sections }
}
