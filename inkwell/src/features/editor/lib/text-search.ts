import type { Editor } from '@tiptap/react'

export interface TextMatch {
  from: number
  to: number
}

function buildRegex(query: string, caseSensitive: boolean): RegExp | null {
  const trimmed = query
  if (!trimmed) return null
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, caseSensitive ? 'g' : 'gi')
}

/** Finds every occurrence of `query` in the editor's document, as ProseMirror position ranges. */
export function findMatches(editor: Editor, query: string, caseSensitive: boolean): TextMatch[] {
  const regex = buildRegex(query, caseSensitive)
  if (!regex) return []

  const matches: TextMatch[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(node.text))) {
      matches.push({ from: pos + match.index, to: pos + match.index + match[0].length })
      if (match[0].length === 0) regex.lastIndex++
    }
  })
  return matches
}

/** Replaces a single known range and returns the editor to a stable state. */
export function replaceRange(editor: Editor, match: TextMatch, replacement: string) {
  editor.chain().focus().setTextSelection(match).insertContent(replacement).run()
}

/**
 * Replaces every match in the document. Applies back-to-front so earlier match
 * positions stay valid as later ones are rewritten. Returns the number replaced.
 */
export function replaceAllMatches(
  editor: Editor,
  query: string,
  replacement: string,
  caseSensitive: boolean,
): number {
  const matches = findMatches(editor, query, caseSensitive)
  for (let i = matches.length - 1; i >= 0; i--) {
    editor.chain().setTextSelection(matches[i]).insertContent(replacement).run()
  }
  return matches.length
}
