import { useLiveQuery } from 'dexie-react-hooks'
import { UserRound } from 'lucide-react'

import {
  accentFor,
  designClasses,
  designStyle,
} from '@/features/cards/lib/card-design'
import { imageAssetRepo } from '@/lib/db/repositories'
import { useObjectUrl } from '@/lib/hooks/use-object-url'
import { cn } from '@/lib/utils'
import type { CardDesign, CharacterCard, CropSettings } from '@/types'

import '@/features/cards/cards.css'

interface CardFaceProps {
  name: string
  design: CardDesign | undefined
  imageUrl: string | null
  crop: CropSettings | null
  tags?: string[]
  /** Shown over the top-right corner — the grid puts its menu here. */
  corner?: React.ReactNode
  className?: string
  /** Smaller type, for the places a card is shown at thumbnail size. */
  compact?: boolean
}

const DEFAULT_CROP: CropSettings = { x: 50, y: 50, zoom: 1 }

/**
 * A character card, drawn the same way everywhere.
 *
 * One component rather than a tile that styles itself and a detail page that
 * styles itself again, because a card that looks different depending on which
 * screen is showing it is not really a card — it is two pictures of the same
 * person. Everything that varies comes off the record, so a writer who gives
 * a character a foil arch sees a foil arch in the grid, on the detail page
 * and at the head of a chat.
 *
 * Purely presentational: no navigation, no data loading, no menus of its own.
 * The grid wraps it in a button and passes its menu through `corner`.
 */
export function CardFace({
  name,
  design,
  imageUrl,
  crop,
  tags = [],
  corner,
  className,
  compact = false,
}: CardFaceProps) {
  const c = crop ?? DEFAULT_CROP
  const style = {
    ...designStyle(design, name),
    // Read by the hover rule, so a portrait already zoomed in by cropping
    // does not lurch further on hover.
    '--card-zoom': String(c.zoom),
  } as React.CSSProperties

  return (
    <div className={cn(designClasses(design), className)} style={style}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="card-portrait"
          style={{ objectPosition: `${c.x}% ${c.y}%`, transform: `scale(${c.zoom})` }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          // The character's own colour, faintly, rather than a grey box: an
          // undrawn cast should still be scannable by colour.
          style={{
            background: `linear-gradient(160deg, color-mix(in oklab, ${accentFor(design, name)} 22%, transparent), transparent 70%)`,
          }}
        >
          <UserRound
            className={compact ? 'size-8 text-foreground/30' : 'size-16 text-foreground/30'}
            strokeWidth={1.25}
          />
        </div>
      )}

      <div className="card-vignette" aria-hidden />
      <div className="card-shine" aria-hidden />
      <div className="card-frame" aria-hidden />

      {corner && <div className="absolute right-2 top-2 z-10">{corner}</div>}

      <div className="card-footer">
        <h3 className={cn('card-name', compact ? 'text-sm' : 'text-lg')}>{name}</h3>
        <div className="card-rule" aria-hidden />
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="card-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * A card that fetches its own portrait.
 *
 * `CardFace` stays presentational — it is rendered inside an export canvas
 * and inside a chat header, neither of which wants a database read wired into
 * it. This is the convenience wrapper for screens that hold a card record and
 * simply want to see it.
 */
export function CardFacePreview({
  card,
  className,
  compact,
}: {
  card: Pick<CharacterCard, 'displayName' | 'design' | 'avatarImageId' | 'cropSettings' | 'tags'>
  className?: string
  compact?: boolean
}) {
  const image = useLiveQuery(
    () => (card.avatarImageId ? imageAssetRepo.get(card.avatarImageId) : Promise.resolve(undefined)),
    [card.avatarImageId],
  )
  const imageUrl = useObjectUrl(image?.blob)
  return (
    <CardFace
      name={card.displayName}
      design={card.design}
      imageUrl={imageUrl ?? null}
      crop={card.cropSettings}
      tags={card.tags}
      className={className}
      compact={compact}
    />
  )
}
