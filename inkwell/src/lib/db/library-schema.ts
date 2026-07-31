import type {
  AiPreset,
  AiProviderConfig,
  CardChat,
  CharacterCard,
  Chapter,
  CodexEntry,
  Cover,
  Goal,
  Lorebook,
  Persona,
  Project,
  Scene,
  Series,
  SessionLog,
  Snapshot,
} from '@/types'

export const CURRENT_SCHEMA_VERSION = 1

/** Disk-safe stand-in for ImageAsset: JSON can't hold a Blob, so the binary is
 * base64-encoded for storage and converted back to a Blob on load. */
export interface StoredImageAsset {
  id: string
  createdAt: number
  updatedAt: number
  mimeType: string
  width: number
  height: number
  fileName: string
  dataBase64: string
}

export interface LibraryDocument {
  schemaVersion: number
  projects: Project[]
  series: Series[]
  chapters: Chapter[]
  scenes: Scene[]
  snapshots: Snapshot[]
  codexEntries: CodexEntry[]
  characterCards: CharacterCard[]
  cardChats: CardChat[]
  personas: Persona[]
  lorebooks: Lorebook[]
  covers: Cover[]
  aiPresets: AiPreset[]
  aiProviders: AiProviderConfig[]
  imageAssets: StoredImageAsset[]
  goals: Goal[]
  sessionLogs: SessionLog[]
}

const ARRAY_KEYS = [
  'projects',
  'series',
  'chapters',
  'scenes',
  'snapshots',
  'codexEntries',
  'characterCards',
  'cardChats',
  'personas',
  'lorebooks',
  'covers',
  'aiPresets',
  'aiProviders',
  'imageAssets',
  'goals',
  'sessionLogs',
] as const

export function emptyLibrary(): LibraryDocument {
  const doc = { schemaVersion: CURRENT_SCHEMA_VERSION } as LibraryDocument
  for (const key of ARRAY_KEYS) (doc as unknown as Record<string, unknown>)[key] = []
  return doc
}

/**
 * Forward-only migration chain. Each numbered step brings a document exactly
 * one schema version forward; a document at any older version runs through
 * every step in order until it reaches CURRENT_SCHEMA_VERSION. Steps only
 * ever add sane defaults for fields that didn't used to exist — never drop
 * or reinterpret data — so migration can't be lossy.
 */
export function migrateLibrary(raw: unknown): LibraryDocument {
  let doc = normalizeShape(raw)
  const version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0
  if (version < 1) doc = migrateV0ToV1(doc)
  return doc as unknown as LibraryDocument
}

function normalizeShape(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return { schemaVersion: 0 }
  return { schemaVersion: 0, ...(raw as Record<string, unknown>) }
}

/**
 * v0 covers every pre-Phase-7 library shape: no lorebooks/personas/cardChats/
 * covers tables existed yet, and projects created before the chapters-only
 * structure mode shipped have no `settings.structureMode`. This mirrors the
 * defensive `project.settings.structureMode ?? 'scenes'` read-site fallback
 * used elsewhere in the app before this migration existed, but bakes the
 * default in permanently at load time instead of re-checking on every read.
 */
function migrateV0ToV1(doc: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...doc }
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(next[key])) next[key] = []
  }
  next.projects = (next.projects as Array<Record<string, unknown>>).map((project) => {
    const settings = (project.settings as Record<string, unknown>) ?? {}
    return {
      ...project,
      settings: {
        defaultAiPresetId: null,
        measureWidthCh: 68,
        ...settings,
        structureMode: settings.structureMode ?? 'scenes',
      },
    }
  })
  next.schemaVersion = 1
  return next
}
