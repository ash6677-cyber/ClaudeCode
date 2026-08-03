import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'

import {
  buildMentionIndex,
  countMentions,
  totalMentions,
  type Appearance,
} from '@/features/almanac/lib/mentions'
import { db } from '@/lib/db/schema'
import type { CodexEntry } from '@/types'

interface AppearancesListProps {
  entry: CodexEntry
  projectId: string
}

/**
 * Every scene this entry is named in.
 *
 * The link between the world and the book was one-directional: the editor
 * could tell you what a name in the prose referred to, but the entry itself
 * had no idea whether it had ever been written about. This closes it, using
 * exactly the matching the editor underlines with — so if a word is
 * highlighted in a scene, that scene is listed here.
 *
 * Counted by name and alias rather than by a stored link, because a writer
 * types a character's name; they do not remember to tag it.
 */
export function AppearancesList({ entry, projectId }: AppearancesListProps) {
  const found = useLiveQuery(async () => {
    const [scenes, chapters] = await Promise.all([db.scenes.toArray(), db.chapters.toArray()])
    const index = buildMentionIndex([
      { id: entry.id, name: entry.name, aliases: entry.aliases },
    ])
    const order = new Map(chapters.map((chapter) => [chapter.id, chapter]))

    const appearances: (Appearance & { chapterTitle: string })[] = []
    for (const scene of scenes) {
      if (scene.projectId !== projectId) continue
      const count = countMentions(scene.plainText, index).get(entry.id)
      if (!count) continue
      appearances.push({
        sceneId: scene.id,
        chapterId: scene.chapterId,
        sceneTitle: scene.title,
        chapterTitle: order.get(scene.chapterId)?.title ?? 'Unknown chapter',
        count,
      })
    }
    // Reading order, so the list traces the character through the book rather
    // than through whatever order storage happened to return.
    appearances.sort((a, b) => {
      const ca = order.get(a.chapterId)?.order ?? 0
      const cb = order.get(b.chapterId)?.order ?? 0
      return ca - cb || a.sceneTitle.localeCompare(b.sceneTitle)
    })
    return appearances
  }, [entry.id, entry.name, entry.aliases.join('|'), projectId])

  if (!found) return null
  const total = totalMentions(found)

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Appears in</h3>
        {found.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {total} {total === 1 ? 'mention' : 'mentions'}
          </span>
        )}
      </div>

      {found.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Not named anywhere in the manuscript yet. Its name and any aliases are what this
          looks for.
        </p>
      ) : (
        <ul className="space-y-1">
          {found.map((appearance) => (
            <li key={appearance.sceneId}>
              <Link
                to={`/editor?project=${projectId}&scene=${appearance.sceneId}`}
                className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{appearance.chapterTitle}</span>
                  <span className="mx-1 text-muted-foreground/50">/</span>
                  {appearance.sceneTitle}
                </span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {appearance.count}×
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
