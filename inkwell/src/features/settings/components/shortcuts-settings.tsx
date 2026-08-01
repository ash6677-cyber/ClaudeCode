import { Monitor, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  comboKeys,
  isApplePlatform,
  SHORTCUT_GROUPS,
  SHORTCUTS,
  type ShortcutDef,
} from '@/lib/shortcuts'
import { isTauriRuntime } from '@/lib/db/tauri-bridge'

function Keycap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground shadow-xs">
      {children}
    </kbd>
  )
}

function ShortcutRow({ shortcut, apple }: { shortcut: ShortcutDef; apple: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{shortcut.label}</p>
        {shortcut.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">{shortcut.note}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {shortcut.desktopOnly && (
          <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
            <Monitor className="size-3" /> Desktop
          </Badge>
        )}
        <div className="flex items-center gap-1">
          {comboKeys(shortcut.combo, apple).map((cap, i) => (
            <Keycap key={`${cap}-${i}`}>{cap}</Keycap>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ShortcutsSettings() {
  const [query, setQuery] = useState('')

  // Read once per mount: the platform doesn't change under a running app, and
  // this keeps the keycaps from depending on render timing.
  const apple = useMemo(() => isApplePlatform(), [])
  const desktop = useMemo(() => isTauriRuntime(), [])

  const needle = query.trim().toLowerCase()
  const matches = SHORTCUTS.filter(
    (shortcut) =>
      needle.length === 0 ||
      shortcut.label.toLowerCase().includes(needle) ||
      shortcut.group.toLowerCase().includes(needle) ||
      comboKeys(shortcut.combo, apple).join(' ').toLowerCase().includes(needle),
  )

  return (
    <div className="max-w-2xl space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shortcuts…"
          className="pl-9"
          aria-label="Search shortcuts"
        />
      </div>

      {!desktop && (
        <p className="text-xs text-muted-foreground">
          Shortcuts marked <span className="font-medium text-foreground">Desktop</span> are
          available in the INKWELL desktop app, where they live on the native menu bar.
        </p>
      )}

      {matches.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching shortcuts"
          description={`Nothing matches “${query.trim()}”.`}
        />
      ) : (
        SHORTCUT_GROUPS.map((group) => {
          const inGroup = matches.filter((shortcut) => shortcut.group === group)
          if (inGroup.length === 0) return null
          return (
            <Card key={group} className="p-5">
              <h3 className="text-sm font-semibold">{group}</h3>
              <div className="mt-1 divide-y divide-border/70">
                {inGroup.map((shortcut) => (
                  <ShortcutRow key={shortcut.id} shortcut={shortcut} apple={apple} />
                ))}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
