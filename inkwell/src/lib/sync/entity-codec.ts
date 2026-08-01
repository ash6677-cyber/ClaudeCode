import { base64ToBlob, blobToBase64 } from '@/lib/base64'
import type { BaseEntity, ImageAsset } from '@/types'

/**
 * Firestore caps a single document at 1 MiB including field names and
 * overhead. Anything at risk of exceeding that gets serialized to JSON and
 * split across documents in a `chunks` subcollection instead. 900k leaves
 * comfortable headroom for the parent document's own metadata fields.
 */
export const CHUNK_CHARS = 900_000

/** Below this, an entity is written as ordinary Firestore fields (queryable,
 * one read). Above it, the chunked path kicks in. */
export const INLINE_LIMIT_CHARS = 700_000

export interface EncodedEntity {
  /** Written as the entity's own document under `users/{uid}/{table}/{id}`. */
  doc: Record<string, unknown>
  /** Written as `chunks/{index}` beneath that document. Empty for inline entities. */
  chunks: string[]
}

/**
 * `Blob` has no JSON representation, so image bytes ride along as base64.
 * Everything else in the model is already plain JSON (numbers for
 * timestamps, no Dates, no Maps), so a JSON round-trip is enough to
 * normalize it — and it conveniently strips `undefined`, which Firestore
 * rejects outright.
 */
async function toPlainObject(
  table: string,
  entity: BaseEntity,
): Promise<Record<string, unknown>> {
  if (table === 'imageAssets') {
    const asset = entity as ImageAsset
    const { blob, ...rest } = asset
    return {
      ...JSON.parse(JSON.stringify(rest)),
      dataBase64: blob ? await blobToBase64(blob) : '',
    }
  }
  return JSON.parse(JSON.stringify(entity)) as Record<string, unknown>
}

function fromPlainObject(table: string, plain: Record<string, unknown>): BaseEntity {
  if (table === 'imageAssets') {
    const { dataBase64, ...rest } = plain as Record<string, unknown> & { dataBase64?: string }
    const mimeType = typeof rest.mimeType === 'string' ? rest.mimeType : 'image/png'
    return {
      ...rest,
      blob: base64ToBlob(dataBase64 ?? '', mimeType),
    } as unknown as BaseEntity
  }
  return plain as unknown as BaseEntity
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += CHUNK_CHARS) {
    chunks.push(value.slice(i, i + CHUNK_CHARS))
  }
  return chunks
}

export async function encodeEntity(table: string, entity: BaseEntity): Promise<EncodedEntity> {
  const plain = await toPlainObject(table, entity)
  const serialized = JSON.stringify(plain)

  if (serialized.length <= INLINE_LIMIT_CHARS) {
    return { doc: { ...plain, _deleted: false }, chunks: [] }
  }

  const chunks = splitIntoChunks(serialized)
  return {
    // The parent keeps just enough to resolve conflicts without reading the
    // chunks, so last-write-wins comparisons stay a single cheap read.
    doc: {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      _deleted: false,
      _chunked: true,
      chunkCount: chunks.length,
    },
    chunks,
  }
}

export function decodeEntity(
  table: string,
  doc: Record<string, unknown>,
  chunks: string[],
): BaseEntity {
  if (doc._chunked) {
    const merged = chunks.join('')
    return fromPlainObject(table, JSON.parse(merged) as Record<string, unknown>)
  }
  const { _deleted, _chunked, chunkCount, ...rest } = doc
  void _deleted
  void _chunked
  void chunkCount
  return fromPlainObject(table, rest)
}

/** True when the remote document is a deletion tombstone rather than an entity. */
export function isTombstone(doc: Record<string, unknown>): boolean {
  return doc._deleted === true
}

export function tombstoneFor(id: string): Record<string, unknown> {
  return { id, _deleted: true, updatedAt: Date.now() }
}
