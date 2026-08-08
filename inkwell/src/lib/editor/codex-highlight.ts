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

/** Underline decorations for every mention between `from` and `to`. */
function scanRange(
  doc: ProseMirrorNode,
  index: CodexIndex,
  from: number,
  to: number,
  out: Decoration[],
) {
  if (!index.regex) return
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return true
    const regex = index.regex!
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(node.text))) {
      const entryId = index.termToEntryId.get(match[0].toLowerCase())
      if (entryId) {
        out.push(
          Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
            class: 'codex-highlight',
            'data-codex-entry-id': entryId,
          }),
        )
      }
      if (match[0].length === 0) regex.lastIndex++
    }
    return true
  })
}

function buildDecorations(doc: ProseMirrorNode, index: CodexIndex): DecorationSet {
  if (!index.regex) return DecorationSet.empty
  const decorations: Decoration[] = []
  scanRange(doc, index, 0, doc.content.size, decorations)
  return DecorationSet.create(doc, decorations)
}

interface CodexHighlightState {
  index: CodexIndex
  decorations: DecorationSet
}

export const codexHighlightPluginKey = new PluginKey<CodexHighlightState>('codexHighlight')

/**
 * Exported for tests: the plugin itself, without a Tiptap editor around it.
 */
export function createCodexHighlightPlugin() {
  return new Plugin<CodexHighlightState>({
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
        if (!tr.docChanged || !prev.index.regex) return prev

        // Incremental on every ordinary keystroke: rescanning a whole
        // 20,000-word document per key made typing visibly stutter, and
        // 349 of its 350 paragraphs hadn't changed. Surviving decorations
        // are mapped through the edit for free; only the textblocks the
        // transaction actually touched are rescanned.
        let decorations = prev.decorations.map(tr.mapping, tr.doc)
        const size = tr.doc.content.size

        // Each step's changed span, pushed through the steps after it so
        // every range is in final-document coordinates.
        const touched: [number, number][] = []
        tr.mapping.maps.forEach((stepMap, i) => {
          const after = tr.mapping.slice(i + 1)
          stepMap.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
            touched.push([after.map(newFrom, -1), after.map(newTo, 1)])
          })
        })

        // Widen each span to whole textblocks: an edit can split or heal a
        // name, and the halves live outside the span itself.
        const blocks = new Map<number, number>()
        for (const [rawFrom, rawTo] of touched) {
          const from = Math.max(0, Math.min(rawFrom, size))
          const to = Math.max(from, Math.min(rawTo, size))
          tr.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isTextblock) {
              blocks.set(pos, pos + node.nodeSize)
              return false
            }
            return true
          })
        }

        for (const [from, to] of blocks) {
          decorations = decorations.remove(decorations.find(from, to))
          const fresh: Decoration[] = []
          scanRange(tr.doc, prev.index, from, to, fresh)
          if (fresh.length > 0) decorations = decorations.add(tr.doc, fresh)
        }
        return { index: prev.index, decorations }
      },
    },
    props: {
      decorations(state) {
        return codexHighlightPluginKey.getState(state)?.decorations
      },
    },
  })
}

export const CodexHighlight = Extension.create({
  name: 'codexHighlight',

  addProseMirrorPlugins() {
    return [createCodexHighlightPlugin()]
  },
})

/** Pushes a fresh Codex entry list into the running editor's highlight plugin. */
export function setCodexHighlightEntries(editor: Editor, entries: CodexIndexSource[]) {
  const tr = editor.view.state.tr.setMeta(codexHighlightPluginKey, { entries })
  editor.view.dispatch(tr)
}
