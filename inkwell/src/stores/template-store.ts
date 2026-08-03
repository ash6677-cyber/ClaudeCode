import { create } from 'zustand'

import { BUILT_IN_TEMPLATES } from '@/features/templates/lib/templates'
import { manuscriptTemplateRepo } from '@/lib/db/repositories'
import type { ManuscriptTemplate } from '@/types'

/**
 * A template as the picker sees it, whether it ships with the app or the
 * writer wrote it. The two are the same thing to everything downstream; only
 * whether it can be edited differs.
 */
export interface TemplateChoice {
  id: string
  name: string
  description: string
  numbering: ManuscriptTemplate['numbering']
  parts: ManuscriptTemplate['parts']
  custom: boolean
}

export type TemplateDraft = Pick<
  ManuscriptTemplate,
  'name' | 'description' | 'numbering' | 'parts'
>

interface TemplateState {
  custom: ManuscriptTemplate[]
  status: 'idle' | 'loading' | 'ready'
  load: () => Promise<void>
  /** Creates a format, or updates one when `id` is given. Returns its id. */
  save: (draft: TemplateDraft, id?: string) => Promise<string>
  remove: (id: string) => Promise<void>
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  custom: [],
  status: 'idle',

  load: async () => {
    set({ status: 'loading' })
    const custom = await manuscriptTemplateRepo.list()
    custom.sort((a, b) => a.name.localeCompare(b.name))
    set({ custom, status: 'ready' })
  },

  save: async (draft, id) => {
    if (id) {
      await manuscriptTemplateRepo.update(id, draft)
      await get().load()
      return id
    }
    const created = await manuscriptTemplateRepo.create(draft)
    await get().load()
    return created.id
  },

  remove: async (id) => {
    await manuscriptTemplateRepo.remove(id)
    await get().load()
  },
}))

/**
 * Every template on offer, built-ins first.
 *
 * The writer's own formats come after rather than before deliberately: the
 * list is short, and a new user seeing "Standard novel" at the top learns
 * what a format is from the built-ins before they meet their own.
 */
export function templateChoices(custom: ManuscriptTemplate[]): TemplateChoice[] {
  return [
    ...BUILT_IN_TEMPLATES.map((template) => ({ ...template, custom: false })),
    ...custom.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      numbering: template.numbering,
      parts: template.parts,
      custom: true,
    })),
  ]
}

export function findTemplate(
  choices: TemplateChoice[],
  id: string | null | undefined,
): TemplateChoice | undefined {
  return id ? choices.find((choice) => choice.id === id) : undefined
}
