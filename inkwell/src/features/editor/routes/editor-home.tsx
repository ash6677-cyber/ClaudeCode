import { Feather } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PlaceholderPage } from '@/components/common/placeholder-page'
import { projectRepo } from '@/lib/db/repositories'
import type { Project } from '@/types'

export function EditorHome() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const [project, setProject] = useState<Project | null>(null)

  useEffect(() => {
    let cancelled = false
    const lookup = projectId ? projectRepo.get(projectId) : Promise.resolve(undefined)
    lookup.then((found) => {
      if (!cancelled) setProject(found ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  return (
    <PlaceholderPage
      icon={Feather}
      title="Editor"
      description={
        project
          ? `"${project.title}" is ready and waiting for the distraction-free manuscript editor with chapter and scene navigation, autosave, and focus mode.`
          : 'A distraction-free manuscript editor with chapter and scene navigation, autosave, and focus mode.'
      }
      phase="Phase 2"
    />
  )
}
