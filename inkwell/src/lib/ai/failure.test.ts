import { describe, expect, it } from 'vitest'

import {
  AiRequestError,
  backoffMs,
  classifyHttpError,
  classifyThrown,
  shouldAutoRetry,
} from './failure'

describe('classifying an HTTP failure', () => {
  it('reads a bad key as a bad key, not as bad luck', () => {
    for (const status of [401, 403]) {
      const failure = classifyHttpError(status, '')
      expect(failure.kind).toBe('auth')
      // Retrying an identical request with the same wrong key cannot work,
      // and offering a retry would be a lie.
      expect(failure.retryable).toBe(false)
    }
  })

  it('treats a refused request as something to reword, not repeat', () => {
    expect(classifyHttpError(400, '').kind).toBe('content')
    expect(classifyHttpError(422, '').retryable).toBe(false)
  })

  it('separates the provider being broken from the request being wrong', () => {
    expect(classifyHttpError(500, '').kind).toBe('server')
    expect(classifyHttpError(503, '').retryable).toBe(true)
  })

  it('carries the wait a rate limit asks for, in seconds', () => {
    const headers = new Headers({ 'retry-after': '12' })
    const failure = classifyHttpError(429, '', headers)
    expect(failure.kind).toBe('rate-limit')
    expect(failure.retryAfter).toBe(12)
  })

  it('understands a retry-after given as a date', () => {
    const headers = new Headers({ 'retry-after': new Date(Date.now() + 30_000).toUTCString() })
    const failure = classifyHttpError(429, '', headers)
    expect(failure.retryAfter).toBeGreaterThan(25)
    expect(failure.retryAfter).toBeLessThanOrEqual(31)
  })

  it('leaves the wait unset rather than inventing one', () => {
    expect(classifyHttpError(429, '').retryAfter).toBeUndefined()
    expect(classifyHttpError(429, '', new Headers({ 'retry-after': 'soon' })).retryAfter).toBeUndefined()
  })

  it('prefers the provider’s own words when it sent any', () => {
    const body = JSON.stringify({ error: { message: 'You exceeded your quota.' } })
    expect(classifyHttpError(429, body).message).toBe('You exceeded your quota.')
    expect(classifyHttpError(401, JSON.stringify({ message: 'No such key' })).message).toBe('No such key')
  })

  it('falls back to its own words when the body is unreadable', () => {
    expect(classifyHttpError(500, '<html>502 Bad Gateway</html>').message).toMatch(/problems/i)
    expect(classifyHttpError(418, '').message).toMatch(/418/)
  })
})

describe('classifying a thrown value', () => {
  it('reads a failed fetch as a network problem', () => {
    // A rejected fetch never reached the provider at all.
    expect(classifyThrown(new TypeError('Failed to fetch')).kind).toBe('network')
  })

  it('passes a classified error through untouched', () => {
    const original = new AiRequestError({ kind: 'auth', message: 'nope', retryable: false })
    expect(classifyThrown(original)).toBe(original.failure)
  })

  it('keeps an unrecognised error’s own message rather than replacing it', () => {
    const failure = classifyThrown(new Error('the stream ended oddly'))
    expect(failure.kind).toBe('unknown')
    expect(failure.message).toBe('the stream ended oddly')
  })

  it('never produces an empty message', () => {
    expect(classifyThrown(new Error('')).message).toBeTruthy()
    expect(classifyThrown(null).message).toBeTruthy()
    expect(classifyThrown('a string').message).toBeTruthy()
  })
})

describe('automatic retry', () => {
  it('only ever retries a network blip', () => {
    // Everything else either cannot work or needs a person to decide.
    for (const kind of ['auth', 'rate-limit', 'content', 'server', 'unknown'] as const) {
      expect(shouldAutoRetry({ kind, message: '', retryable: true }, 1)).toBe(false)
    }
    expect(shouldAutoRetry({ kind: 'network', message: '', retryable: true }, 1)).toBe(true)
  })

  it('gives up rather than hammering', () => {
    const network = { kind: 'network' as const, message: '', retryable: true }
    expect(shouldAutoRetry(network, 2)).toBe(false)
    expect(shouldAutoRetry(network, 3)).toBe(false)
  })

  it('waits longer the second time', () => {
    expect(backoffMs(1)).toBeLessThan(backoffMs(2))
    expect(backoffMs(1)).toBeGreaterThan(0)
  })
})
