import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { LorebookEntry } from '@/types'

interface LorebookEntryRowProps {
  entry: LorebookEntry
  onChange: (changes: Partial<LorebookEntry>) => void
  onDelete: () => void
}

export function LorebookEntryRow({ entry, onChange, onDelete }: LorebookEntryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [keywordsDraft, setKeywordsDraft] = useState(entry.keywords.join(', '))

  return (
    <div className={cn('rounded-lg border border-border bg-card', !entry.enabled && 'opacity-60')}>
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {entry.constant ? 'Always included' : entry.keywords.filter(Boolean).join(', ') || 'New entry'}
            </span>
            {!expanded && (
              <span className="block truncate text-xs text-muted-foreground">
                {entry.content || 'No content yet'}
              </span>
            )}
          </span>
        </button>
        <Switch
          checked={entry.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
          aria-label={entry.enabled ? 'Disable entry' : 'Enable entry'}
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete entry"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="grid gap-3 border-t border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label>Always included</Label>
              <p className="text-xs text-muted-foreground">
                Skip keyword matching — always add this to chat context.
              </p>
            </div>
            <Switch checked={entry.constant} onCheckedChange={(v) => onChange({ constant: v })} />
          </div>

          {!entry.constant && (
            <div className="grid gap-1.5">
              <Label>Keywords</Label>
              <Input
                value={keywordsDraft}
                onChange={(e) => setKeywordsDraft(e.target.value)}
                onBlur={() =>
                  onChange({
                    keywords: keywordsDraft
                      .split(',')
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Comma-separated: names, places, triggers"
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Content</Label>
            <Textarea
              rows={3}
              value={entry.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="What the AI should know when this entry is active"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={entry.priority}
                onChange={(e) => onChange({ priority: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Token budget</Label>
              <Input
                type="number"
                min={0}
                step={50}
                value={entry.tokenBudget}
                onChange={(e) => onChange({ tokenBudget: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
