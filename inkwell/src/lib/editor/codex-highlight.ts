import { Extension, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface CodexIndexSource {
  id: string
  name: string
  aliases: string[]
}

interface CodexIndex {
  regex: RegExp | null
  termToEntryId: Map<string, string>
}

const EMPTY_INDEX: CodexIndex = { regex: null, termToEntryId: new Map() }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildIndex(entries: CodexIndexSource[]): CodexIndex {
  const terms: { term: string; entryId: string }[] = []
  for (const entry of entries) {
    const name = entry.name.trim()
    if (name) terms.push({ term: name, entryId: entry.id })
    for (const alias of entry.aliases) {
      const trimmed = alias.trim()
      if (trimmed) terms.push({ term: trimmed, entryId: entry.id })
    }
  }
  if (terms.length === 0) return EMPTY_INDEX

  // Longest-first so "Mara Voss" is preferred over a shorter "Mara" alias at the same position.
  terms.sort((a, b) => b.term.length - a.term.length)
  const termToEntryId = new Map(terms.map((t) => [t.term.toLowerCase(), t.entryId]))
  const pattern = `\\b(?:${terms.map((t) => escapeRegExp(t.term)).join('|')})\\b`
  return { regex: new RegExp(pattern, 'gi'), termToEntryId }
}

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
