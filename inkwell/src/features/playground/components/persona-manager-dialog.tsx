import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PersonaList } from '@/features/playground/components/persona-list'

interface PersonaManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Personas without leaving a conversation.
 *
 * The list itself is a Playground screen of its own now; this stays because
 * realising mid-scene that you want to be someone else should not cost you
 * the scene.
 */
export function PersonaManagerDialog({ open, onOpenChange }: PersonaManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Personas</DialogTitle>
          <DialogDescription>
            Who you are when you chat with a character. Switch between personas per chat.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <PersonaList idPrefix="persona-dialog" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
