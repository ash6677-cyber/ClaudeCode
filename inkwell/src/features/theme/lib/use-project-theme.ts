import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { projectRepo } from '@/lib/db/repositories'
import { useThemeStore } from '@/stores/theme-store'

/**
 * Notices which book is open, and whether it has a look of its own.
 *
 * Mounted in the app shell rather than alongside `useApplyTheme`, because that
 * one sits above the router and cannot read the URL. This reports what it
 * finds into the store; the applying still happens in one place.
 *
 * Read straight from the repository rather than from the project list, which
 * is only loaded on the screens that show it: a writer who opens the app on a
 * bookmarked editor URL has no list, and would otherwise get the wrong look
 * until something else happened to fetch one.
 */
export function useProjectTheme(): void {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const setProjectTheme = useThemeStore((s) => s.setProjectTheme)

  useEffect(() => {
    if (!projectId) {
      setProjectTheme(null)
      return
    }

    // Guarded so a slow read for a book the writer has already navigated away
    // from cannot arrive late and dress the app in the wrong look.
    let current = true
    void projectRepo.get(projectId).then((project) => {
      if (current) setProjectTheme(project?.themeId ?? null)
    })
    return () => {
      current = false
    }
  }, [projectId, setProjectTheme])
}
