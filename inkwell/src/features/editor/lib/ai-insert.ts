import type { Editor } from '@tiptap/react'

export interface EditorRange {
  from: number
  to: number
}

export function getSelectionRange(editor: Editor | null): EditorRange | null {
  if (!editor) return null
  const { from, to } = editor.state.selection
  if (from === to) return null
  return { from, to }
}

export function getSelectionText(editor: Editor | null): string {
  if (!editor) return ''
  const { from, to } = editor.state.selection
  if (from === to) return ''
  return editor.state.doc.textBetween(from, to, '\n')
}

/** Replaces a captured range with `text`, or inserts at the end of the document if no range. */
export function replaceOrAppend(editor: Editor | null, range: EditorRange | null, text: string) {
  if (!editor) return
  if (range) {
    editor.chain().focus().setTextSelection(range).insertContent(text).run()
  } else {
    const end = editor.state.doc.content.size
    editor.chain().focus().setTextSelection(end).insertContent(text).run()
  }
}

/** Inserts `text` right after a captured range (or at the current cursor if none). */
export function insertAfter(editor: Editor | null, range: EditorRange | null, text: string) {
  if (!editor) return
  const pos = range ? range.to : editor.state.selection.to
  editor.chain().focus().setTextSelection(pos).insertContent(text).run()
}
