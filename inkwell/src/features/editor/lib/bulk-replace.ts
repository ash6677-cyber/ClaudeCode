import { Editor } from '@tiptap/core'

import { sceneRepo } from '@/lib/db/repositories'
import type { Scene } from '@/types'

import { createSceneEditorExtensions } from './extensions'
import { replaceAllMatches } from './text-search'

export interface BulkReplaceResult {
  scenesChanged: number
  occurrences: number
}

/**
 * Replaces every occurrence of `query` with `replacement` across all given scenes,
 * preserving rich-text formatting by running the same replace algorithm used for
 * find-in-scene through a detached, unmounted editor instance (never shown to the user).
 */
export async function bulkReplaceAcrossScenes(
  scenes: Scene[],
  query: string,
  replacement: string,
  caseSensitive: boolean,
): Promise<BulkReplaceResult> {
  if (!query) return { scenesChanged: 0, occurrences: 0 }

  const headless = new Editor({
    element: document.createElement('div'),
    extensions: createSceneEditorExtensions(),
    content: '',
  })

  let scenesChanged = 0
  let occurrences = 0

  try {
    for (const scene of scenes) {
      headless.commands.setContent(scene.content ?? '')
      const count = replaceAllMatches(headless, query, replacement, caseSensitive)
      if (count > 0) {
        occurrences += count
        scenesChanged += 1
        await sceneRepo.update(scene.id, {
          content: headless.getJSON(),
          plainText: headless.getText(),
          wordCount: headless.storage.characterCount.words(),
        })
      }
    }
  } finally {
    headless.destroy()
  }

  return { scenesChanged, occurrences }
}
