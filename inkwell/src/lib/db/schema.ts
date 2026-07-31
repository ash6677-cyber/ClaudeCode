import Dexie, { type EntityTable } from 'dexie'
import type {
  AiPreset,
  AiProviderConfig,
  CardChat,
  CharacterCard,
  Chapter,
  CodexEntry,
  Cover,
  Goal,
  ImageAsset,
  Lorebook,
  Persona,
  Project,
  Scene,
  Series,
  SessionLog,
  Snapshot,
} from '@/types'

import type { TableLike } from './repository'
import { isTauriRuntime } from './tauri-bridge'
import { tauriTables } from './tauri-db'

export class InkwellDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  series!: EntityTable<Series, 'id'>
  chapters!: EntityTable<Chapter, 'id'>
  scenes!: EntityTable<Scene, 'id'>
  snapshots!: EntityTable<Snapshot, 'id'>
  codexEntries!: EntityTable<CodexEntry, 'id'>
  characterCards!: EntityTable<CharacterCard, 'id'>
  cardChats!: EntityTable<CardChat, 'id'>
  personas!: EntityTable<Persona, 'id'>
  lorebooks!: EntityTable<Lorebook, 'id'>
  covers!: EntityTable<Cover, 'id'>
  aiPresets!: EntityTable<AiPreset, 'id'>
  aiProviders!: EntityTable<AiProviderConfig, 'id'>
  imageAssets!: EntityTable<ImageAsset, 'id'>
  goals!: EntityTable<Goal, 'id'>
  sessionLogs!: EntityTable<SessionLog, 'id'>

  constructor() {
    super('inkwell')

    this.version(1).stores({
      projects: 'id, seriesId, status, updatedAt',
      series: 'id, updatedAt',
      chapters: 'id, projectId, order, updatedAt',
      scenes: 'id, projectId, chapterId, order, updatedAt',
      snapshots: 'id, sceneId, createdAt',
      codexEntries: 'id, projectId, seriesId, type, name, updatedAt',
      characterCards: 'id, projectId, codexEntryId, updatedAt',
      cardChats: 'id, cardId, projectId, updatedAt',
      personas: 'id, updatedAt',
      lorebooks: 'id, projectId, updatedAt',
      covers: 'id, projectId, updatedAt',
      aiPresets: 'id, updatedAt',
      aiProviders: 'id, kind, updatedAt',
      imageAssets: 'id, updatedAt',
      goals: 'id, projectId, updatedAt',
      sessionLogs: 'id, projectId, startedAt',
    })
  }
}

interface DbTables {
  projects: TableLike<Project>
  series: TableLike<Series>
  chapters: TableLike<Chapter>
  scenes: TableLike<Scene>
  snapshots: TableLike<Snapshot>
  codexEntries: TableLike<CodexEntry>
  characterCards: TableLike<CharacterCard>
  cardChats: TableLike<CardChat>
  personas: TableLike<Persona>
  lorebooks: TableLike<Lorebook>
  covers: TableLike<Cover>
  aiPresets: TableLike<AiPreset>
  aiProviders: TableLike<AiProviderConfig>
  imageAssets: TableLike<ImageAsset>
  goals: TableLike<Goal>
  sessionLogs: TableLike<SessionLog>
}

/** Browser build (web) reads/writes IndexedDB via Dexie; the desktop build
 * (Tauri) never touches Dexie at all — it uses an in-memory store that's
 * hydrated from and persisted to a real file on disk. Every store and
 * component goes through `db.<table>` exactly the same way either way. */
function createDbTables(): DbTables {
  if (isTauriRuntime()) return tauriTables
  return new InkwellDB()
}

export const db: DbTables = createDbTables()
