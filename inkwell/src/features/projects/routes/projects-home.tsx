import { Library, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { ProjectCard } from '@/features/projects/components/project-card'
import { ProjectFormDialog } from '@/features/projects/components/project-form-dialog'
import { useProjectStore } from '@/stores/project-store'
import type { Project } from '@/types'

export function ProjectsHome() {
  const {
    projects,
    wordCounts,
    status,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  } = useProjectStore()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  function openCreateDialog() {
    setEditingProject(undefined)
    setFormKey((k) => k + 1)
    setFormOpen(true)
  }

  function openEditDialog(project: Project) {
    setEditingProject(project)
    setFormKey((k) => k + 1)
    setFormOpen(true)
  }

  async function handleSubmit(input: Parameters<typeof createProject>[0]) {
    if (editingProject) {
      await updateProject(editingProject.id, input)
      toast({ title: 'Project updated' })
    } else {
      await createProject(input)
      toast({ title: 'Project created' })
    }
  }

  async function handleConfirmDelete() {
    if (!deletingProject) return
    setDeleting(true)
    try {
      await deleteProject(deletingProject.id)
      toast({ title: `"${deletingProject.title}" deleted` })
      setDeletingProject(null)
    } catch {
      toast({ title: 'Could not delete the project', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Projects"
        description={
          status === 'ready' && projects.length > 0
            ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
            : undefined
        }
        actions={
          status === 'ready' &&
          projects.length > 0 && (
            <Button size="sm" onClick={openCreateDialog}>
              <Plus /> New project
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {status === 'loading' || status === 'idle' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : status === 'error' ? (
          <EmptyState
            icon={Library}
            title="Couldn't load your projects"
            description={error ?? 'Something went wrong reading from local storage.'}
            action={
              <Button variant="outline" onClick={() => fetchProjects()}>
                Try again
              </Button>
            }
          />
        ) : projects.length === 0 ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <EmptyState
              icon={Library}
              title="No projects yet"
              description="Create your first project to start building your manuscript, worldbuilding, and characters."
              action={
                <Button onClick={openCreateDialog}>
                  <Plus /> New project
                </Button>
              }
              className="max-w-md border-none bg-transparent"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                currentWordCount={wordCounts[project.id] ?? 0}
                onEdit={() => openEditDialog(project)}
                onDelete={() => setDeletingProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editingProject}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteDialog
        open={deletingProject !== null}
        onOpenChange={(open) => !open && setDeletingProject(null)}
        title={`Delete "${deletingProject?.title}"?`}
        description="This permanently deletes the project from this device. This can't be undone."
        pending={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
