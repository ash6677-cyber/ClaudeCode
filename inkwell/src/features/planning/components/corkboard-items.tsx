import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { StatusDot } from '@/features/editor/components/tree-items'
import { cn } from '@/lib/utils'
import type { Chapter, Scene } from '@/types'

interface ChapterColumnProps {
  chapter: Chapter
  scenes: Scene[]
  isDropTarget: boolean
  onOpenScene: (sceneId: string) => void
}

export function ChapterColumn({ chapter, scenes, isDropTarget, onOpenScene }: ChapterColumnProps) {
  const wordCount = scenes.reduce((sum, s) => sum + s.wordCount, 0)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
    data: { type: 'chapter', chapterId: chapter.id },
  })
  const { setNodeRef: setDropRef } = useDroppable({
    id: `chapter-drop-${chapter.id}`,
    data: { type: 'chapter', chapterId: chapter.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${chapter.title}`}
          className="touch-target flex size-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/50 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{chapter.title}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {wordCount.toLocaleString()}w
        </span>
      </div>
      <div
        ref={setDropRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2.5',
          isDropTarget && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
        )}
      >
        <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {scenes.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground/70">No scenes yet</p>
          ) : (
            scenes.map((scene) => (
              <SortableSceneCard
                key={scene.id}
                scene={scene}
                chapterId={chapter.id}
                onOpen={() => onOpenScene(scene.id)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

interface SortableSceneCardProps {
  scene: Scene
  chapterId: string
  onOpen: () => void
}

export function SortableSceneCard({ scene, chapterId, onOpen }: SortableSceneCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
    data: { type: 'scene', chapterId },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
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
        <StatusDot status={scene.status} />
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium max-sm:min-h-11"
        >
          {scene.title}
        </button>
      </div>
      {scene.summary && (
        <p className="line-clamp-2 pl-[22px] text-xs text-muted-foreground">{scene.summary}</p>
      )}
      <span className="pl-[22px] text-[11px] tabular-nums text-muted-foreground/70">
        {scene.wordCount.toLocaleString()}w
      </span>
    </div>
  )
}

interface ChapterOnlyCardProps {
  chapter: Chapter
  scene?: Scene
  onOpen: () => void
}

export function ChapterOnlyCard({ chapter, scene, onOpen }: ChapterOnlyCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
    data: { type: 'chapter', chapterId: chapter.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex w-64 shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${chapter.title}`}
          className="mt-0.5 flex size-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        {scene && <StatusDot status={scene.status} />}
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold max-sm:min-h-11"
        >
          {chapter.title}
        </button>
      </div>
      {scene?.summary && (
        <p className="line-clamp-3 pl-[22px] text-xs text-muted-foreground">{scene.summary}</p>
      )}
      {scene && (
        <span className="pl-[22px] text-[11px] tabular-nums text-muted-foreground/70">
          {scene.wordCount.toLocaleString()}w
        </span>
      )}
    </div>
  )
}
