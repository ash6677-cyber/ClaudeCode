import { ArrowLeft, BookOpen, Loader2, MessageCircle, Trash2 } from 'lucide-react'
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
import { ExampleDialogueList } from '@/features/playground/components/example-dialogue-list'
import { CardDesignPanel } from '@/features/playground/components/card-design-panel'
import { CardFacePreview } from '@/features/playground/components/card-face'
import { PortraitUploadField } from '@/features/playground/components/portrait-upload-field'
import { mapEntryToCard } from '@/features/playground/lib/import-characters'
import { chatToOpenFor } from '@/features/playground/lib/open-chat'
import { cardMatchesEntry, cardToEntryFields } from '@/features/playground/lib/writeback'
import { playgroundPath } from '@/features/playground/lib/playground-nav'
import { useCardStore } from '@/stores/card-store'
import { useChatStore } from '@/stores/chat-store'
import { useCodexStore } from '@/stores/codex-store'
import type { CropSettings } from '@/types'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'

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
  const createCodexEntry = useCodexStore((s) => s.createEntry)
  const updateCodexEntry = useCodexStore((s) => s.updateEntry)
  const loadChats = useChatStore((s) => s.loadProject)

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])
  useEffect(() => {
    if (projectId) loadCodexProject(projectId)
  }, [projectId, loadCodexProject])
  useEffect(() => {
    if (projectId) loadChats(projectId)
  }, [projectId, loadChats])

  const card = useMemo(() => cards.find((c) => c.id === cardId), [cards, cardId])
  useDocumentTitle(card?.displayName, 'Cards', 'Playground')

  const [nameDraft, setNameDraft] = useState(card?.displayName ?? '')
  const [tagsDraft, setTagsDraft] = useState(card?.tags.join(', ') ?? '')
  const [descriptionDraft, setDescriptionDraft] = useState(card?.description ?? '')
  const [personalityDraft, setPersonalityDraft] = useState(card?.personality ?? '')
  const [scenarioDraft, setScenarioDraft] = useState(card?.scenario ?? '')
  const [firstMessageDraft, setFirstMessageDraft] = useState(card?.firstMessage ?? '')
  const [voiceNotesDraft, setVoiceNotesDraft] = useState(card?.voiceNotes ?? '')
  const [systemPromptDraft, setSystemPromptDraft] = useState(card?.systemPromptOverride ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [openingChat, setOpeningChat] = useState(false)
  const [syncing, setSyncing] = useState(false)

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

  const linkedEntry = card?.codexEntryId
    ? (codexEntries.find((e) => e.id === card.codexEntryId) ?? null)
    : null

  /**
   * Two directions, both explicit.
   *
   * Nothing syncs on its own: merging two versions of someone's prose without
   * being asked is the failure this whole feature is built to avoid. Pulling
   * takes the Almanac's written fields; sending takes the card's. Each
   * overwrites only what the other end has an opinion about.
   */
  async function pullFromAlmanac() {
    if (!card || !linkedEntry) return
    setSyncing(true)
    try {
      if (cardMatchesEntry(card, linkedEntry)) {
        toast({ title: 'Already up to date' })
        return
      }
      const mapped = mapEntryToCard(linkedEntry)
      await updateCard(card.id, {
        displayName: mapped.displayName,
        description: mapped.description,
        personality: mapped.personality,
        tags: mapped.tags,
      })
      // The fields on this page are drafts, hydrated once when the card
      // loads; without this the record changes underneath a form still
      // showing the old text, and the writer is told it worked while looking
      // at proof that it didn't.
      setNameDraft(mapped.displayName)
      setDescriptionDraft(mapped.description)
      setPersonalityDraft(mapped.personality)
      setTagsDraft(mapped.tags.join(', '))
      toast({ title: `Updated from ${linkedEntry.name}` })
    } finally {
      setSyncing(false)
    }
  }

  async function sendToAlmanac() {
    if (!card || !projectId) return
    setSyncing(true)
    try {
      const fields = cardToEntryFields(card)
      if (linkedEntry) {
        await updateCodexEntry(linkedEntry.id, fields)
        toast({ title: `${linkedEntry.name} updated in the Almanac` })
        return
      }
      const created = await createCodexEntry({ ...fields, aliases: [], type: 'character' })
      await updateCard(card.id, { codexEntryId: created.id })
      toast({ title: `${fields.name} added to the Almanac` })
    } catch {
      toast({ title: 'Could not reach the Almanac', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
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
              <Link to={playgroundPath('cards', projectId)}>Back to Cards</Link>
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
          <Link to={playgroundPath('cards', projectId)}>
            <ArrowLeft className="size-4" /> Cards
          </Link>
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={syncing}
            onClick={linkedEntry ? pullFromAlmanac : sendToAlmanac}
            title={
              linkedEntry
                ? `Take the latest written fields from ${linkedEntry.name}`
                : 'Create an Almanac entry for this character'
            }
          >
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
            <span className="hidden sm:inline">
              {linkedEntry ? 'Pull from Almanac' : 'Add to Almanac'}
            </span>
          </Button>
          {linkedEntry && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 sm:inline-flex"
              disabled={syncing}
              onClick={sendToAlmanac}
              title={`Send this card's name, description and tags to ${linkedEntry.name}`}
            >
              Send to Almanac
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            disabled={openingChat}
            onClick={async () => {
              // One intent, not two: carry on if there is something to carry
              // on with, begin if there isn't.
              setOpeningChat(true)
              try {
                const id = await chatToOpenFor(projectId, card)
                navigate(playgroundPath('chats', projectId, `/${id}`))
              } finally {
                setOpeningChat(false)
              }
            }}
          >
            {openingChat ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageCircle className="size-4" />
            )}
            Chat
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
          {/* The real card, not a swatch, and sticky: the design controls sit
              below a tall portrait uploader, so a preview that scrolled away
              would be missing at exactly the moment it is wanted. */}
          <div className="sticky top-0 z-10 -mx-5 -mt-5 bg-card/80 px-5 pb-3 pt-5 backdrop-blur-sm">
            <CardFacePreview card={card} className="mx-auto max-w-[13rem] shadow-lg" />
          </div>

          <PortraitUploadField
            imageId={card.avatarImageId}
            cropSettings={card.cropSettings}
            onImageChange={(imageId) => updateCard(card.id, { avatarImageId: imageId })}
            onCropChange={(crop: CropSettings) => updateCard(card.id, { cropSettings: crop })}
          />

          <CardDesignPanel
            design={card.design}
            name={card.displayName}
            onChange={(design) => updateCard(card.id, { design })}
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
            <Label>Linked Almanac entry</Label>
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
              Ties this card to an Almanac entry so worldbuilding stays in sync.
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
          navigate(playgroundPath('cards', projectId))
        }}
      />
    </div>
  )
}
