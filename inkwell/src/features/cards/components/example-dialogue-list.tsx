import { MessageSquarePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ExampleDialogueLine } from '@/types'

interface ExampleDialogueListProps {
  lines: ExampleDialogueLine[]
  onAdd: (input: string, response: string) => void
  onUpdate: (id: string, input: string, response: string) => void
  onRemove: (id: string) => void
}

export function ExampleDialogueList({ lines, onAdd, onUpdate, onRemove }: ExampleDialogueListProps) {
  const [draftInput, setDraftInput] = useState('')
  const [draftResponse, setDraftResponse] = useState('')

  function handleAdd() {
    if (!draftInput.trim() && !draftResponse.trim()) return
    onAdd(draftInput.trim(), draftResponse.trim())
    setDraftInput('')
    setDraftResponse('')
  }

  return (
    <div className="grid gap-3">
      {lines.map((line) => (
        <Card key={line.id} className="grid gap-2 p-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">User</Label>
            <Textarea
              rows={2}
              defaultValue={line.input}
              onBlur={(e) => onUpdate(line.id, e.target.value, line.response)}
              placeholder="What the user says…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{"Character's reply"}</Label>
            <Textarea
              rows={2}
              defaultValue={line.response}
              onBlur={(e) => onUpdate(line.id, line.input, e.target.value)}
              placeholder="How they respond, in their voice…"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={() => onRemove(line.id)}
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        </Card>
      ))}

      <Card className="grid gap-2 border-dashed p-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">User</Label>
          <Textarea
            rows={2}
            value={draftInput}
            onChange={(e) => setDraftInput(e.target.value)}
            placeholder="What the user says…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">{"Character's reply"}</Label>
          <Textarea
            rows={2}
            value={draftResponse}
            onChange={(e) => setDraftResponse(e.target.value)}
            placeholder="How they respond, in their voice…"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-fit gap-1.5"
          onClick={handleAdd}
          disabled={!draftInput.trim() && !draftResponse.trim()}
        >
          <MessageSquarePlus className="size-3.5" /> Add exchange
        </Button>
      </Card>
    </div>
  )
}
