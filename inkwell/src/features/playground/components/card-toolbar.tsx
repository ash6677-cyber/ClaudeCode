import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  SORT_LABEL,
  allTags,
  filterIsEmpty,
  toggleTag,
  type CardFilterState,
  type CardSort,
} from '@/features/playground/lib/card-filter'
import { cn } from '@/lib/utils'
import type { CharacterCard } from '@/types'

interface CardToolbarProps {
  cards: CharacterCard[]
  filter: CardFilterState
  onChange: (filter: CardFilterState) => void
  /** Shown at the end of the row on desktop, in the sheet on mobile. */
  actions?: React.ReactNode
}

const SORTS: CardSort[] = ['edited', 'name']

/**
 * Finding someone in a cast that has outgrown a screenful.
 *
 * On a phone the whole thing collapses to a search field and one button: a
 * row of tag chips on a 390px screen is a horizontal scroll nobody discovers,
 * so the chips move into a sheet where they have room to wrap.
 */
export function CardToolbar({ cards, filter, onChange, actions }: CardToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const tags = allTags(cards)
  const active = !filterIsEmpty(filter)

  const tagChips = (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const on = filter.tags.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={on}
            onClick={() => onChange({ ...filter, tags: toggleTag(filter.tags, tag) })}
            className={cn(
              'rounded-full border px-2.5 py-1 pointer-coarse:min-h-11 pointer-coarse:px-4 text-xs transition-colors',
              on
                ? 'border-primary bg-primary/10 font-medium text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )

  const sortChips = (
    <div className="flex gap-1.5">
      {SORTS.map((sort) => (
        <button
          key={sort}
          type="button"
          aria-pressed={filter.sort === sort}
          onClick={() => onChange({ ...filter, sort })}
          className={cn(
            'rounded-full border px-2.5 py-1 pointer-coarse:min-h-11 pointer-coarse:px-4 text-xs transition-colors',
            filter.sort === sort
              ? 'border-primary bg-primary/10 font-medium text-foreground'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {SORT_LABEL[sort]}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter.query}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
            placeholder="Find a character"
            aria-label="Find a character"
            className="h-9 pl-8"
          />
          {filter.query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange({ ...filter, query: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Button
          variant={active ? 'default' : 'outline'}
          size="icon"
          className="size-9 shrink-0 sm:hidden"
          aria-label="Filter and sort"
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
        </Button>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">{sortChips}</div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {tags.length > 0 && <div className="hidden sm:block">{tagChips}</div>}

      {active && (
        <div className="flex items-center gap-2 sm:hidden">
          <span className="text-xs text-muted-foreground">Filtered</span>
          <button
            type="button"
            onClick={() => onChange({ ...filter, query: '', tags: [] })}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="space-y-4">
          <SheetHeader>
            <SheetTitle>Filter and sort</SheetTitle>
          </SheetHeader>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Sort by</p>
            {sortChips}
          </div>
          {tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Tags — a character must have all you pick</p>
              {tagChips}
            </div>
          )}
          {active && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onChange({ ...filter, query: '', tags: [] })}
            >
              Clear filters
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
