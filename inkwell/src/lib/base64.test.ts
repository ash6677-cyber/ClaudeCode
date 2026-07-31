import { describe, expect, it } from 'vitest'

import { base64ToBlob, blobToBase64 } from './base64'

describe('blob <-> base64 round-trip', () => {
  it('preserves small binary content exactly', async () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 42, 128])
    const blob = new Blob([bytes], { type: 'image/png' })

    const base64 = await blobToBase64(blob)
    const restored = base64ToBlob(base64, 'image/png')
    const restoredBytes = new Uint8Array(await restored.arrayBuffer())

    expect(restored.type).toBe('image/png')
    expect(Array.from(restoredBytes)).toEqual(Array.from(bytes))
  })

  it('preserves content larger than the internal chunk size', async () => {
    // Chunking kicks in above 0x8000 (32768) bytes — this exercises that path.
    const size = 200_000
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i++) bytes[i] = i % 256
    const blob = new Blob([bytes], { type: 'application/octet-stream' })

    const base64 = await blobToBase64(blob)
    const restored = base64ToBlob(base64, 'application/octet-stream')
    const restoredBytes = new Uint8Array(await restored.arrayBuffer())

    expect(restoredBytes.length).toBe(size)
    expect(restoredBytes[0]).toBe(0)
    expect(restoredBytes[size - 1]).toBe((size - 1) % 256)
    expect(Array.from(restoredBytes)).toEqual(Array.from(bytes))
  })
})
