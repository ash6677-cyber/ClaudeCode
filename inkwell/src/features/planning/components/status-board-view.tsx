import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { StatusDot } from '@/features/editor/components/tree-items'
import { StatusColumn } from '@/features/planning/components/status-board-items'
import { useEditorStore } from '@/stores/editor-store'
import type { Scene, SceneStatus } from '@/types'

const COLUMNS: { status: SceneStatus; label: string }[] = [
  { status: 'outline', label: 'Outline' },
  { status: 'drafting', label: 'Drafting' },
  { status: 'revised', label: 'Revised' },
  { status: 'done', label: 'Done' },
]

interface StatusBoardViewProps {
  projectId: string
}

export function StatusBoardView({ projectId }: StatusBoardViewProps) {
  const scenes = useEditorStore((s) => s.scenes)
  const chapters = useEditorStore((s) => s.chapters)
  const setActiveScene = useEditorStore((s) => s.setActiveScene)
  const updateSceneMeta = useEditorStore((s) => s.updateSceneMeta)
  const navigate = useNavigate()

  const [activeId, setActiveId] = useState<string | null>(null)

  const chapterTitleById = useMemo(() => new Map(chapters.map((c) => [c.id, c.title])), [chapters])
  const scenesByStatus = useMemo(() => {
    const map = new Map<SceneStatus, Scene[]>()
    for (const col of COLUMNS) map.set(col.status, [])
    const chapterOrder = new Map(chapters.map((c) => [c.id, c.order]))
    const sorted = [...scenes].sort((a, b) => {
      const chapterDiff = (chapterOrder.get(a.chapterId) ?? 0) - (chapterOrder.get(b.chapterId) ?? 0)
      return chapterDiff !== 0 ? chapterDiff : a.order - b.order
    })
    for (const scene of sorted) map.get(scene.status)?.push(scene)
    return map
  }, [scenes, chapters])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )

  function openScene(sceneId: string) {
    setActiveScene(sceneId)
    navigate(`/editor?project=${projectId}`)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const newStatus = over.data.current?.status as SceneStatus | undefined
    if (!newStatus) return
    const scene = scenes.find((s) => s.id === active.id)
    if (scene && scene.status !== newStatus) updateSceneMeta(scene.id, { status: newStatus })
  }

  const activeScene = activeId ? scenes.find((s) => s.id === activeId) : null

  if (scenes.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No scenes yet — add chapters and scenes from the Editor to start tracking status.
      </p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {COLUMNS.map((col) => (
          <StatusColumn
            key={col.status}
            status={col.status}
            label={col.label}
            scenes={scenesByStatus.get(col.status) ?? []}
            chapterTitleById={chapterTitleById}
            onOpenScene={openScene}
          />
        ))}
      </div>
      <DragOverlay>
        {activeScene ? (
          <div className="w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <StatusDot status={activeScene.status} /> {activeScene.title}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
