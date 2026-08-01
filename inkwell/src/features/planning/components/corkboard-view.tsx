import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ChapterColumn,
  ChapterOnlyCard,
} from '@/features/planning/components/corkboard-items'
import { StatusDot } from '@/features/editor/components/tree-items'
import { useEditorStore } from '@/stores/editor-store'
import type { Scene, StructureMode } from '@/types'

type DragItemData = { type: 'chapter'; chapterId: string } | { type: 'scene'; chapterId: string }

interface CorkboardViewProps {
  projectId: string
  structureMode: StructureMode
}

export function CorkboardView({ projectId, structureMode }: CorkboardViewProps) {
  const chapters = useEditorStore((s) => s.chapters)
  const scenes = useEditorStore((s) => s.scenes)
  const setActiveScene = useEditorStore((s) => s.setActiveScene)
  const reorderChapters = useEditorStore((s) => s.reorderChapters)
  const applySceneOrder = useEditorStore((s) => s.applySceneOrder)
  const navigate = useNavigate()

  const [activeDrag, setActiveDrag] = useState<{ type: 'chapter' | 'scene'; id: string } | null>(
    null,
  )
  const [overChapterId, setOverChapterId] = useState<string | null>(null)

  const chaptersSorted = useMemo(() => [...chapters].sort((a, b) => a.order - b.order), [chapters])
  const scenesByChapter = useMemo(() => {
    const map = new Map<string, Scene[]>()
    for (const chapter of chaptersSorted) map.set(chapter.id, [])
    for (const scene of [...scenes].sort((a, b) => a.order - b.order)) {
      map.get(scene.chapterId)?.push(scene)
    }
    return map
  }, [chaptersSorted, scenes])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function openScene(sceneId: string) {
    setActiveScene(sceneId)
    navigate(`/editor?project=${projectId}`)
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragItemData | undefined
    if (!data) return
    setActiveDrag({ type: data.type, id: String(event.active.id) })
  }

  function handleDragOver(event: DragOverEvent) {
    const activeData = event.active.data.current as DragItemData | undefined
    if (activeData?.type !== 'scene') {
      setOverChapterId(null)
      return
    }
    const overData = event.over?.data.current as DragItemData | undefined
    setOverChapterId(overData?.chapterId ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null)
    setOverChapterId(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as DragItemData | undefined
    if (!activeData) return

    if (activeData.type === 'chapter') {
      const overData = over.data.current as DragItemData | undefined
      if (overData?.type !== 'chapter' || active.id === over.id) return
      const ids = chaptersSorted.map((c) => c.id)
      const oldIndex = ids.indexOf(String(active.id))
      const newIndex = ids.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return
      reorderChapters(arrayMove(ids, oldIndex, newIndex))
      return
    }

    const sceneId = String(active.id)
    const sourceChapterId = activeData.chapterId
    const overData = over.data.current as DragItemData | undefined
    if (!overData) return

    const destChapterId = overData.chapterId
    const destSiblingIds = (scenesByChapter.get(destChapterId) ?? [])
      .map((s) => s.id)
      .filter((id) => id !== sceneId)

    let destIndex: number
    if (overData.type === 'scene') {
      const overIndex = destSiblingIds.indexOf(String(over.id))
      destIndex = overIndex === -1 ? destSiblingIds.length : overIndex
    } else {
      destIndex = destSiblingIds.length
    }

    if (sourceChapterId === destChapterId) {
      const newList = [...destSiblingIds]
      newList.splice(destIndex, 0, sceneId)
      applySceneOrder(newList.map((id, index) => ({ id, chapterId: destChapterId, order: index })))
    } else {
      const sourceSiblingIds = (scenesByChapter.get(sourceChapterId) ?? [])
        .map((s) => s.id)
        .filter((id) => id !== sceneId)
      const newDestList = [...destSiblingIds]
      newDestList.splice(destIndex, 0, sceneId)
      applySceneOrder([
        ...sourceSiblingIds.map((id, index) => ({ id, chapterId: sourceChapterId, order: index })),
        ...newDestList.map((id, index) => ({ id, chapterId: destChapterId, order: index })),
      ])
    }
  }

  const activeChapter =
    activeDrag?.type === 'chapter' ? chapters.find((c) => c.id === activeDrag.id) : null
  const activeScene =
    activeDrag?.type === 'scene' ? scenes.find((s) => s.id === activeDrag.id) : null

  if (chaptersSorted.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No chapters yet — add one from the Editor to start planning.
      </p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveDrag(null)
        setOverChapterId(null)
      }}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        <SortableContext
          items={chaptersSorted.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {chaptersSorted.map((chapter) => {
            const chapterScenes = scenesByChapter.get(chapter.id) ?? []

            if (structureMode === 'chapters-only') {
              const scene = chapterScenes[0]
              return (
                <ChapterOnlyCard
                  key={chapter.id}
                  chapter={chapter}
                  scene={scene}
                  onOpen={() => scene && openScene(scene.id)}
                />
              )
            }

            return (
              <ChapterColumn
                key={chapter.id}
                chapter={chapter}
                scenes={chapterScenes}
                isDropTarget={overChapterId === chapter.id}
                onOpenScene={openScene}
              />
            )
          })}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeChapter ? (
          <div className="w-64 rounded-lg border border-border bg-card p-3 text-sm font-semibold shadow-lg">
            {activeChapter.title}
          </div>
        ) : activeScene ? (
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
