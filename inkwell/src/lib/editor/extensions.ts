import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'

/** Shared prose-editing extension set: the manuscript editor, its headless
 * find/replace instance, and the Codex entry body editor all use this. */
export function createProseExtensions(placeholder = 'Begin writing…') {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({ placeholder }),
    Highlight.configure({ multicolor: false }),
    CharacterCount,
  ]
}
