import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'

interface ChatMessageBubbleProps {
  message: ChatMessage
  characterName: string
  personaName: string
  streaming?: boolean
  onEdit: (content: string) => void
  onDelete: () => void
  onRegenerate?: () => void
  onSwipe?: (direction: -1 | 1) => void
  /** Keep this line — in the Almanac, or in a scene's notes. */
  onKeep?: () => void
}

export function ChatMessageBubble({
  message,
  characterName,
  personaName,
  streaming,
  onEdit,
  onDelete,
  onRegenerate,
  onSwipe,
  onKeep,
}: ChatMessageBubbleProps) {
  const { toast } = useToast()
  const isUser = message.role === 'user'
  const content = isUser ? message.content : (message.swipes[message.activeSwipe] ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)

  function commitEdit() {
    setEditing(false)
    if (draft.trim() && draft !== content) onEdit(draft)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    toast({ title: 'Copied' })
  }

  return (
    <div className={cn('group flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('flex max-w-[85%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <span className="px-1 text-[11px] font-medium text-muted-foreground">
          {isUser ? personaName : characterName}
        </span>

        {editing ? (
          <div className="w-full min-w-[16rem] space-y-1.5">
            <Textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  commitEdit()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditing(false)
                  setDraft(content)
                }
              }}
            />
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(content) }}>
                Cancel
              </Button>
              <Button size="sm" onClick={commitEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-card-foreground',
            )}
          >
            {content || (streaming ? '' : '(empty)')}
            {streaming && <Loader2 className="ml-1 inline size-3.5 animate-spin" />}
          </div>
        )}

        {!editing && !streaming && (
          <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {!isUser && message.swipes.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={message.activeSwipe === 0}
                  onClick={() => onSwipe?.(-1)}
                  aria-label="Previous response"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                {message.swipes.length <= 6 ? (
                  <span
                    className="flex items-center gap-1 px-0.5"
                    aria-label={`Response ${message.activeSwipe + 1} of ${message.swipes.length}`}
                  >
                    {message.swipes.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'size-1.5 rounded-full transition-colors',
                          i === message.activeSwipe ? 'bg-primary' : 'bg-muted-foreground/30',
                        )}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {message.activeSwipe + 1}/{message.swipes.length}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={message.activeSwipe === message.swipes.length - 1}
                  onClick={() => onSwipe?.(1)}
                  aria-label="Next response"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </>
            )}
            {!isUser && onRegenerate && (
              <Button variant="ghost" size="icon" className="size-6" onClick={onRegenerate} aria-label="Regenerate">
                <RotateCcw className="size-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setEditing(true)} aria-label="Edit message">
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={handleCopy} aria-label="Copy message">
              <Copy className="size-3.5" />
            </Button>
            {!isUser && onKeep && content.trim() && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onKeep}
                aria-label="Keep this line"
              >
                <BookmarkPlus className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-destructive hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete message"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
