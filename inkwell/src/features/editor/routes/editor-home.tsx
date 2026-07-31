import type { Editor } from '@tiptap/react'
import { Library, Maximize2, Minimize2, PanelRight, Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AiAssistantPanel } from '@/features/editor/components/ai-assistant-panel'
import { ChapterSceneTree } from '@/features/editor/components/chapter-scene-tree'
import { FindInScene } from '@/features/editor/components/find-in-scene'
import { ManuscriptSearchPanel } from '@/features/editor/components/manuscript-search-panel'
import { SceneEditor } from '@/features/editor/components/scene-editor'
import { SceneMetadataDrawer } from '@/features/editor/components/scene-metadata-drawer'
import { useDebouncedCallback } from '@/lib/hooks/use-debounced-callback'
import { projectRepo, snapshotRepo } from '@/lib/db/repositories'
import { formatWordCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAiStore } from '@/stores/ai-store'
import { useCodexStore } from '@/stores/codex-store'
import { useEditorStore } from '@/stores/editor-store'
import { useUiStore } from '@/stores/ui-store'
import type { Project, RichContent } from '@/types'

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved'
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000

export function EditorHome() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')

  const [project, setProject] = useState<Project | null | undefined>(undefined)
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

  const status = useEditorStore((s) => s.status)
  const chapters = useEditorStore((s) => s.chapters)
  const scenes = useEditorStore((s) => s.scenes)
  const activeSceneId = useEditorStore((s) => s.activeSceneId)
  const setActiveScene = useEditorStore((s) => s.setActiveScene)
  const loadProject = useEditorStore((s) => s.loadProject)
  const updateSceneContent = useEditorStore((s) => s.updateSceneContent)

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])

  const codexEntries = useCodexStore((s) => s.entries)
  const loadCodexProject = useCodexStore((s) => s.loadProject)
  useEffect(() => {
    if (projectId) loadCodexProject(projectId)
  }, [projectId, loadCodexProject])

  const aiStoreStatus = useAiStore((s) => s.status)
  const loadAiStore = useAiStore((s) => s.loadAll)
  useEffect(() => {
    if (aiStoreStatus === 'idle') loadAiStore()
  }, [aiStoreStatus, loadAiStore])

  const focusMode = useUiStore((s) => s.focusMode)
  const setFocusMode = useUiStore((s) => s.setFocusMode)
  const manuscriptSearchOpen = useUiStore((s) => s.manuscriptSearchOpen)
  const setManuscriptSearchOpen = useUiStore((s) => s.setManuscriptSearchOpen)

  const [showMetadata, setShowMetadata] = useState(true)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findSeed, setFindSeed] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [editorEpoch, setEditorEpoch] = useState(0)
  const [snapshotVersion, setSnapshotVersion] = useState(0)
  const [liveEditor, setLiveEditor] = useState<Editor | null>(null)
  const lastSnapshotAtRef = useRef<Map<string, number>>(new Map())

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) ?? null,
    [scenes, activeSceneId],
  )
  const activeChapter = useMemo(
    () => (activeScene ? chapters.find((c) => c.id === activeScene.chapterId) : null),
    [chapters, activeScene],
  )

  const bookWordCount = useMemo(() => scenes.reduce((sum, s) => sum + s.wordCount, 0), [scenes])

  // Reset the save-status pill when the active scene changes, via render-time adjustment
  // rather than an effect (React's recommended pattern for this).
  const [renderedActiveSceneId, setRenderedActiveSceneId] = useState(activeSceneId)
  if (activeSceneId !== renderedActiveSceneId) {
    setRenderedActiveSceneId(activeSceneId)
    setSaveStatus('idle')
  }

  function openFind(query = '') {
    setFindQuery(query)
    setFindSeed((s) => s + 1)
    setFindOpen(true)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!activeScene) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'f' && e.shiftKey) {
        e.preventDefault()
        setManuscriptSearchOpen(true)
      } else if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openFind()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeScene, setManuscriptSearchOpen])

  // Reads the scene fresh from the store at call time (via getState) rather than closing
  // over the `activeScene` from render — this fires after a debounce delay, so a closure
  // would go stale after the first edit and never see subsequent content.
  const persistChange = useCallback(
    async (
      sceneId: string,
      input: { content: RichContent; plainText: string; wordCount: number },
    ) => {
      setSaveStatus('saving')
      const currentScene = useEditorStore.getState().scenes.find((s) => s.id === sceneId)
      if (!currentScene) return
      const lastSnapshot = lastSnapshotAtRef.current.get(sceneId) ?? 0
      if (
        Date.now() - lastSnapshot > SNAPSHOT_INTERVAL_MS &&
        currentScene.plainText.trim().length > 0
      ) {
        await snapshotRepo.create({
          sceneId,
          content: currentScene.content,
          plainText: currentScene.plainText,
          wordCount: currentScene.wordCount,
          label: 'Autosave',
        })
        lastSnapshotAtRef.current.set(sceneId, Date.now())
        setSnapshotVersion((v) => v + 1)
      }
      await updateSceneContent(sceneId, input)
      setSaveStatus('saved')
    },
    [updateSceneContent],
  )

  const debouncedPersist = useDebouncedCallback(persistChange, 800)

  function handleEditorChange(input: {
    content: RichContent
    plainText: string
    wordCount: number
  }) {
    if (!activeScene) return
    setSaveStatus('unsaved')
    debouncedPersist(activeScene.id, input)
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="No project selected"
          description="Open a project from the Projects page to start writing."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (project === undefined || (status === 'loading' && chapters.length === 0)) {
    return (
      <div className="flex h-full">
        <div className="w-64 shrink-0 space-y-2 border-r border-border p-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
        </div>
        <div className="flex-1 p-10">
          <Skeleton className="mx-auto h-96 max-w-2xl" />
        </div>
      </div>
    )
  }

  if (project === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="Project not found"
          description="This project may have been deleted. Head back to Projects to pick another."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {!focusMode && (
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border py-2">
          <ChapterSceneTree />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {focusMode ? (
          <div className="group pointer-events-none fixed right-5 top-4 z-10 flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 opacity-25 shadow-sm backdrop-blur transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
            <span className="pointer-events-none text-xs tabular-nums text-muted-foreground">
              {formatWordCount(bookWordCount)} words
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto size-6"
                  onClick={() => setFocusMode(false)}
                  aria-label="Exit focus mode"
                >
                  <Minimize2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exit focus mode</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <div className="min-w-0">
              {activeScene ? (
                <p className="truncate text-sm">
                  <span className="text-muted-foreground">
                    {activeChapter?.title ?? project.title}
                  </span>
                  <span className="mx-1.5 text-muted-foreground/50">/</span>
                  <span className="font-medium">{activeScene.title}</span>
                </p>
              ) : (
                <p className="truncate text-sm font-medium">{project.title}</p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="mr-2 hidden text-xs text-muted-foreground sm:inline">
                {formatWordCount(bookWordCount)} words
              </span>
              {activeScene && (
                <span
                  className={cn(
                    'mr-1 hidden text-xs sm:inline',
                    saveStatus === 'unsaved' ? 'text-muted-foreground' : 'text-muted-foreground/70',
                  )}
                >
                  {saveStatus === 'saving'
                    ? 'Saving…'
                    : saveStatus === 'unsaved'
                      ? 'Unsaved changes'
                      : saveStatus === 'saved'
                        ? 'Saved'
                        : ''}
                </span>
              )}

              {activeScene && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={findOpen ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => (findOpen ? setFindOpen(false) : openFind())}
                      aria-label="Find in scene"
                    >
                      <Search className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Find in scene (⌘F)</TooltipContent>
                </Tooltip>
              )}

              {activeScene && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={aiPanelOpen ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setAiPanelOpen((v) => !v)}
                      aria-label="AI assistant"
                    >
                      <Sparkles className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI assistant</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFocusMode(!focusMode)}
                    aria-label="Enter focus mode"
                  >
                    <Maximize2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Focus mode</TooltipContent>
              </Tooltip>

              {activeScene && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showMetadata ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setShowMetadata((v) => !v)}
                      aria-label="Toggle scene details"
                    >
                      <PanelRight className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Scene details</TooltipContent>
                </Tooltip>
              )}
            </div>
          </header>
        )}

        <div className="relative flex-1 overflow-y-auto">
          {activeScene && findOpen && (
            <FindInScene
              key={`${activeScene.id}-${findSeed}`}
              editor={liveEditor}
              initialQuery={findQuery}
              onClose={() => setFindOpen(false)}
            />
          )}
          {activeScene ? (
            <SceneEditor
              key={`${activeScene.id}-${editorEpoch}`}
              sceneId={activeScene.id}
              content={activeScene.content}
              measureWidthCh={project.settings.measureWidthCh}
              focusMode={focusMode}
              projectId={projectId}
              codexEntries={codexEntries}
              onChange={handleEditorChange}
              onEditorInstance={setLiveEditor}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={Library}
                title={chapters.length === 0 ? 'Start your manuscript' : 'No scene selected'}
                description={
                  chapters.length === 0
                    ? 'Add a chapter from the manuscript tree to begin.'
                    : 'Select a scene from the manuscript tree, or add a new one.'
                }
              />
            </div>
          )}
        </div>
      </div>

      {!focusMode && aiPanelOpen && activeScene && (
        <aside className="w-96 shrink-0 overflow-y-auto border-l border-border">
          <AiAssistantPanel
            scene={activeScene}
            editor={liveEditor}
            codexEntries={codexEntries}
            pov={project.settings.pov}
            tense={project.settings.tense}
            onClose={() => setAiPanelOpen(false)}
          />
        </aside>
      )}

      {!focusMode && !aiPanelOpen && showMetadata && activeScene && (
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border">
          <SceneMetadataDrawer
            scene={activeScene}
            onClose={() => setShowMetadata(false)}
            onContentRestored={() => setEditorEpoch((e) => e + 1)}
            snapshotVersion={snapshotVersion}
          />
        </aside>
      )}

      <ManuscriptSearchPanel
        open={manuscriptSearchOpen}
        onOpenChange={setManuscriptSearchOpen}
        onNavigate={(sceneId, query) => {
          setActiveScene(sceneId)
          openFind(query)
        }}
      />
    </div>
  )
}
