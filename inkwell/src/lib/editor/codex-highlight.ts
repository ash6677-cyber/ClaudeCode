import { Extension, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import {
  buildMentionIndex,
  EMPTY_MENTION_INDEX,
  type MentionIndex,
  type MentionSource,
} from '@/features/almanac/lib/mentions'

/**
 * The matching itself lives in the Almanac, because the same question — where
 * is this name written? — is asked there over the whole manuscript. Sharing
 * it means a word underlined in a scene and a scene listed under an entry's
 * appearances can never disagree about what counts as a mention.
 */
export type CodexIndexSource = MentionSource
type CodexIndex = MentionIndex
const EMPTY_INDEX = EMPTY_MENTION_INDEX
const buildIndex = buildMentionIndex

function buildDecorations(doc: ProseMirrorNode, index: CodexIndex): DecorationSet {
  if (!index.regex) return DecorationSet.empty
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const regex = index.regex!
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(node.text))) {
      const entryId = index.termToEntryId.get(match[0].toLowerCase())
      if (entryId) {
        decorations.push(
          Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
            class: 'codex-highlight',
            'data-codex-entry-id': entryId,
          }),
        )
      }
      if (match[0].length === 0) regex.lastIndex++
    }
  })

  return DecorationSet.create(doc, decorations)
}

interface CodexHighlightState {
  index: CodexIndex
  decorations: DecorationSet
}

export const codexHighlightPluginKey = new PluginKey<CodexHighlightState>('codexHighlight')

export const CodexHighlight = Extension.create({
  name: 'codexHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<CodexHighlightState>({
        key: codexHighlightPluginKey,
        state: {
          init: () => ({ index: EMPTY_INDEX, decorations: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(codexHighlightPluginKey) as
              { entries: CodexIndexSource[] } | undefined
            if (meta) {
              const index = buildIndex(meta.entries)
              return { index, decorations: buildDecorations(tr.doc, index) }
            }
            if (tr.docChanged) {
              return { index: prev.index, decorations: buildDecorations(tr.doc, prev.index) }
            }
            return prev
          },
        },
        props: {
          decorations(state) {
            return codexHighlightPluginKey.getState(state)?.decorations
          },
        },
      }),
    ]
  },
})

/** Pushes a fresh Codex entry list into the running editor's highlight plugin. */
export function setCodexHighlightEntries(editor: Editor, entries: CodexIndexSource[]) {
  const tr = editor.view.state.tr.setMeta(codexHighlightPluginKey, { entries })
  editor.view.dispatch(tr)
}
