import type { AiChatMessage } from '@/lib/ai/types'
import type { PointOfView, Tense } from '@/types'

export interface OutlineDraft {
  title: string
  summary: string
}

export interface CastDraft {
  name: string
  role: string
  personality: string
}

const POV_LABEL: Record<PointOfView, string> = {
  first: 'first person',
  second: 'second person',
  'third-limited': 'third person limited',
  'third-omniscient': 'third person omniscient',
  multiple: 'multiple POV',
}

export function buildOutlinePrompt(input: {
  title: string
  genre: string
  synopsis: string
  pov: PointOfView
  tense: Tense
  chapterCount: number
}): AiChatMessage[] {
  const system =
    'You are a developmental editor helping a novelist rough out a chapter-by-chapter outline for a new book. Respond with ONLY a raw JSON array — no markdown code fences, no commentary, no explanation before or after.'
  const user = [
    `Book: "${input.title || 'Untitled'}" (${input.genre || 'unspecified genre'})`,
    `Premise: ${input.synopsis.trim() || 'Not written yet — invent something fitting the title and genre.'}`,
    `POV: ${POV_LABEL[input.pov]}, tense: ${input.tense}`,
    '',
    `Generate exactly ${input.chapterCount} chapters that build a coherent arc from beginning to end.`,
    `Return a JSON array of exactly ${input.chapterCount} objects shaped like {"title": string, "summary": string}.`,
    'Each summary should be one to two sentences describing what happens in that chapter.',
  ].join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export function buildCastPrompt(input: {
  title: string
  genre: string
  synopsis: string
  castCount: number
}): AiChatMessage[] {
  const system =
    'You are a fiction editor helping a novelist sketch a starter cast for a new book. Respond with ONLY a raw JSON array — no markdown code fences, no commentary, no explanation before or after.'
  const user = [
    `Book: "${input.title || 'Untitled'}" (${input.genre || 'unspecified genre'})`,
    `Premise: ${input.synopsis.trim() || 'Not written yet — invent something fitting the title and genre.'}`,
    '',
    `Suggest exactly ${input.castCount} characters that would fit this story, covering a mix of roles (protagonist, antagonist, allies, etc. as fitting).`,
    `Return a JSON array of exactly ${input.castCount} objects shaped like {"name": string, "role": string, "personality": string}.`,
    '"role" is a short phrase (e.g. "protagonist", "reluctant mentor"). "personality" is one to two sentences.',
  ].join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Best-effort extraction of a JSON array from an LLM response that may include stray prose or code fences. */
function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return null
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function parseOutlineResponse(text: string): OutlineDraft[] | null {
  const raw = extractJsonArray(text)
  if (!raw) return null
  const drafts = raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      title: typeof item.title === 'string' ? item.title.trim() : '',
      summary: typeof item.summary === 'string' ? item.summary.trim() : '',
    }))
    .filter((item) => item.title)
  return drafts.length > 0 ? drafts : null
}

export function parseCastResponse(text: string): CastDraft[] | null {
  const raw = extractJsonArray(text)
  if (!raw) return null
  const drafts = raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      role: typeof item.role === 'string' ? item.role.trim() : '',
      personality: typeof item.personality === 'string' ? item.personality.trim() : '',
    }))
    .filter((item) => item.name)
  return drafts.length > 0 ? drafts : null
}
