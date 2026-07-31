import { ArrowLeft, MessageCircle, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { ExampleDialogueList } from '@/features/cards/components/example-dialogue-list'
import { PortraitUploadField } from '@/features/cards/components/portrait-upload-field'
import { useCardStore } from '@/stores/card-store'
import { useCodexStore } from '@/stores/codex-store'
import type { CropSettings } from '@/types'

export function CardDetail() {
  const { cardId } = useParams<{ cardId: string }>()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const navigate = useNavigate()
  const { toast } = useToast()

  const { cards, status, loadProject, updateCard, deleteCard, addDialogueLine, updateDialogueLine, removeDialogueLine } =
    useCardStore()
  const codexEntries = useCodexStore((s) => s.entries)
  const loadCodexProject = useCodexStore((s) => s.loadProject)

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])
  useEffect(() => {
    if (projectId) loadCodexProject(projectId)
  }, [projectId, loadCodexProject])

  const card = useMemo(() => cards.find((c) => c.id === cardId), [cards, cardId])

  const [nameDraft, setNameDraft] = useState(card?.displayName ?? '')
  const [tagsDraft, setTagsDraft] = useState(card?.tags.join(', ') ?? '')
  const [descriptionDraft, setDescriptionDraft] = useState(card?.description ?? '')
  const [personalityDraft, setPersonalityDraft] = useState(card?.personality ?? '')
  const [scenarioDraft, setScenarioDraft] = useState(card?.scenario ?? '')
  const [firstMessageDraft, setFirstMessageDraft] = useState(card?.firstMessage ?? '')
  const [voiceNotesDraft, setVoiceNotesDraft] = useState(card?.voiceNotes ?? '')
  const [systemPromptDraft, setSystemPromptDraft] = useState(card?.systemPromptOverride ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Starts undefined (not `cardId`) so that when this card's data arrives asynchronously
  // after mount — e.g. a direct page load/refresh, where the store is still empty at mount
  // time — the drafts still get hydrated even though `cardId` itself never changes.
  const [renderedCardId, setRenderedCardId] = useState<string | undefined>(undefined)
  if (card && cardId !== renderedCardId) {
    setRenderedCardId(cardId)
    setNameDraft(card.displayName)
    setTagsDraft(card.tags.join(', '))
    setDescriptionDraft(card.description)
    setPersonalityDraft(card.personality)
    setScenarioDraft(card.scenario)
    setFirstMessageDraft(card.firstMessage)
    setVoiceNotesDraft(card.voiceNotes)
    setSystemPromptDraft(card.systemPromptOverride ?? '')
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={ArrowLeft}
          title="No project selected"
          description="Open a project from the Projects page to view its character cards."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'loading' && cards.length === 0) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={ArrowLeft}
          title="Card not found"
          description="This character card may have been deleted."
          action={
            <Button asChild>
              <Link to={`/cards?project=${projectId}`}>Back to Cards</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link to={`/cards?project=${projectId}`}>
            <ArrowLeft className="size-4" /> Cards
          </Link>
        </Button>
        <div className="flex items-center gap-1.5">
          <Button size="sm" asChild className="gap-1.5">
            <Link to={`/cards/${card.id}/chat?project=${projectId}`}>
              <MessageCircle className="size-4" /> Chat
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete card"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="w-full shrink-0 space-y-5 border-b border-border p-5 lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-96">
          <PortraitUploadField
            imageId={card.avatarImageId}
            cropSettings={card.cropSettings}
            onImageChange={(imageId) => updateCard(card.id, { avatarImageId: imageId })}
            onCropChange={(crop: CropSettings) => updateCard(card.id, { cropSettings: crop })}
          />

          <div className="grid gap-1.5">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => nameDraft.trim() && nameDraft !== card.displayName && updateCard(card.id, { displayName: nameDraft.trim() })}
              placeholder="Character name"
              className="h-auto border-none px-0 font-serif text-2xl font-semibold shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="card-tags">Tags</Label>
            <Input
              id="card-tags"
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
              onBlur={() =>
                updateCard(card.id, {
                  tags: tagsDraft.split(',').map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="Comma-separated"
            />
            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {card.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Linked Codex entry</Label>
            <Select
              value={card.codexEntryId ?? 'none'}
              onValueChange={(v) => updateCard(card.id, { codexEntryId: v === 'none' ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {codexEntries.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ties this card to a Codex entry so worldbuilding stays in sync.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl flex-1 space-y-8 overflow-y-auto p-5 lg:p-8">
          <div className="grid gap-1.5">
            <Label htmlFor="card-description">Description</Label>
            <Textarea
              id="card-description"
              rows={4}
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={() => descriptionDraft !== card.description && updateCard(card.id, { description: descriptionDraft })}
              placeholder="Physical appearance, background, role in the story…"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="card-personality">Personality</Label>
            <Textarea
              id="card-personality"
              rows={4}
              value={personalityDraft}
              onChange={(e) => setPersonalityDraft(e.target.value)}
              onBlur={() => personalityDraft !== card.personality && updateCard(card.id, { personality: personalityDraft })}
              placeholder="Traits, quirks, values, fears, what makes them tick…"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="card-scenario">Scenario</Label>
            <Textarea
              id="card-scenario"
              rows={3}
              value={scenarioDraft}
              onChange={(e) => setScenarioDraft(e.target.value)}
              onBlur={() => scenarioDraft !== card.scenario && updateCard(card.id, { scenario: scenarioDraft })}
              placeholder="The situation or context a chat with this character starts from…"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="card-first-message">First message</Label>
            <Textarea
              id="card-first-message"
              rows={3}
              value={firstMessageDraft}
              onChange={(e) => setFirstMessageDraft(e.target.value)}
              onBlur={() => firstMessageDraft !== card.firstMessage && updateCard(card.id, { firstMessage: firstMessageDraft })}
              placeholder="How they greet or open a conversation, in their voice…"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="card-voice">Voice notes</Label>
            <Textarea
              id="card-voice"
              rows={3}
              value={voiceNotesDraft}
              onChange={(e) => setVoiceNotesDraft(e.target.value)}
              onBlur={() => voiceNotesDraft !== card.voiceNotes && updateCard(card.id, { voiceNotes: voiceNotesDraft })}
              placeholder="Speech patterns, catchphrases, vocabulary, dialect…"
            />
          </div>

          <div className="grid gap-2">
            <Label>Example dialogue</Label>
            <ExampleDialogueList
              lines={card.exampleDialogue}
              onAdd={(input, response) => addDialogueLine(card.id, input, response)}
              onUpdate={(id, input, response) => updateDialogueLine(card.id, id, input, response)}
              onRemove={(id) => removeDialogueLine(card.id, id)}
            />
          </div>

          <div className="grid gap-1.5 border-t border-border pt-6">
            <Label htmlFor="card-system-prompt">System prompt override</Label>
            <Textarea
              id="card-system-prompt"
              rows={3}
              value={systemPromptDraft}
              onChange={(e) => setSystemPromptDraft(e.target.value)}
              onBlur={() =>
                systemPromptDraft !== (card.systemPromptOverride ?? '') &&
                updateCard(card.id, { systemPromptOverride: systemPromptDraft.trim() || null })
              }
              placeholder="Advanced: replace the default chat system prompt entirely. Leave blank to use description, personality, and scenario together."
            />
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${card.displayName}"?`}
        description="This permanently deletes the character card from this device. This can't be undone."
        onConfirm={async () => {
          await deleteCard(card.id)
          toast({ title: `"${card.displayName}" deleted` })
          navigate(`/cards?project=${projectId}`)
        }}
      />
    </div>
  )
}
