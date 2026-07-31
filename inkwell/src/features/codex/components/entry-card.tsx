import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ENTRY_TYPE_ICON, ENTRY_TYPE_LABEL } from '@/features/codex/lib/entry-type'
import { imageAssetRepo } from '@/lib/db/repositories'
import { useObjectUrl } from '@/lib/hooks/use-object-url'
import type { CodexEntry } from '@/types'

interface EntryCardProps {
  entry: CodexEntry
  projectId: string
}

export function EntryCard({ entry, projectId }: EntryCardProps) {
  const navigate = useNavigate()
  const image = useLiveQuery(
    () => (entry.imageId ? imageAssetRepo.get(entry.imageId) : Promise.resolve(undefined)),
    [entry.imageId],
  )
  const imageUrl = useObjectUrl(image?.blob)
  const Icon = ENTRY_TYPE_ICON[entry.type]

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/codex/${entry.id}?project=${projectId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/codex/${entry.id}?project=${projectId}`)
        }
      }}
      className="flex cursor-pointer flex-col gap-3 overflow-hidden p-0 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <Icon className="size-8 text-muted-foreground/40" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-serif text-base font-semibold leading-snug">{entry.name}</h3>
          <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
            <Icon className="size-3" />
            {ENTRY_TYPE_LABEL[entry.type]}
          </Badge>
        </div>
        {entry.summary && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{entry.summary}</p>
        )}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
