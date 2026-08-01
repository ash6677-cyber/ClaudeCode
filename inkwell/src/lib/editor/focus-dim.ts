import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

interface FocusDimState {
  enabled: boolean
  decorations: DecorationSet
}

function buildDecorations(doc: ProseMirrorNode, selectionFrom: number, enabled: boolean): DecorationSet {
  if (!enabled) return DecorationSet.empty
  const decorations: Decoration[] = []

  doc.forEach((node, offset) => {
    const start = offset
    const end = offset + node.nodeSize
    const containsSelection = selectionFrom >= start && selectionFrom <= end
    if (!containsSelection) {
      decorations.push(Decoration.node(start, end, { class: 'pm-dimmed' }))
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const focusDimPluginKey = new PluginKey<FocusDimState>('focusDim')

export const FocusDim = Extension.create({
  name: 'focusDim',

  addProseMirrorPlugins() {
    return [
      new Plugin<FocusDimState>({
        key: focusDimPluginKey,
        state: {
          init: (_, state) => ({
            enabled: false,
            decorations: buildDecorations(state.doc, state.selection.from, false),
          }),
          apply(tr, prev) {
            const meta = tr.getMeta(focusDimPluginKey) as { enabled: boolean } | undefined
            const enabled = meta ? meta.enabled : prev.enabled
            if (!tr.docChanged && !tr.selectionSet && !meta) return prev
            return { enabled, decorations: buildDecorations(tr.doc, tr.selection.from, enabled) }
          },
        },
        props: {
          decorations(state) {
            return focusDimPluginKey.getState(state)?.decorations
          },
        },
      }),
    ]
  },
})

/** Toggles paragraph-dimming on/off without recreating the editor instance. */
export function setFocusDimEnabled(editor: Editor, enabled: boolean) {
  const tr = editor.view.state.tr.setMeta(focusDimPluginKey, { enabled })
  editor.view.dispatch(tr)
}
