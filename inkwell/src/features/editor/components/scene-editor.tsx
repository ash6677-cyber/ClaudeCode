import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'

import { createSceneEditorExtensions } from '@/features/editor/lib/extensions'
import { cn } from '@/lib/utils'
import type { RichContent } from '@/types'

interface SceneEditorProps {
  sceneId: string
  content: RichContent
  measureWidthCh: number
  focusMode: boolean
  onChange: (input: { content: RichContent; plainText: string; wordCount: number }) => void
  onEditorInstance?: (editor: Editor | null) => void
}

export function SceneEditor({
  sceneId,
  content,
  measureWidthCh,
  focusMode,
  onChange,
  onEditorInstance,
}: SceneEditorProps) {
  const onChangeRef = useRef(onChange)
  const onEditorInstanceRef = useRef(onEditorInstance)
  useEffect(() => {
    onChangeRef.current = onChange
    onEditorInstanceRef.current = onEditorInstance
  }, [onChange, onEditorInstance])

  const editor = useEditor(
    {
      extensions: createSceneEditorExtensions(),
      content: content ?? '',
      autofocus: false,
      editorProps: {
        attributes: {
          class: 'editor-prose focus:outline-none',
          spellcheck: 'true',
        },
      },
      onCreate: ({ editor }) => onEditorInstanceRef.current?.(editor),
      onUpdate: ({ editor }) => {
        onChangeRef.current({
          content: editor.getJSON(),
          plainText: editor.getText(),
          wordCount: editor.storage.characterCount.words(),
        })
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

  return (
    <div
      className={cn(
        'mx-auto w-full px-6 py-10 transition-[max-width] duration-200',
        focusMode ? 'py-16' : 'py-10',
      )}
      style={{ maxWidth: `${measureWidthCh}ch` }}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
