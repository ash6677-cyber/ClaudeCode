import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'

/** Shared between the live scene editor and the headless editor used for bulk find/replace. */
export function createSceneEditorExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({ placeholder: 'Begin writing…' }),
    Highlight.configure({ multicolor: false }),
    CharacterCount,
  ]
}
