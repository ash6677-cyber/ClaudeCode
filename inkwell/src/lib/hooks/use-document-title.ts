import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useProjectStore } from '@/stores/project-store'

export const APP_NAME = 'Inkwell'

/**
 * What the browser tab says.
 *
 * Every screen used to be called "Inkwell", which makes a row of tabs — and
 * the browser history, and the task switcher, and a bookmark saved months ago
 * — completely undifferentiated. A writer with the manuscript, the Almanac
 * and a chat open had three identical tabs.
 *
 * Most specific part first, on purpose. Tab labels truncate from the right,
 * so the part that tells two tabs apart has to be at the front: with the
 * project first, ten tabs of the same book would all read "Mira Vale — …"
 * and the truncation would eat the only word that mattered.
 */
export function documentTitle(parts: (string | null | undefined)[]): string {
  const named = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p))
  return [...named, APP_NAME].join(' — ')
}

/**
 * Sets the tab title from the parts a screen knows about, and appends the
 * open book and the app name itself.
 *
 * Pass the most specific thing first — the entry being read, then the screen
 * it is on. Anything undefined is skipped, so a screen can pass a record that
 * has not loaded yet and get a sensible title now and a better one shortly.
 */
export function useDocumentTitle(...parts: (string | null | undefined)[]): void {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const projects = useProjectStore((s) => s.projects)
  const status = useProjectStore((s) => s.status)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)

  // A screen deep in a book may be the first thing loaded — a bookmark, a
  // reload, the desktop app reopening where it left off — and it would
  // otherwise have no way to know the book's name.
  useEffect(() => {
    if (projectId && status === 'idle') fetchProjects()
  }, [projectId, status, fetchProjects])

  const projectTitle = projectId ? projects.find((p) => p.id === projectId)?.title : undefined
  const title = documentTitle([...parts, projectTitle])

  useEffect(() => {
    document.title = title
  }, [title])
}
