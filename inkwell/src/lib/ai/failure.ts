/**
 * Why a request to a model failed, in terms a writer can act on.
 *
 * "Something went wrong" is the same sentence for a mistyped API key, a rate
 * limit that will clear in nine seconds, and a train going into a tunnel —
 * three situations calling for three completely different responses. The
 * writer was left to guess which one they were in.
 *
 * So failures are classified, and the classification drives what the UI
 * offers: a link to Settings, a countdown, or a retry that is worth pressing.
 */

export type AiFailureKind =
  /** The key is wrong, missing, or not allowed to use this model. */
  | 'auth'
  /** Too many requests, or out of credit. Often carries a wait. */
  | 'rate-limit'
  /** Never reached the provider — offline, DNS, CORS, a dropped stream. */
  | 'network'
  /** The provider refused the content itself. Retrying verbatim won't help. */
  | 'content'
  /** The provider is broken on its own side. */
  | 'server'
  /** Something the app has no specific reading of. */
  | 'unknown'

export interface AiFailure {
  kind: AiFailureKind
  /** One line, already fit to show. */
  message: string
  /** Seconds to wait, when the provider said so. */
  retryAfter?: number
  /** Whether retrying the identical request could plausibly work. */
  retryable: boolean
}

export class AiRequestError extends Error {
  readonly failure: AiFailure
  constructor(failure: AiFailure) {
    super(failure.message)
    this.name = 'AiRequestError'
    this.failure = failure
  }
}

/** What to do about it, for the UI to render without re-deriving the logic. */
export const FAILURE_HINT: Record<AiFailureKind, string> = {
  auth: 'Check the API key in Settings → AI.',
  'rate-limit': 'The provider is asking you to slow down.',
  network: 'Check your connection — nothing reached the provider.',
  content: 'The provider refused this request. Rewording it usually helps.',
  server: 'Nothing wrong on your side. Worth trying again shortly.',
  unknown: 'Try again — and if it keeps happening, check Settings → AI.',
}

/**
 * The wait a provider asked for, when it both sent one and allowed the
 * browser to read it. `Retry-After` is a cross-origin response header, so it
 * is only visible when the provider lists it in `Access-Control-Expose-
 * Headers` — many do not. Its absence therefore means "unknown", never
 * "retry immediately", and the UI shows a plain retry rather than a countdown
 * it would have had to invent.
 */
function retryAfterSeconds(headers: Headers | undefined): number | undefined {
  const raw = headers?.get('retry-after')
  if (!raw) return undefined
  const asNumber = Number(raw)
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.ceil(asNumber)
  // The header may also be an HTTP date.
  const asDate = Date.parse(raw)
  if (Number.isFinite(asDate)) return Math.max(0, Math.ceil((asDate - Date.now()) / 1000))
  return undefined
}

/** The provider's own message, when it bothered to send one worth reading. */
function providerMessage(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string }
      message?: string
    }
    const message = parsed.error?.message ?? parsed.message
    return typeof message === 'string' && message.trim() ? message.trim() : undefined
  } catch {
    return undefined
  }
}

export function classifyHttpError(status: number, body: string, headers?: Headers): AiFailure {
  const detail = providerMessage(body)

  if (status === 401 || status === 403) {
    return {
      kind: 'auth',
      message: detail ?? 'The provider rejected the API key.',
      retryable: false,
    }
  }
  if (status === 429) {
    return {
      kind: 'rate-limit',
      message: detail ?? 'Rate limited by the provider.',
      retryAfter: retryAfterSeconds(headers),
      retryable: true,
    }
  }
  if (status === 400 || status === 422) {
    return {
      kind: 'content',
      message: detail ?? 'The provider would not accept this request.',
      retryable: false,
    }
  }
  if (status >= 500) {
    return {
      kind: 'server',
      message: detail ?? 'The provider is having problems.',
      retryable: true,
    }
  }
  return {
    kind: 'unknown',
    message: detail ?? `The request failed (${status}).`,
    retryable: true,
  }
}

/**
 * A thrown value, classified.
 *
 * A `fetch` that rejects never reached the provider at all — offline, DNS,
 * a blocked origin — which is the one failure worth retrying automatically,
 * because it is usually over by the time a person has read about it.
 */
export function classifyThrown(error: unknown): AiFailure {
  if (error instanceof AiRequestError) return error.failure
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { kind: 'network', message: 'Stopped.', retryable: true }
  }
  if (error instanceof TypeError) {
    return {
      kind: 'network',
      message: 'Could not reach the provider.',
      retryable: true,
    }
  }
  return {
    kind: 'unknown',
    message: error instanceof Error && error.message ? error.message : 'Something went wrong.',
    retryable: true,
  }
}

/** Only a network blip is worth retrying without asking. */
export function shouldAutoRetry(failure: AiFailure, attempt: number, maxAttempts = 2): boolean {
  return failure.kind === 'network' && attempt < maxAttempts
}

/** 400ms, then 1200ms — long enough to matter, short enough to sit through. */
export function backoffMs(attempt: number): number {
  return 400 * 3 ** (attempt - 1)
}
