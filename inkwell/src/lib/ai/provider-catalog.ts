/**
 * Bringing your own key, without having to know anything first.
 *
 * The old form asked four questions in a row — which provider, what label,
 * what base URL, which model — of somebody whose actual situation is "I have
 * a key in my clipboard and I want to talk to my character". Every one of
 * those questions has a good answer that can be worked out from the key
 * itself, so this is what knows how.
 *
 * Pure data and pure functions: which services exist, what their keys look
 * like, where you go to get one, and which models are worth offering by name.
 */

import type { AiProviderKind } from '@/types'

export interface ProviderProfile {
  kind: AiProviderKind
  label: string
  /** The page where a key is actually issued. */
  keyUrl: string
  /** What a writer needs to know before clicking that link, in one sentence. */
  note: string
  /** Prefixes that identify a key from this service, longest first. */
  keyPrefixes: string[]
  /** Models worth naming, best general choice first. */
  models: string[]
  needsBaseUrl?: boolean
  baseUrlPlaceholder?: string
}

export const PROVIDER_PROFILES: ProviderProfile[] = [
  {
    kind: 'openrouter',
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'One key for hundreds of models from every major company, including free ones. The simplest place to start.',
    keyPrefixes: ['sk-or-v1-', 'sk-or-'],
    models: [
      'openrouter/auto',
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.3-70b-instruct',
    ],
  },
  {
    kind: 'anthropic',
    label: 'Anthropic (Claude)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Claude models direct from Anthropic. Pay for what you use.',
    keyPrefixes: ['sk-ant-'],
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  },
  {
    kind: 'openai',
    label: 'OpenAI (ChatGPT)',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'GPT models direct from OpenAI. Note that a ChatGPT Plus subscription is a separate thing and does not include this.',
    keyPrefixes: ['sk-proj-', 'sk-'],
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
  },
  {
    kind: 'openai-compatible',
    label: 'Something else',
    keyUrl: '',
    note: 'Anything that speaks the OpenAI format — a local model on your own machine, or another service. You will need its address.',
    keyPrefixes: [],
    models: [],
    needsBaseUrl: true,
    baseUrlPlaceholder: 'http://localhost:11434/v1',
  },
]

export function providerProfile(kind: AiProviderKind): ProviderProfile {
  return PROVIDER_PROFILES.find((p) => p.kind === kind) ?? PROVIDER_PROFILES[0]
}

/**
 * Which service a pasted key belongs to.
 *
 * Prefixes are checked longest first so `sk-ant-` is not mistaken for a bare
 * `sk-`. A key nobody recognises returns null rather than a guess, because
 * silently picking OpenAI for an unknown key produces a failure the writer
 * cannot explain.
 */
export function detectProviderKind(apiKey: string): AiProviderKind | null {
  const key = apiKey.trim()
  if (!key) return null
  const candidates = PROVIDER_PROFILES.flatMap((profile) =>
    profile.keyPrefixes.map((prefix) => ({ prefix, kind: profile.kind })),
  ).sort((a, b) => b.prefix.length - a.prefix.length)
  return candidates.find((c) => key.startsWith(c.prefix))?.kind ?? null
}

/** The model to use when the writer has not chosen one. */
export function defaultModelFor(kind: AiProviderKind): string {
  return providerProfile(kind).models[0] ?? ''
}

/**
 * A key, shown safely.
 *
 * Enough of it to recognise which key it is, never enough to use. Short
 * strings are hidden entirely rather than mostly revealed.
 */
export function maskKey(apiKey: string): string {
  const key = apiKey.trim()
  if (key.length <= 12) return '•'.repeat(Math.max(key.length, 4))
  return `${key.slice(0, 6)}${'•'.repeat(6)}${key.slice(-4)}`
}
