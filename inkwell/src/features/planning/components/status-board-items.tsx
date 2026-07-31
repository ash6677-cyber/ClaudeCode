import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { StatusDot } from '@/features/editor/components/tree-items'
import { cn } from '@/lib/utils'
import type { Scene, SceneStatus } from '@/types'

interface StatusColumnProps {
  status: SceneStatus
  label: string
  scenes: Scene[]
  chapterTitleById: Map<string, string>
  onOpenScene: (sceneId: string) => void
}

export function StatusColumn({
  status,
  label,
  scenes,
  chapterTitleById,
  onOpenScene,
}: StatusColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `status-${status}`, data: { status } })
  const wordCount = scenes.reduce((sum, s) => sum + s.wordCount, 0)

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
        <StatusDot status={status} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{scenes.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2.5',
          isOver && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
        )}
      >
        {scenes.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground/70">No scenes</p>
        ) : (
          scenes.map((scene) => (
            <DraggableSceneCard
              key={scene.id}
              scene={scene}
              chapterTitle={chapterTitleById.get(scene.chapterId)}
              onOpen={() => onOpenScene(scene.id)}
            />
          ))
        )}
      </div>
      {scenes.length > 0 && (
        <div className="border-t border-border px-3 py-1.5 text-[11px] tabular-nums text-muted-foreground">
          {wordCount.toLocaleString()} words
        </div>
      )}
    </div>
  )
}

interface DraggableSceneCardProps {
  scene: Scene
  chapterTitle?: string
  onOpen: () => void
}

export function DraggableSceneCard({ scene, chapterTitle, onOpen }: DraggableSceneCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: scene.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'group flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 shadow-xs transition-shadow hover:shadow-sm',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${scene.title}`}
          className="mt-0.5 flex size-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium"
        >
          {scene.title}
        </button>
      </div>
      {scene.summary && (
        <p className="line-clamp-2 pl-[22px] text-xs text-muted-foreground">{scene.summary}</p>
      )}
      <div className="flex items-center justify-between pl-[22px] text-[11px] text-muted-foreground/70">
        {chapterTitle ? <span className="truncate">{chapterTitle}</span> : <span />}
        <span className="shrink-0 tabular-nums">{scene.wordCount.toLocaleString()}w</span>
      </div>
    </div>
  )
}
