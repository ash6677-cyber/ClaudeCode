import { useLiveQuery } from 'dexie-react-hooks'
import { MoreHorizontal, Trash2, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { imageAssetRepo } from '@/lib/db/repositories'
import { useObjectUrl } from '@/lib/hooks/use-object-url'
import type { CharacterCard } from '@/types'

interface CharacterCardTileProps {
  card: CharacterCard
  projectId: string
  onDelete: () => void
}

export function CharacterCardTile({ card, projectId, onDelete }: CharacterCardTileProps) {
  const navigate = useNavigate()
  const image = useLiveQuery(
    () => (card.avatarImageId ? imageAssetRepo.get(card.avatarImageId) : Promise.resolve(undefined)),
    [card.avatarImageId],
  )
  const imageUrl = useObjectUrl(image?.blob)
  const crop = card.cropSettings ?? { x: 50, y: 50, zoom: 1 }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/cards/${card.id}?project=${projectId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/cards/${card.id}?project=${projectId}`)
        }
      }}
      className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-border bg-muted shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }}
        />
      ) : (
        <div className="flex size-full items-center justify-center brand-gradient-surface opacity-20">
          <UserRound className="size-16 text-foreground/40" strokeWidth={1.25} />
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"
      />

      <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label={`More actions for ${card.displayName}`}
              className="flex size-7 items-center justify-center rounded-md bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
        <h3 className="font-serif text-lg font-semibold leading-tight text-white drop-shadow-sm">
          {card.displayName}
        </h3>
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="border-white/15 bg-white/10 text-[10px] text-white backdrop-blur-sm"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
