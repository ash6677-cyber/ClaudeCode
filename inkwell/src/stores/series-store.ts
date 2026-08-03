import { create } from 'zustand'

import { projectRepo, seriesRepo } from '@/lib/db/repositories'
import { db } from '@/lib/db/schema'
import type { Project, Series, SeriesBoxSet } from '@/types'

export const DEFAULT_BOX_SET: SeriesBoxSet = {
  caseColor: '#2a2f3a',
  foilColor: '#d8c69a',
  reveal: 0.32,
  finish: 'satin',
}

/**
 * Fills in presentation settings a stored series may predate.
 *
 * Records already in the browser's database were written before the box set
 * existed, and unlike an imported library they never pass through the schema
 * migration. Normalising on read is what keeps an older library from
 * rendering a case with no colour at all.
 */
export function withBoxSetDefaults(series: Series): Series {
  return { ...series, boxSet: { ...DEFAULT_BOX_SET, ...(series.boxSet ?? {}) } }
}

/**
 * Reading order for a series.
 *
 * `seriesOrder` is authoritative, but it is a number the writer sets and
 * nothing stops two books sharing one. Falling back to the creation date
 * breaks ties the way a reader would expect — the book written first is
 * book one — and keeps the order stable across reloads rather than letting
 * it depend on whatever order storage happened to return.
 */
export function sortByReadingOrder(books: Project[]): Project[] {
  return [...books].sort(
    (a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0) || a.createdAt - b.createdAt,
  )
}

export interface SeriesFormInput {
  name: string
  description: string
  sharedCodex: boolean
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface SeriesStoreState {
  series: Series[]
  /** Every project, so membership can be edited without a second fetch. */
  projects: Project[]
  wordCounts: Record<string, number>
  status: LoadStatus
  error: string | null

  fetchAll: () => Promise<void>
  createSeries: (input: SeriesFormInput) => Promise<Series>
  updateSeries: (id: string, input: SeriesFormInput) => Promise<void>
  updateBoxSet: (id: string, boxSet: Partial<SeriesBoxSet>) => Promise<void>
  /** Deletes the series itself; its books survive, unassigned. */
  deleteSeries: (id: string) => Promise<void>
  addBook: (seriesId: string, projectId: string) => Promise<void>
  removeBook: (projectId: string) => Promise<void>
  /** Moves a book one place earlier or later in the reading order. */
  moveBook: (seriesId: string, projectId: string, delta: number) => Promise<void>
}

export const useSeriesStore = create<SeriesStoreState>((set, get) => ({
  series: [],
  projects: [],
  wordCounts: {},
  status: 'idle',
  error: null,

  fetchAll: async () => {
    set({ status: 'loading', error: null })
    try {
      const [series, projects, scenes] = await Promise.all([
        seriesRepo.list(),
        projectRepo.list(),
        db.scenes.toArray(),
      ])
      const wordCounts: Record<string, number> = {}
      for (const scene of scenes) {
        wordCounts[scene.projectId] = (wordCounts[scene.projectId] ?? 0) + scene.wordCount
      }
      set({
        series: series.map(withBoxSetDefaults).sort((a, b) => b.updatedAt - a.updatedAt),
        projects,
        wordCounts,
        status: 'ready',
      })
    } catch {
      set({ status: 'error', error: 'Could not load your series from local storage.' })
    }
  },

  createSeries: async (input) => {
    const created = await seriesRepo.create({
      name: input.name.trim() || 'Untitled series',
      description: input.description,
      sharedCodex: input.sharedCodex,
      boxSet: { ...DEFAULT_BOX_SET },
    })
    set({ series: [created, ...get().series] })
    return created
  },

  updateSeries: async (id, input) => {
    await seriesRepo.update(id, {
      name: input.name.trim() || 'Untitled series',
      description: input.description,
      sharedCodex: input.sharedCodex,
    })
    await get().fetchAll()
  },

  updateBoxSet: async (id, boxSet) => {
    const current = get().series.find((s) => s.id === id)
    if (!current) return
    const next = { ...current.boxSet, ...boxSet }
    // Written through and mirrored locally rather than refetching: the box
    // set settings drive a live 3D scene, and a full reload on every drag of
    // the reveal slider would rebuild it from scratch each time.
    set({ series: get().series.map((s) => (s.id === id ? { ...s, boxSet: next } : s)) })
    await seriesRepo.update(id, { boxSet: next })
  },

  deleteSeries: async (id) => {
    // The books are the work; the series is only a grouping of them. Deleting
    // the grouping must never take a manuscript with it.
    const members = get().projects.filter((project) => project.seriesId === id)
    await Promise.all(members.map((project) => projectRepo.update(project.id, { seriesId: null })))
    await seriesRepo.remove(id)
    await get().fetchAll()
  },

  addBook: async (seriesId, projectId) => {
    const existing = get().projects.filter((project) => project.seriesId === seriesId)
    const nextOrder = existing.reduce((max, project) => Math.max(max, project.seriesOrder ?? 0), 0) + 1
    await projectRepo.update(projectId, { seriesId, seriesOrder: nextOrder })
    await get().fetchAll()
  },

  removeBook: async (projectId) => {
    await projectRepo.update(projectId, { seriesId: null, seriesOrder: 0 })
    await get().fetchAll()
  },

  moveBook: async (seriesId, projectId, delta) => {
    const ordered = sortByReadingOrder(
      get().projects.filter((project) => project.seriesId === seriesId),
    )
    const index = ordered.findIndex((project) => project.id === projectId)
    const target = index + delta
    if (index < 0 || target < 0 || target >= ordered.length) return

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbering the whole run rather than swapping two values: stored
    // orders can be duplicated or have gaps, and a swap would preserve both.
    await Promise.all(
      ordered.map((project, i) =>
        project.seriesOrder === i + 1
          ? Promise.resolve()
          : projectRepo.update(project.id, { seriesOrder: i + 1 }),
      ),
    )
    await get().fetchAll()
  },
}))
