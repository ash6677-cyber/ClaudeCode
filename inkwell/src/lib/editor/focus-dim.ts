import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

interface FocusDimState {
  enabled: boolean
  decorations: DecorationSet
  /** Index of the undimmed top-level block, -1 while disabled. */
  activeIndex: number
  /** Top-level block count the decorations were built against. */
  blockCount: number
}

/** Which top-level block the cursor is in. */
function activeTopIndex(doc: ProseMirrorNode, selectionFrom: number): number {
  const $from = doc.resolve(Math.min(selectionFrom, doc.content.size))
  return Math.min($from.index(0), Math.max(doc.childCount - 1, 0))
}

/** [start, end] of the requested top-level blocks, by index. */
function blockRanges(doc: ProseMirrorNode, wanted: number[]): Map<number, [number, number]> {
  const want = new Set(wanted)
  const found = new Map<number, [number, number]>()
  doc.forEach((node, offset, index) => {
    if (want.has(index)) found.set(index, [offset, offset + node.nodeSize])
  })
  return found
}

function rebuild(doc: ProseMirrorNode, selectionFrom: number, enabled: boolean): FocusDimState {
  if (!enabled) {
    return { enabled, decorations: DecorationSet.empty, activeIndex: -1, blockCount: doc.childCount }
  }
  const activeIndex = activeTopIndex(doc, selectionFrom)
  const decorations: Decoration[] = []
  doc.forEach((node, offset, index) => {
    if (index !== activeIndex) {
      decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: 'pm-dimmed' }))
    }
  })
  return {
    enabled,
    decorations: DecorationSet.create(doc, decorations),
    activeIndex,
    blockCount: doc.childCount,
  }
}

export const focusDimPluginKey = new PluginKey<FocusDimState>('focusDim')

/**
 * Exported for tests: the plugin itself, without a Tiptap editor around it.
 */
export function createFocusDimPlugin() {
  return new Plugin<FocusDimState>({
    key: focusDimPluginKey,
    state: {
      init: (_, state) => rebuild(state.doc, state.selection.from, false),
      apply(tr, prev) {
        const meta = tr.getMeta(focusDimPluginKey) as { enabled: boolean } | undefined
        if (meta) return rebuild(tr.doc, tr.selection.from, meta.enabled)
        if (!prev.enabled) return prev
        if (!tr.docChanged && !tr.selectionSet) return prev

        // A split, merge, or paste changes what "every other paragraph"
        // means — rebuild whole. Everything else is incremental: on a
        // 350-paragraph scene, rebuilding 349 node decorations per
        // keystroke was real, visible latency, and a keystroke moves at
        // most one paragraph in and one out of the dim.
        if (tr.docChanged && tr.doc.childCount !== prev.blockCount) {
          return rebuild(tr.doc, tr.selection.from, true)
        }

        const activeIndex = activeTopIndex(tr.doc, tr.selection.from)
        let decorations = tr.docChanged ? prev.decorations.map(tr.mapping, tr.doc) : prev.decorations
        if (activeIndex === prev.activeIndex) {
          if (!tr.docChanged) return prev
          return { enabled: true, decorations, activeIndex, blockCount: prev.blockCount }
        }

        // The cursor moved paragraphs: dim the one it left, light the one
        // it entered. DecorationSet.find is inclusive at its endpoints, so
        // it also returns the neighbours whose decorations *touch* this
        // block's boundaries — only the decoration exactly covering the
        // entered block may be removed.
        const ranges = blockRanges(tr.doc, [prev.activeIndex, activeIndex])
        const entered = ranges.get(activeIndex)
        const left = ranges.get(prev.activeIndex)
        if (entered) {
          decorations = decorations.remove(
            decorations
              .find(entered[0], entered[1])
              .filter((d) => d.from === entered[0] && d.to === entered[1]),
          )
        }
        if (left) {
          decorations = decorations.add(tr.doc, [
            Decoration.node(left[0], left[1], { class: 'pm-dimmed' }),
          ])
        }
        return { enabled: true, decorations, activeIndex, blockCount: prev.blockCount }
      },
    },
    props: {
      decorations(state) {
        return focusDimPluginKey.getState(state)?.decorations
      },
    },
  })
}

export const FocusDim = Extension.create({
  name: 'focusDim',

  addProseMirrorPlugins() {
    return [createFocusDimPlugin()]
  },
})

/** Toggles paragraph-dimming on/off without recreating the editor instance. */
export function setFocusDimEnabled(editor: Editor, enabled: boolean) {
  const tr = editor.view.state.tr.setMeta(focusDimPluginKey, { enabled })
  editor.view.dispatch(tr)
}
