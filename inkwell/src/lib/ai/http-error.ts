export function describeHttpError(status: number, body: string): string {
  if (status === 401 || status === 403) return 'Invalid API key'
  if (status === 429) return 'Rate limited — try again shortly'
  if (status >= 500) return 'The provider is having issues right now'
  try {
    const parsed = JSON.parse(body)
    return parsed.error?.message || parsed.message || `Request failed (${status})`
  } catch {
    return `Request failed (${status})`
  }
}
