import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

import { CodexHoverCard } from '@/features/editor/components/codex-hover-card'
import { CodexHighlight, setCodexHighlightEntries } from '@/lib/editor/codex-highlight'
import { createProseExtensions } from '@/lib/editor/extensions'
import { FocusDim, setFocusDimEnabled } from '@/lib/editor/focus-dim'
import { findScrollParent } from '@/lib/editor/scroll-utils'
import { cn } from '@/lib/utils'
import { usePreferencesStore } from '@/stores/preferences-store'
import type { CodexEntry, RichContent } from '@/types'

function recenterCaret(editor: Editor) {
  const { from } = editor.state.selection
  const coords = editor.view.coordsAtPos(from)
  const container = findScrollParent(editor.view.dom as HTMLElement)
  if (!container) return
  const containerRect = container.getBoundingClientRect()
  const targetY = containerRect.top + containerRect.height * 0.4
  const delta = coords.top - targetY
  if (Math.abs(delta) > 2) container.scrollTop += delta
}

interface SceneEditorProps {
  sceneId: string
  content: RichContent
  measureWidthCh: number
  focusMode: boolean
  projectId: string
  codexEntries: CodexEntry[]
  onChange: (input: { content: RichContent; plainText: string; wordCount: number }) => void
  onEditorInstance?: (editor: Editor | null) => void
}

const HOVER_HIDE_DELAY_MS = 150

export function SceneEditor({
  sceneId,
  content,
  measureWidthCh,
  focusMode,
  projectId,
  codexEntries,
  onChange,
  onEditorInstance,
}: SceneEditorProps) {
  const onChangeRef = useRef(onChange)
  const onEditorInstanceRef = useRef(onEditorInstance)
  useEffect(() => {
    onChangeRef.current = onChange
    onEditorInstanceRef.current = onEditorInstance
  }, [onChange, onEditorInstance])

  const typewriterMode = usePreferencesStore((s) => s.typewriterMode)
  const dimInactiveParagraphs = usePreferencesStore((s) => s.dimInactiveParagraphs)
  const typewriterActiveRef = useRef(false)
  useEffect(() => {
    typewriterActiveRef.current = focusMode && typewriterMode
  }, [focusMode, typewriterMode])

  const [hover, setHover] = useState<{ entryId: string; rect: DOMRect } | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelHide() {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  function scheduleHide() {
    cancelHide()
    hideTimeoutRef.current = setTimeout(() => setHover(null), HOVER_HIDE_DELAY_MS)
  }

  const editor = useEditor(
    {
      extensions: [...createProseExtensions(), CodexHighlight, FocusDim],
      content: content ?? '',
      autofocus: false,
      editorProps: {
        attributes: {
          class: 'editor-prose focus:outline-none',
          spellcheck: 'true',
        },
        handleDOMEvents: {
          mouseover: (_view, event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>(
              '[data-codex-entry-id]',
            )
            if (!target) return false
            cancelHide()
            setHover({
              entryId: target.dataset.codexEntryId!,
              rect: target.getBoundingClientRect(),
            })
            return false
          },
          mouseout: (_view, event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>(
              '[data-codex-entry-id]',
            )
            if (!target) return false
            scheduleHide()
            return false
          },
        },
      },
      onCreate: ({ editor }) => onEditorInstanceRef.current?.(editor),
      onUpdate: ({ editor }) => {
        onChangeRef.current({
          content: editor.getJSON(),
          plainText: editor.getText(),
          wordCount: editor.storage.characterCount.words(),
        })
        if (typewriterActiveRef.current) recenterCaret(editor)
      },
      onSelectionUpdate: ({ editor }) => {
        if (typewriterActiveRef.current) recenterCaret(editor)
      },
    },
    [sceneId],
  )

  useEffect(() => {
    return () => {
      onEditorInstanceRef.current?.(null)
      editor?.destroy()
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    setCodexHighlightEntries(editor, codexEntries)
  }, [editor, codexEntries])

  useEffect(() => {
    if (!editor) return
    setFocusDimEnabled(editor, focusMode && dimInactiveParagraphs)
  }, [editor, focusMode, dimInactiveParagraphs])

  useEffect(() => {
    if (!editor || !focusMode || !typewriterMode) return
    recenterCaret(editor)
  }, [editor, focusMode, typewriterMode])

  const hoveredEntry = hover ? codexEntries.find((e) => e.id === hover.entryId) : undefined

  return (
    <div
      className={cn(
        'mx-auto w-full px-6 py-10 transition-[max-width] duration-200',
        focusMode ? 'py-16' : 'py-10',
      )}
      style={{ maxWidth: `${measureWidthCh}ch` }}
    >
      <EditorContent editor={editor} />
      {hover && hoveredEntry && (
        <CodexHoverCard
          entry={hoveredEntry}
          rect={hover.rect}
          projectId={projectId}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  )
}
