import { create } from 'zustand'

import { projectRepo } from '@/lib/db/repositories'
import type { Project } from '@/types'

export interface ProjectFormInput {
  title: string
  author: string
  genre: string
  synopsis: string
  targetWordCount: number
  status: Project['status']
  pov: Project['settings']['pov']
  tense: Project['settings']['tense']
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ProjectStoreState {
  projects: Project[]
  status: LoadStatus
  error: string | null
  fetchProjects: () => Promise<void>
  createProject: (input: ProjectFormInput) => Promise<Project>
  updateProject: (id: string, input: ProjectFormInput) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  status: 'idle',
  error: null,

  fetchProjects: async () => {
    set({ status: 'loading', error: null })
    try {
      const projects = await projectRepo.list()
      projects.sort((a, b) => b.updatedAt - a.updatedAt)
      set({ projects, status: 'ready' })
    } catch {
      set({ status: 'error', error: 'Could not load your projects from local storage.' })
    }
  },

  createProject: async (input) => {
    const project = await projectRepo.create({
      title: input.title,
      author: input.author,
      synopsis: input.synopsis,
      genre: input.genre,
      targetWordCount: input.targetWordCount,
      coverId: null,
      seriesId: null,
      status: input.status,
      settings: {
        defaultAiPresetId: null,
        pov: input.pov,
        tense: input.tense,
        measureWidthCh: 68,
      },
    })
    set({ projects: [project, ...get().projects] })
    return project
  },

  updateProject: async (id, input) => {
    await projectRepo.update(id, {
      title: input.title,
      author: input.author,
      synopsis: input.synopsis,
      genre: input.genre,
      targetWordCount: input.targetWordCount,
      status: input.status,
      settings: {
        ...get().projects.find((p) => p.id === id)!.settings,
        pov: input.pov,
        tense: input.tense,
      },
    })
    const updated = await projectRepo.get(id)
    if (!updated) return
    set({
      projects: get()
        .projects.map((p) => (p.id === id ? updated : p))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    })
  },

  deleteProject: async (id) => {
    await projectRepo.remove(id)
    set({ projects: get().projects.filter((p) => p.id !== id) })
  },
}))
