import { syncEngine, type SyncedTableName } from '@/lib/sync/sync-engine'
import { useAiStore } from '@/stores/ai-store'
import { useCardStore } from '@/stores/card-store'
import { useChatStore } from '@/stores/chat-store'
import { useCodexStore } from '@/stores/codex-store'
import { useCoverStore } from '@/stores/cover-store'
import { useEditorStore } from '@/stores/editor-store'
import { useLorebookStore } from '@/stores/lorebook-store'
import { usePersonaStore } from '@/stores/persona-store'
import { useProjectStore } from '@/stores/project-store'
import { useStatsStore } from '@/stores/stats-store'
import { useTemplateStore } from '@/stores/template-store'

/**
 * Reloads whichever stores own the tables a remote sync just touched.
 *
 * Project-scoped stores only reload if they currently have a project open —
 * there's nothing to refresh otherwise, and calling `loadProject(null)`
 * would be meaningless.
 *
 * Reloading the editor store is safe mid-typing: `SceneEditor` is keyed on
 * the scene id and owns its own TipTap document, so refreshed store state
 * does not reach into and overwrite the text under the cursor.
 */
const REFRESHERS: Record<SyncedTableName, () => void> = {
  projects: () => void useProjectStore.getState().fetchProjects(),
  series: () => void useProjectStore.getState().fetchProjects(),

  chapters: refreshEditor,
  scenes: refreshEditor,
  snapshots: refreshEditor,

  codexEntries: () => {
    const { projectId, loadProject } = useCodexStore.getState()
    if (projectId) void loadProject(projectId)
  },
  characterCards: () => {
    const { projectId, loadProject } = useCardStore.getState()
    if (projectId) void loadProject(projectId)
  },
  cardChats: () => {
    const { cardId, loadCard } = useChatStore.getState()
    if (cardId) void loadCard(cardId)
  },
  lorebooks: () => {
    const { projectId, loadProject } = useLorebookStore.getState()
    if (projectId) void loadProject(projectId)
  },
  covers: refreshCovers,
  personas: () => void usePersonaStore.getState().loadAll(),
  aiPresets: () => void useAiStore.getState().loadAll(),

  // Images are referenced by covers and character cards rather than owned by
  // a store of their own, so refreshing those re-resolves the new bytes.
  imageAssets: () => {
    refreshCovers()
    const { projectId, loadProject } = useCardStore.getState()
    if (projectId) void loadProject(projectId)
  },

  // Goals and session logs share one store, and it holds every project's
  // history at once, so there's no open-project check to make.
  goals: refreshStats,
  sessionLogs: refreshStats,

  // A format defined on another device should appear in the picker here
  // without a reload — it is a short list held in one store.
  manuscriptTemplates: () => void useTemplateStore.getState().load(),
}

function refreshStats() {
  void useStatsStore.getState().loadAll()
}

function refreshEditor() {
  const { projectId, loadProject } = useEditorStore.getState()
  if (projectId) void loadProject(projectId)
}

function refreshCovers() {
  const { projectId, loadProject } = useCoverStore.getState()
  if (projectId) void loadProject(projectId)
}

/** Wires remote-change notifications to store reloads. Returns an unsubscribe. */
export function startSyncRefreshBridge(): () => void {
  return syncEngine.onRemoteApplied((tables) => {
    for (const table of tables) REFRESHERS[table]?.()
  })
}
