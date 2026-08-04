import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DESTINATIONS, NAV_ITEMS, destinationFor } from '@/app/layout/nav-items'
import { documentTitle } from '@/lib/hooks/use-document-title'

const SRC = join(process.cwd(), 'src')

function routeFiles(): string[] {
  const features = join(SRC, 'features')
  const found: string[] = []
  for (const feature of readdirSync(features)) {
    const routes = join(features, feature, 'routes')
    let names: string[]
    try {
      names = readdirSync(routes)
    } catch {
      continue
    }
    for (const name of names) {
      if (name.endsWith('.tsx')) found.push(join(routes, name))
    }
  }
  return found
}

describe('destinations', () => {
  it('is the only list — the command palette has no private copy', () => {
    // The palette used to keep its own array, and the two had already drifted
    // apart: Read and Series were in the rail and unreachable by ⌘K. This is
    // the test that would have caught it.
    const source = readFileSync(join(SRC, 'app/command-palette.tsx'), 'utf8')
    expect(source).toContain("from '@/app/layout/nav-items'")
    expect(source).not.toMatch(/const NAV_ENTRIES\s*=/)
  })

  it('offers every rail destination to the palette too', () => {
    for (const item of NAV_ITEMS) {
      expect(DESTINATIONS).toContain(item)
    }
  })

  it('reaches the screens that have no rail entry of their own', () => {
    const offRail = DESTINATIONS.filter((d) => !d.inRail).map((d) => d.to)
    expect(offRail).toContain('/book-creator')
    expect(offRail).toContain('/settings')
  })

  it('has no duplicate paths or labels', () => {
    expect(new Set(DESTINATIONS.map((d) => d.to)).size).toBe(DESTINATIONS.length)
    expect(new Set(DESTINATIONS.map((d) => d.label)).size).toBe(DESTINATIONS.length)
  })

  it('matches a path to the destination that owns it, nested pages included', () => {
    expect(destinationFor('/almanac')?.label).toBe('Almanac')
    expect(destinationFor('/almanac/abc123')?.label).toBe('Almanac')
    expect(destinationFor('/nowhere')).toBeUndefined()
    // Not a prefix match on the raw string: /seriesly is not /series.
    expect(destinationFor('/seriesly')).toBeUndefined()
  })
})

describe('page titles', () => {
  it('names the screen, then the book, then the app', () => {
    expect(documentTitle(['Almanac', 'Mira Vale'])).toBe('Almanac — Mira Vale — Inkwell')
    expect(documentTitle(['Elenya', 'Almanac', 'Mira Vale'])).toBe(
      'Elenya — Almanac — Mira Vale — Inkwell',
    )
  })

  it('skips parts that have not loaded yet rather than printing a gap', () => {
    expect(documentTitle([undefined, 'Almanac', null])).toBe('Almanac — Inkwell')
    expect(documentTitle(['  ', 'Stats'])).toBe('Stats — Inkwell')
    expect(documentTitle([])).toBe('Inkwell')
  })

  it('is set by every route there is', () => {
    // Every screen said "Inkwell" and nothing else, which made a row of tabs,
    // the history and any bookmark indistinguishable. A route added later
    // would reintroduce that one screen at a time and nobody would notice, so
    // the check is on the directory rather than on a list someone maintains.
    const missing = routeFiles().filter(
      (file) => !readFileSync(file, 'utf8').includes('useDocumentTitle('),
    )
    expect(missing.map((f) => f.slice(SRC.length + 1))).toEqual([])
  })
})
