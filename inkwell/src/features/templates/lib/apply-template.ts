/**
 * Turning a template's plan into real chapters and scenes.
 *
 * Kept apart from `expandTemplate` so the shape of a manuscript can be worked
 * out and tested without a database, and written here in one place so every
 * route that starts a book — the new-project dialog now, anything later —
 * produces the same thing.
 */

import { expandTemplate, type PlannedChapter } from '@/features/templates/lib/templates'
import { chapterRepo, sceneRepo } from '@/lib/db/repositories'
import type { ManuscriptTemplate, StructureMode } from '@/types'

/** Creates the chapters and scenes of a plan, in order, for one project. */
export async function applyPlan(projectId: string, plan: PlannedChapter[]): Promise<void> {
  for (const [index, planned] of plan.entries()) {
    const chapter = await chapterRepo.create({
      projectId,
      title: planned.title,
      order: index,
      status: 'outline',
      kind: planned.kind,
    })
    for (const [sceneIndex, title] of planned.scenes.entries()) {
      await sceneRepo.create({
        chapterId: chapter.id,
        projectId,
        title,
        order: sceneIndex,
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
    }
  }
}

export function applyTemplate(
  projectId: string,
  template: Pick<ManuscriptTemplate, 'numbering' | 'parts'>,
  structureMode: StructureMode,
): Promise<void> {
  return applyPlan(
    projectId,
    // A chapters-only project writes into a single scene per chapter, so a
    // template asking for more would leave scenes it can never open.
    expandTemplate(template, {
      scenesPerChapter: structureMode === 'chapters-only' ? 'one' : 'template',
    }),
  )
}
