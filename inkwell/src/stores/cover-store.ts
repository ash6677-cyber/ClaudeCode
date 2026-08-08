import { create } from 'zustand'

import {
  emptyHistory,
  record,
  redo as redoHistory,
  undo as undoHistory,
  type DesignHistory,
} from '@/features/covers/lib/design-history'
import { pickCoverFor } from '@/features/covers/lib/resolve-cover'
import { coverRepo, projectRepo } from '@/lib/db/repositories'
import type { Cover, CoverAspectPreset, CoverTypographyLayer } from '@/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const DEFAULT_CROP: Cover['crop'] = { x: 50, y: 50, zoom: 1, rotation: 0 }
const DEFAULT_OVERLAY: Cover['overlay'] = {
  enabled: true,
  color: '#000000',
  opacity: 0.35,
  direction: 'bottom',
}

/**
 * The part of a cover that undo protects.
 *
 * The design, and nothing else: which variant is active is a choice about
 * the library, not about this design, and `exportedImageId` is a record of a
 * download. Undoing either would be undo reaching outside the studio.
 */
type Design = Pick<Cover, 'sourceImageId' | 'aspectPreset' | 'crop' | 'overlay' | 'typography'>

function designOf(cover: Cover): Design {
  return {
    sourceImageId: cover.sourceImageId,
    aspectPreset: cover.aspectPreset,
    crop: { ...cover.crop },
    overlay: { ...cover.overlay },
    typography: cover.typography.map((layer) => ({ ...layer })),
  }
}

interface CoverStoreState {
  projectId: string | null
  /** Every design this project has, oldest first — the picker's order. */
  variants: Cover[]
  /** The one open in the studio. Not necessarily the active one. */
  cover: Cover | null
  status: LoadStatus
  history: DesignHistory<Design>

  loadProject: (projectId: string) => Promise<void>
  setSourceImage: (imageId: string | null) => Promise<void>
  setAspectPreset: (preset: CoverAspectPreset) => Promise<void>
  updateCrop: (changes: Partial<Cover['crop']>) => Promise<void>
  updateOverlay: (changes: Partial<Cover['overlay']>) => Promise<void>

  addTypographyLayer: (layer: Omit<CoverTypographyLayer, 'id'>) => Promise<void>
  updateTypographyLayer: (id: string, changes: Partial<CoverTypographyLayer>) => Promise<void>
  removeTypographyLayer: (id: string) => Promise<void>

  setExportedImage: (imageId: string) => Promise<void>

  selectVariant: (id: string) => void
  createVariant: (options?: { duplicate?: boolean }) => Promise<void>
  renameVariant: (id: string, name: string) => Promise<void>
  activateVariant: (id: string) => Promise<void>
  deleteVariant: (id: string) => Promise<void>

  undo: () => Promise<void>
  redo: () => Promise<void>
}

function blankDesign(projectId: string) {
  return {
    projectId,
    sourceImageId: null,
    aspectPreset: 'ebook' as const,
    crop: DEFAULT_CROP,
    overlay: DEFAULT_OVERLAY,
    typography: [],
    exportedImageId: null,
  }
}

const byAge = (a: Cover, b: Cover) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)

export const useCoverStore = create<CoverStoreState>((set, get) => {
  /** One design change: remember what was, write what is. */
  async function commit(changes: Partial<Cover>) {
    const { cover, history, variants } = get()
    if (!cover) return
    const next = { ...cover, ...changes }
    await coverRepo.update(cover.id, changes)
    set({
      cover: next,
      history: record(history, designOf(cover), Date.now()),
      variants: variants.map((v) => (v.id === cover.id ? next : v)),
    })
  }

  /** Undo and redo restore whole designs, through the same write path. */
  async function restore(design: Design, history: DesignHistory<Design>) {
    const { cover, variants } = get()
    if (!cover) return
    const next = { ...cover, ...design }
    await coverRepo.update(cover.id, design)
    set({
      cover: next,
      history,
      variants: variants.map((v) => (v.id === cover.id ? next : v)),
    })
  }

  return {
    projectId: null,
    variants: [],
    cover: null,
    status: 'idle',
    history: emptyHistory<Design>(),

    loadProject: async (projectId) => {
      set({ status: 'loading', projectId })
      try {
        let mine = (await coverRepo.list()).filter((c) => c.projectId === projectId).sort(byAge)
        if (mine.length === 0) {
          mine = [await coverRepo.create(blankDesign(projectId))]
        }
        // Open the design the book is actually wearing — the same pick the
        // shelf makes, so the studio never edits a different row from the
        // one the rest of the app is drawing.
        const cover = pickCoverFor(mine, projectId) ?? mine[0]
        set({ variants: mine, cover, status: 'ready', history: emptyHistory<Design>() })
      } catch {
        set({ status: 'error' })
      }
    },

    setSourceImage: (imageId) => commit({ sourceImageId: imageId, crop: DEFAULT_CROP }),
    setAspectPreset: (preset) => commit({ aspectPreset: preset }),

    updateCrop: async (changes) => {
      const { cover } = get()
      if (!cover) return
      await commit({ crop: { ...cover.crop, ...changes } })
    },

    updateOverlay: async (changes) => {
      const { cover } = get()
      if (!cover) return
      await commit({ overlay: { ...cover.overlay, ...changes } })
    },

    addTypographyLayer: async (layer) => {
      const { cover } = get()
      if (!cover) return
      await commit({ typography: [...cover.typography, { ...layer, id: crypto.randomUUID() }] })
    },

    updateTypographyLayer: async (id, changes) => {
      const { cover } = get()
      if (!cover) return
      await commit({
        typography: cover.typography.map((l) => (l.id === id ? { ...l, ...changes } : l)),
      })
    },

    removeTypographyLayer: async (id) => {
      const { cover } = get()
      if (!cover) return
      await commit({ typography: cover.typography.filter((l) => l.id !== id) })
    },

    setExportedImage: async (imageId) => {
      const { cover, projectId, variants } = get()
      if (!cover || !projectId) return
      // A download, not a design change — it does not enter the undo history.
      await coverRepo.update(cover.id, { exportedImageId: imageId })
      await projectRepo.update(projectId, { coverId: imageId })
      const next = { ...cover, exportedImageId: imageId }
      set({ cover: next, variants: variants.map((v) => (v.id === cover.id ? next : v)) })
    },

    // ── Variants ────────────────────────────────────────────────────────────

    selectVariant: (id) => {
      const { variants, cover } = get()
      const chosen = variants.find((v) => v.id === id)
      if (!chosen || chosen.id === cover?.id) return
      // Undo is a stack of this design's states; carrying it across would
      // let undo paste one design's past onto another.
      set({ cover: chosen, history: emptyHistory<Design>() })
    },

    createVariant: async (options = {}) => {
      const { projectId, cover, variants } = get()
      if (!projectId) return
      const created = await coverRepo.create({
        ...(options.duplicate && cover ? { ...blankDesign(projectId), ...designOf(cover) } : blankDesign(projectId)),
        projectId,
        name: `Cover ${variants.length + 1}`,
        exportedImageId: null,
      })
      set({
        variants: [...variants, created].sort(byAge),
        cover: created,
        history: emptyHistory<Design>(),
      })
    },

    renameVariant: async (id, name) => {
      const { variants, cover } = get()
      const trimmed = name.trim()
      await coverRepo.update(id, { name: trimmed })
      const rename = (v: Cover) => (v.id === id ? { ...v, name: trimmed } : v)
      set({ variants: variants.map(rename), cover: cover ? rename(cover) : cover })
    },

    activateVariant: async (id) => {
      const { variants, cover } = get()
      // One active per project, enforced by writing both sides rather than
      // trusting a rule nothing checks. Rows that predate variants have no
      // flag and would otherwise still win by being newest.
      for (const variant of variants) {
        const shouldBe = variant.id === id
        if ((variant.active ?? false) !== shouldBe) {
          await coverRepo.update(variant.id, { active: shouldBe })
        }
      }
      const mark = (v: Cover) => ({ ...v, active: v.id === id })
      set({ variants: variants.map(mark), cover: cover ? mark(cover) : cover })
    },

    deleteVariant: async (id) => {
      const { variants, cover, projectId } = get()
      if (!projectId || variants.length <= 1) return
      await coverRepo.remove(id)
      const remaining = variants.filter((v) => v.id !== id)
      const nextOpen =
        cover?.id === id ? (pickCoverFor(remaining, projectId) ?? remaining[0]) : cover
      set({
        variants: remaining,
        cover: nextOpen,
        history: cover?.id === id ? emptyHistory<Design>() : get().history,
      })
    },

    // ── Undo ────────────────────────────────────────────────────────────────

    undo: async () => {
      const { cover, history } = get()
      if (!cover) return
      const step = undoHistory(history, designOf(cover))
      if (!step) return
      await restore(step.snapshot, step.history)
    },

    redo: async () => {
      const { cover, history } = get()
      if (!cover) return
      const step = redoHistory(history, designOf(cover))
      if (!step) return
      await restore(step.snapshot, step.history)
    },
  }
})
