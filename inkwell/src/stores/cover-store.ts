import { create } from 'zustand'

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

interface CoverStoreState {
  projectId: string | null
  cover: Cover | null
  status: LoadStatus

  loadProject: (projectId: string) => Promise<void>
  setSourceImage: (imageId: string | null) => Promise<void>
  setAspectPreset: (preset: CoverAspectPreset) => Promise<void>
  updateCrop: (changes: Partial<Cover['crop']>) => Promise<void>
  updateOverlay: (changes: Partial<Cover['overlay']>) => Promise<void>

  addTypographyLayer: (layer: Omit<CoverTypographyLayer, 'id'>) => Promise<void>
  updateTypographyLayer: (id: string, changes: Partial<CoverTypographyLayer>) => Promise<void>
  removeTypographyLayer: (id: string) => Promise<void>

  setExportedImage: (imageId: string) => Promise<void>
}

async function ensureCover(projectId: string): Promise<Cover> {
  const all = await coverRepo.list()
  const existing = all.find((c) => c.projectId === projectId)
  if (existing) return existing
  return coverRepo.create({
    projectId,
    sourceImageId: null,
    aspectPreset: 'ebook',
    crop: DEFAULT_CROP,
    overlay: DEFAULT_OVERLAY,
    typography: [],
    exportedImageId: null,
  })
}

export const useCoverStore = create<CoverStoreState>((set, get) => ({
  projectId: null,
  cover: null,
  status: 'idle',

  loadProject: async (projectId) => {
    set({ status: 'loading', projectId })
    try {
      const cover = await ensureCover(projectId)
      set({ cover, status: 'ready' })
    } catch {
      set({ status: 'error' })
    }
  },

  setSourceImage: async (imageId) => {
    const { cover } = get()
    if (!cover) return
    const changes = { sourceImageId: imageId, crop: DEFAULT_CROP }
    await coverRepo.update(cover.id, changes)
    set({ cover: { ...cover, ...changes } })
  },

  setAspectPreset: async (preset) => {
    const { cover } = get()
    if (!cover) return
    await coverRepo.update(cover.id, { aspectPreset: preset })
    set({ cover: { ...cover, aspectPreset: preset } })
  },

  updateCrop: async (changes) => {
    const { cover } = get()
    if (!cover) return
    const crop = { ...cover.crop, ...changes }
    await coverRepo.update(cover.id, { crop })
    set({ cover: { ...cover, crop } })
  },

  updateOverlay: async (changes) => {
    const { cover } = get()
    if (!cover) return
    const overlay = { ...cover.overlay, ...changes }
    await coverRepo.update(cover.id, { overlay })
    set({ cover: { ...cover, overlay } })
  },

  addTypographyLayer: async (layer) => {
    const { cover } = get()
    if (!cover) return
    const typography = [...cover.typography, { ...layer, id: crypto.randomUUID() }]
    await coverRepo.update(cover.id, { typography })
    set({ cover: { ...cover, typography } })
  },

  updateTypographyLayer: async (id, changes) => {
    const { cover } = get()
    if (!cover) return
    const typography = cover.typography.map((l) => (l.id === id ? { ...l, ...changes } : l))
    await coverRepo.update(cover.id, { typography })
    set({ cover: { ...cover, typography } })
  },

  removeTypographyLayer: async (id) => {
    const { cover } = get()
    if (!cover) return
    const typography = cover.typography.filter((l) => l.id !== id)
    await coverRepo.update(cover.id, { typography })
    set({ cover: { ...cover, typography } })
  },

  setExportedImage: async (imageId) => {
    const { cover, projectId } = get()
    if (!cover || !projectId) return
    await coverRepo.update(cover.id, { exportedImageId: imageId })
    await projectRepo.update(projectId, { coverId: imageId })
    set({ cover: { ...cover, exportedImageId: imageId } })
  },
}))
