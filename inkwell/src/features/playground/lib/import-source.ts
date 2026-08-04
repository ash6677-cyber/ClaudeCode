import { codexRepo } from '@/lib/db/repositories'
import type { CodexEntry, Project } from '@/types'

/**
 * Where a cast can be imported from.
 *
 * Three scopes, because a writer's characters live in three places: this
 * book, another book they wrote, or a series where the same people walk
 * through several books at once.
 */
export type ImportScope =
  | { kind: 'project'; projectId: string }
  | { kind: 'series'; seriesId: string }

/** The books a series scope covers — a series is its member projects. */
export function projectIdsForScope(scope: ImportScope, projects: Project[]): string[] {
  if (scope.kind === 'project') return [scope.projectId]
  return projects.filter((p) => p.seriesId === scope.seriesId).map((p) => p.id)
}

/**
 * The character entries in scope, newest edits first.
 *
 * Only `type: 'character'`: importing a location as a character card would
 * produce something you cannot talk to and did not ask for. A series-wide
 * entry (one with a `seriesId` and no project) counts for that series too,
 * which is how shared casts are stored.
 */
export async function loadCharacterEntries(
  scope: ImportScope,
  projects: Project[],
): Promise<CodexEntry[]> {
  const all = await codexRepo.list()
  const ids = new Set(projectIdsForScope(scope, projects))
  return all
    .filter((e) => e.type === 'character')
    .filter((e) => {
      if (e.projectId && ids.has(e.projectId)) return true
      return scope.kind === 'series' && e.seriesId === scope.seriesId
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
