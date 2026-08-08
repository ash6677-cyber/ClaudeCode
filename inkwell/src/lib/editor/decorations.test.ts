/**
 * The two decoration plugins, driven through real ProseMirror transactions.
 *
 * Both went incremental for speed — map what survives, rescan only touched
 * paragraphs — and incremental decoration code has exactly one failure mode:
 * drift. An underline that slides off its name by one character after an
 * edit looks like data corruption to a writer, and no eyeball check reliably
 * catches it. These tests type, split, and wander through documents and
 * assert the decorations land on precisely the right words afterwards.
 */

import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { EditorState, TextSelection, type Plugin } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

import { createProseExtensions } from './extensions'
import { codexHighlightPluginKey, createCodexHighlightPlugin } from './codex-highlight'
import { createFocusDimPlugin, focusDimPluginKey } from './focus-dim'

const schema = getSchema(createProseExtensions())

function doc(...paragraphs: string[]): ProseMirrorNode {
  return schema.node(
    'doc',
    null,
    paragraphs.map((text) => schema.node('paragraph', null, text ? [schema.text(text)] : [])),
  )
}

function stateWith(plugin: Plugin, docNode: ProseMirrorNode, cursor = 1) {
  return EditorState.create({
    schema,
    doc: docNode,
    selection: TextSelection.create(docNode, cursor),
    plugins: [plugin],
  })
}

/** Every decorated span's text, in document order. */
function decoratedTexts(state: EditorState, key: typeof codexHighlightPluginKey): string[] {
  const set = key.getState(state)!.decorations
  return set
    .find()
    .sort((a, b) => a.from - b.from)
    .map((d) => state.doc.textBetween(d.from, d.to))
}

describe('codex highlight, incrementally', () => {
  const entries = [
    { id: 'e-charlotte', name: 'Charlotte', aliases: [] },
    { id: 'e-henry', name: 'Henry', aliases: [] },
  ]

  function primed(docNode: ProseMirrorNode) {
    let state = stateWith(createCodexHighlightPlugin(), docNode)
    const tr = state.tr.setMeta(codexHighlightPluginKey, { entries })
    state = state.apply(tr)
    return state
  }

  it('finds every mention on the initial full scan', () => {
    const state = primed(doc('Charlotte waited.', 'Henry paid.', 'Charlotte left.'))
    expect(decoratedTexts(state, codexHighlightPluginKey)).toEqual([
      'Charlotte',
      'Henry',
      'Charlotte',
    ])
  })

  it('typing inside one paragraph never disturbs the others', () => {
    let state = primed(doc('Charlotte waited.', 'Henry paid.', 'Charlotte left.'))
    // Type into the middle of paragraph 2, before "paid".
    const p2 = state.doc.child(0).nodeSize + 1
    state = state.apply(state.tr.insertText('never ', p2 + 'Henry '.length))
    expect(decoratedTexts(state, codexHighlightPluginKey)).toEqual([
      'Charlotte',
      'Henry',
      'Charlotte',
    ])
    // The third underline still sits exactly on its word after the shift.
    const last = codexHighlightPluginKey.getState(state)!.decorations.find().sort((a, b) => a.from - b.from)[2]
    expect(state.doc.textBetween(last.from, last.to)).toBe('Charlotte')
  })

  it('breaking a name removes its underline; healing it brings it back', () => {
    let state = primed(doc('Charlotte waited.'))
    // "Charxlotte" is nobody.
    state = state.apply(state.tr.insertText('x', 5))
    expect(decoratedTexts(state, codexHighlightPluginKey)).toEqual([])
    state = state.apply(state.tr.delete(5, 6))
    expect(decoratedTexts(state, codexHighlightPluginKey)).toEqual(['Charlotte'])
  })

  it('typing a new mention underlines it without a full rescan', () => {
    let state = primed(doc('Nobody here.', 'Or here.'))
    expect(decoratedTexts(state, codexHighlightPluginKey)).toEqual([])
    const endOfP1 = 1 + 'Nobody here.'.length
    state = state.apply(state.tr.insertText(' Henry!', endOfP1))
    expect(decoratedTexts(state, codexHighlightPluginKey)).toEqual(['Henry'])
  })

  it('splitting a paragraph between two names keeps both underlined', () => {
    let state = primed(doc('Charlotte owed Henry.'))
    // Split right before "Henry".
    state = state.apply(state.tr.split(1 + 'Charlotte owed '.length))
    expect(state.doc.childCount).toBe(2)
    expect(decoratedTexts(state, codexHighlightPluginKey)).toEqual(['Charlotte', 'Henry'])
  })
})

describe('focus dim, incrementally', () => {
  function enabled(docNode: ProseMirrorNode, cursor = 1) {
    let state = stateWith(createFocusDimPlugin(), docNode, cursor)
    state = state.apply(state.tr.setMeta(focusDimPluginKey, { enabled: true }))
    return state
  }

  /**
   * Indices of dimmed top-level blocks. `find` is endpoint-inclusive, so a
   * block only counts as dimmed if a decoration covers it exactly — the
   * same discipline the plugin itself has to apply when removing one.
   */
  function dimmedIndices(state: EditorState): number[] {
    const set = focusDimPluginKey.getState(state)!.decorations
    const dimmed: number[] = []
    state.doc.forEach((node, offset, index) => {
      const exact = set
        .find(offset, offset + node.nodeSize)
        .filter((d) => d.from === offset && d.to === offset + node.nodeSize)
      if (exact.length > 0) dimmed.push(index)
    })
    return dimmed
  }

  it('starts empty while disabled', () => {
    const state = stateWith(createFocusDimPlugin(), doc('One.', 'Two.'))
    expect(focusDimPluginKey.getState(state)!.decorations.find()).toEqual([])
  })

  it('dims everything except the paragraph holding the cursor', () => {
    const state = enabled(doc('One.', 'Two.', 'Three.'), 1)
    expect(dimmedIndices(state)).toEqual([1, 2])
  })

  it('moving the cursor swaps exactly one dim on and one off', () => {
    let state = enabled(doc('One.', 'Two.', 'Three.'), 1)
    const p2Start = state.doc.child(0).nodeSize + 1
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, p2Start)))
    expect(dimmedIndices(state)).toEqual([0, 2])
  })

  it('typing keeps the dim on the right paragraphs as positions shift', () => {
    let state = enabled(doc('One.', 'Two.', 'Three.'), 1)
    state = state.apply(state.tr.insertText('A much longer opening sentence. ', 1))
    expect(dimmedIndices(state)).toEqual([1, 2])
    // The dimmed ranges still cover their whole blocks exactly.
    const set = focusDimPluginKey.getState(state)!.decorations
    state.doc.forEach((node, offset, index) => {
      if (index === 0) return
      const exact = set
        .find(offset, offset + node.nodeSize)
        .filter((d) => d.from === offset && d.to === offset + node.nodeSize)
      expect(exact).toHaveLength(1)
    })
  })

  it('pressing Enter rebuilds honestly: the new paragraph is the lit one', () => {
    // Enter splits at the cursor, and the cursor lands in the second half —
    // exactly the case where an unmapped decoration would dim the paragraph
    // being typed in.
    let state = enabled(doc('One.', 'Two.'), 3)
    state = state.apply(state.tr.split(3))
    expect(state.doc.childCount).toBe(3)
    expect(dimmedIndices(state)).toEqual([0, 2])
  })

  it('toggling off clears every decoration at once', () => {
    let state = enabled(doc('One.', 'Two.', 'Three.'), 1)
    state = state.apply(state.tr.setMeta(focusDimPluginKey, { enabled: false }))
    expect(focusDimPluginKey.getState(state)!.decorations.find()).toEqual([])
  })
})
