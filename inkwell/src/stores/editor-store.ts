import { create } from 'zustand'

import { chapterRepo, sceneRepo, snapshotRepo } from '@/lib/db/repositories'
import type { Chapter, Scene, SceneStatus, Snapshot } from '@/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface EditorStoreState {
  projectId: string | null
  chapters: Chapter[]
  scenes: Scene[]
  activeSceneId: string | null
  status: LoadStatus
  error: string | null

  loadProject: (projectId: string) => Promise<void>
  setActiveScene: (sceneId: string | null) => void

  createChapter: (title?: string) => Promise<Chapter>
  renameChapter: (id: string, title: string) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  reorderChapters: (orderedIds: string[]) => Promise<void>

  createScene: (chapterId: string, title?: string) => Promise<Scene>
  renameScene: (id: string, title: string) => Promise<void>
  deleteScene: (id: string) => Promise<void>
  applySceneOrder: (moves: { id: string; chapterId: string; order: number }[]) => Promise<void>

  updateSceneContent: (
    id: string,
    input: { content: unknown; plainText: string; wordCount: number },
  ) => Promise<void>
  updateSceneMeta: (
    id: string,
    changes: Partial<Pick<Scene, 'status' | 'summary' | 'labels' | 'beats'>>,
  ) => Promise<void>
  updateChapterStatus: (id: string, status: SceneStatus) => Promise<void>

  listSnapshots: (sceneId: string) => Promise<Snapshot[]>
  restoreSnapshot: (snapshot: Snapshot) => Promise<void>
  deleteSnapshot: (id: string) => Promise<void>
}

function nextOrder(items: { order: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.order)) + 1
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  projectId: null,
  chapters: [],
  scenes: [],
  activeSceneId: null,
  status: 'idle',
  error: null,

  loadProject: async (projectId) => {
    set({ status: 'loading', error: null, projectId })
    try {
      const [allChapters, allScenes] = await Promise.all([chapterRepo.list(), sceneRepo.list()])
      const chapters = allChapters
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.order - b.order)
      const scenes = allScenes
        .filter((s) => s.projectId === projectId)
        .sort((a, b) => a.order - b.order)
      set({
        chapters,
        scenes,
        status: 'ready',
        activeSceneId: get().activeSceneId ?? scenes[0]?.id ?? null,
      })
    } catch {
      set({ status: 'error', error: 'Could not load this manuscript from local storage.' })
    }
  },

  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),

  createChapter: async (title = 'Untitled chapter') => {
    const { projectId, chapters } = get()
    if (!projectId) throw new Error('No active project')
    const chapter = await chapterRepo.create({
      projectId,
      title,
      order: nextOrder(chapters),
      status: 'outline',
    })
    set({ chapters: [...chapters, chapter] })
    return chapter
  },

  renameChapter: async (id, title) => {
    await chapterRepo.update(id, { title })
    set({ chapters: get().chapters.map((c) => (c.id === id ? { ...c, title } : c)) })
  },

  deleteChapter: async (id) => {
    const sceneIdsToDelete = get()
      .scenes.filter((s) => s.chapterId === id)
      .map((s) => s.id)
    await Promise.all([chapterRepo.remove(id), sceneRepo.bulkRemove(sceneIdsToDelete)])
    set({
      chapters: get().chapters.filter((c) => c.id !== id),
      scenes: get().scenes.filter((s) => s.chapterId !== id),
      activeSceneId: sceneIdsToDelete.includes(get().activeSceneId ?? '')
        ? null
        : get().activeSceneId,
    })
  },

  reorderChapters: async (orderedIds) => {
    const byId = new Map(get().chapters.map((c) => [c.id, c]))
    const updated = orderedIds
      .map((id, index) => {
        const chapter = byId.get(id)
        return chapter ? { ...chapter, order: index } : null
      })
      .filter((c): c is Chapter => c !== null)
    set({ chapters: updated })
    await Promise.all(updated.map((c) => chapterRepo.update(c.id, { order: c.order })))
  },

  createScene: async (chapterId, title = 'Untitled scene') => {
    const { projectId, scenes } = get()
    if (!projectId) throw new Error('No active project')
    const siblingScenes = scenes.filter((s) => s.chapterId === chapterId)
    const scene = await sceneRepo.create({
      chapterId,
      projectId,
      title,
      order: nextOrder(siblingScenes),
      content: null,
      plainText: '',
      wordCount: 0,
      status: 'outline',
      povCharacterId: null,
      locationCodexId: null,
      summary: '',
      beats: [],
      labels: [],
      linkedCodexIds: [],
    })
    set({ scenes: [...scenes, scene], activeSceneId: scene.id })
    return scene
  },

  renameScene: async (id, title) => {
    await sceneRepo.update(id, { title })
    set({ scenes: get().scenes.map((s) => (s.id === id ? { ...s, title } : s)) })
  },

  deleteScene: async (id) => {
    await sceneRepo.remove(id)
    set({
      scenes: get().scenes.filter((s) => s.id !== id),
      activeSceneId: get().activeSceneId === id ? null : get().activeSceneId,
    })
  },

  applySceneOrder: async (moves) => {
    const byId = new Map(get().scenes.map((s) => [s.id, s]))
    for (const move of moves) {
      const scene = byId.get(move.id)
      if (scene) byId.set(move.id, { ...scene, chapterId: move.chapterId, order: move.order })
    }
    set({ scenes: Array.from(byId.values()) })
    await Promise.all(
      moves.map((m) => sceneRepo.update(m.id, { chapterId: m.chapterId, order: m.order })),
    )
  },

  updateSceneContent: async (id, input) => {
    await sceneRepo.update(id, input)
    set({
      scenes: get().scenes.map((s) => (s.id === id ? { ...s, ...input } : s)),
    })
  },

  updateSceneMeta: async (id, changes) => {
    await sceneRepo.update(id, changes)
    set({ scenes: get().scenes.map((s) => (s.id === id ? { ...s, ...changes } : s)) })
  },

  updateChapterStatus: async (id, status) => {
    await chapterRepo.update(id, { status })
    set({ chapters: get().chapters.map((c) => (c.id === id ? { ...c, status } : c)) })
  },

  listSnapshots: async (sceneId) => {
    const all = await snapshotRepo.list()
    return all.filter((s) => s.sceneId === sceneId).sort((a, b) => b.createdAt - a.createdAt)
  },

  restoreSnapshot: async (snapshot) => {
    await get().updateSceneContent(snapshot.sceneId, {
      content: snapshot.content,
      plainText: snapshot.plainText,
      wordCount: snapshot.wordCount,
    })
  },

  deleteSnapshot: async (id) => {
    await snapshotRepo.remove(id)
  },
}))
