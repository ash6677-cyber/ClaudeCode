import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { BACKED_UP_TABLES, HANDLED_SEPARATELY } from './web-library'

/**
 * The one thing about a backup that fails silently.
 *
 * Add a table to the database, forget to add it to the export, and every
 * backup from that day on is quietly missing something — with no error, no
 * warning, and nobody finding out until the day they restore. It has already
 * nearly happened twice: `manuscriptTemplates` and `themes` were both added
 * to the schema first and the export afterwards.
 *
 * This reads the schema as text rather than instantiating Dexie, because the
 * test environment is plain Node with no IndexedDB. That is not a compromise
 * here: the invariant genuinely is that two static lists agree, and comparing
 * them as text is exactly the check, with no runtime to go wrong.
 */
function tablesInSchema(): string[] {
  const source = readFileSync(
    fileURLToPath(new URL('./schema.ts', import.meta.url)),
    'utf8',
  )
  const names = new Set<string>()
  // Every `.stores({ … })` block, across every version. A table added in a
  // later version is just as real as one from version 1.
  for (const block of source.matchAll(/\.stores\(\{([\s\S]*?)\}\)/g)) {
    for (const entry of block[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*'/gm)) {
      names.add(entry[1])
    }
  }
  return [...names]
}

describe('the library backup', () => {
  it('finds the database schema it is meant to be checked against', () => {
    // If the parse breaks, every assertion below passes vacuously — so the
    // parse itself has to be asserted, not assumed.
    const tables = tablesInSchema()
    expect(tables.length).toBeGreaterThanOrEqual(16)
    expect(tables).toContain('projects')
    expect(tables).toContain('scenes')
  })

  it('carries every table in the database, or says why not', () => {
    const accounted = new Set<string>([...BACKED_UP_TABLES, ...HANDLED_SEPARATELY])
    const missing = tablesInSchema().filter((name) => !accounted.has(name))
    expect(
      missing,
      `these tables would be silently absent from every backup: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('does not claim to export a table the database does not have', () => {
    const real = new Set(tablesInSchema())
    const phantom = [...BACKED_UP_TABLES, ...HANDLED_SEPARATELY].filter((n) => !real.has(n))
    expect(phantom, `named in the export but not in the schema: ${phantom.join(', ')}`).toEqual([])
  })

  it('keeps credentials out of the backup on purpose, not by omission', () => {
    // `aiProviders` must be *deliberately* excluded. If it ever drifts into
    // the exported list, API keys start travelling in a file people email to
    // themselves — which is the whole reason this is stated twice.
    expect(HANDLED_SEPARATELY).toContain('aiProviders')
    expect(BACKED_UP_TABLES as readonly string[]).not.toContain('aiProviders')
  })

  it('exports images separately, because JSON cannot hold a Blob', () => {
    expect(HANDLED_SEPARATELY).toContain('imageAssets')
    expect(BACKED_UP_TABLES as readonly string[]).not.toContain('imageAssets')
  })
})
