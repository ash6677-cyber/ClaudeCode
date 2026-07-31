const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['week', 1000 * 60 * 60 * 24 * 7],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
]

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function formatRelativeTime(timestamp: number): string {
  const diff = timestamp - Date.now()
  const abs = Math.abs(diff)

  if (abs < 1000 * 45) return 'just now'

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) {
      return relativeTimeFormatter.format(Math.round(diff / ms), unit)
    }
  }

  return relativeTimeFormatter.format(Math.round(diff / 1000), 'second')
}

const wordCountFormatter = new Intl.NumberFormat('en-US')

export function formatWordCount(count: number): string {
  return wordCountFormatter.format(count)
}
