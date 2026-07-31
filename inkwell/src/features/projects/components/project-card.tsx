import { useLiveQuery } from 'dexie-react-hooks'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { imageAssetRepo } from '@/lib/db/repositories'
import { formatRelativeTime, formatWordCount } from '@/lib/format'
import { useObjectUrl } from '@/lib/hooks/use-object-url'
import { cn } from '@/lib/utils'
import type { Project, ProjectStatus } from '@/types'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  drafting: 'Drafting',
  revising: 'Revising',
  complete: 'Complete',
  archived: 'Archived',
}

const STATUS_VARIANT: Record<ProjectStatus, 'secondary' | 'success' | 'warning' | 'outline'> = {
  planning: 'outline',
  drafting: 'warning',
  revising: 'warning',
  complete: 'success',
  archived: 'secondary',
}

interface ProjectCardProps {
  project: Project
  currentWordCount: number
  onEdit: () => void
  onDelete: () => void
}

export function ProjectCard({ project, currentWordCount, onEdit, onDelete }: ProjectCardProps) {
  const navigate = useNavigate()
  const progress =
    project.targetWordCount > 0
      ? Math.min(100, Math.round((currentWordCount / project.targetWordCount) * 100))
      : 0

  const coverImage = useLiveQuery(
    () => (project.coverId ? imageAssetRepo.get(project.coverId) : Promise.resolve(undefined)),
    [project.coverId],
  )
  const coverUrl = useObjectUrl(coverImage?.blob)

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/editor?project=${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/editor?project=${project.id}`)
        }
      }}
      className="group flex cursor-pointer flex-col gap-3 p-5 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-3">
          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              className="h-14 w-10 shrink-0 rounded-sm border border-border object-cover shadow-sm"
            />
          )}
          <div className="min-w-0">
            <h3 className="truncate font-serif text-base font-semibold leading-snug">
              {project.title}
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {project.author || 'No author set'}
              {project.genre && ` · ${project.genre}`}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label={`More actions for ${project.title}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {project.synopsis && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.synopsis}</p>
      )}

      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {formatWordCount(currentWordCount)} / {formatWordCount(project.targetWordCount)} words
          </span>
          <span>{progress}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-muted/80 ring-1 ring-inset ring-border/50"
        >
          <div
            className={cn(
              'h-full rounded-full brand-gradient-surface transition-[width] duration-300',
              progress > 0 && 'shadow-[0_0_10px_-1px_var(--primary)]',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Badge variant={STATUS_VARIANT[project.status]}>{STATUS_LABEL[project.status]}</Badge>
        <span className="text-xs text-muted-foreground">
          Edited {formatRelativeTime(project.updatedAt)}
        </span>
      </div>
    </Card>
  )
}
