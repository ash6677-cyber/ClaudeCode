import { describe, expect, it } from 'vitest'

import {
  CHUNK_CHARS,
  decodeEntity,
  encodeEntity,
  INLINE_LIMIT_CHARS,
  isTombstone,
  tombstoneFor,
} from './entity-codec'
import type { ImageAsset, Project } from '@/types'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    createdAt: 1,
    updatedAt: 2,
    title: 'A Novel',
    author: 'Ada',
    synopsis: '',
    genre: '',
    targetWordCount: 80000,
    coverId: null,
    seriesId: null,
  seriesOrder: 0,
    status: 'planning',
    settings: {
      defaultAiPresetId: null,
      pov: 'third-limited',
      tense: 'past',
      measureWidthCh: 68,
      structureMode: 'scenes',
    },
    ...overrides,
  }
}

describe('entity codec', () => {
  it('round-trips a small entity inline, with no chunks', async () => {
    const project = makeProject()
    const encoded = await encodeEntity('projects', project)

    expect(encoded.chunks).toHaveLength(0)
    expect(encoded.doc._deleted).toBe(false)

    const decoded = decodeEntity('projects', encoded.doc, [])
    expect(decoded).toEqual(project)
  })

  it('strips internal sync fields when decoding, so they never leak into app state', async () => {
    const encoded = await encodeEntity('projects', makeProject())
    const decoded = decodeEntity('projects', encoded.doc, []) as unknown as Record<string, unknown>

    expect(decoded).not.toHaveProperty('_deleted')
    expect(decoded).not.toHaveProperty('_chunked')
    expect(decoded).not.toHaveProperty('chunkCount')
  })

  it('drops undefined values, which Firestore rejects outright', async () => {
    const withUndefined = makeProject({ genre: undefined as unknown as string })
    const encoded = await encodeEntity('projects', withUndefined)

    expect(Object.values(encoded.doc)).not.toContain(undefined)
    expect(encoded.doc).not.toHaveProperty('genre')
  })

  it('round-trips an image asset through base64, preserving the exact bytes', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128])
    const asset: ImageAsset = {
      id: 'img1',
      createdAt: 1,
      updatedAt: 2,
      blob: new Blob([bytes], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 4,
      height: 4,
      fileName: 'cover.png',
    }

    const encoded = await encodeEntity('imageAssets', asset)
    // The Blob itself must not survive into the document — it has no JSON form.
    expect(encoded.doc).not.toHaveProperty('blob')
    expect(typeof encoded.doc.dataBase64).toBe('string')

    const decoded = decodeEntity('imageAssets', encoded.doc, []) as ImageAsset
    expect(decoded.fileName).toBe('cover.png')
    expect(decoded.mimeType).toBe('image/png')
    expect(new Uint8Array(await decoded.blob.arrayBuffer())).toEqual(bytes)
  })

  it('chunks an entity too large for one Firestore document, and reassembles it', async () => {
    // Firestore caps a document at 1 MiB; this synopsis alone blows past the
    // inline threshold, so the codec must fall back to the chunked path.
    const huge = makeProject({ synopsis: 'x'.repeat(INLINE_LIMIT_CHARS + 50_000) })

    const encoded = await encodeEntity('projects', huge)
    expect(encoded.chunks.length).toBeGreaterThan(0)
    expect(encoded.doc._chunked).toBe(true)
    expect(encoded.doc.chunkCount).toBe(encoded.chunks.length)
    // Conflict resolution reads only the parent doc, so it must carry updatedAt.
    expect(encoded.doc.updatedAt).toBe(huge.updatedAt)
    for (const chunk of encoded.chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_CHARS)

    const decoded = decodeEntity('projects', encoded.doc, encoded.chunks)
    expect(decoded).toEqual(huge)
  })

  it('chunks a large image asset and restores its bytes exactly', async () => {
    // 900 KB of bytes -> ~1.2 MB of base64: over Firestore's 1 MiB document
    // ceiling, so this must take the chunked path.
    const bytes = new Uint8Array(900_000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256

    const asset: ImageAsset = {
      id: 'big',
      createdAt: 1,
      updatedAt: 2,
      blob: new Blob([bytes], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      width: 2000,
      height: 3000,
      fileName: 'big-cover.jpg',
    }

    const encoded = await encodeEntity('imageAssets', asset)
    expect(encoded.chunks.length).toBeGreaterThan(1)

    const decoded = decodeEntity('imageAssets', encoded.doc, encoded.chunks) as ImageAsset
    const restored = new Uint8Array(await decoded.blob.arrayBuffer())

    // Compared with an explicit scan rather than toEqual: a deep-equality
    // assertion over ~1M elements spends all its time building a diff.
    expect(restored.length).toBe(bytes.length)
    let firstMismatch = -1
    for (let i = 0; i < bytes.length; i++) {
      if (restored[i] !== bytes[i]) {
        firstMismatch = i
        break
      }
    }
    expect(firstMismatch).toBe(-1)
  })

  it('recognises tombstones and keeps them cheap to evaluate', () => {
    const stone = tombstoneFor('gone')
    expect(isTombstone(stone)).toBe(true)
    expect(stone.id).toBe('gone')
    expect(typeof stone.updatedAt).toBe('number')
  })

  it('does not mistake a live entity for a tombstone', async () => {
    const encoded = await encodeEntity('projects', makeProject())
    expect(isTombstone(encoded.doc)).toBe(false)
  })
})
