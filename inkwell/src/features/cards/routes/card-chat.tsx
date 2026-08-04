import {
  ArrowLeft,
  BookMarked,
  MessageSquarePlus,
  MoreHorizontal,
  PanelLeft,
  Send,
  Settings2,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ConfirmDeleteDialog } from '@/components/common/confirm-delete-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { VisuallyHidden } from '@/components/common/visually-hidden'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { ChatMessageBubble } from '@/features/cards/components/chat-message-bubble'
import { PersonaManagerDialog } from '@/features/cards/components/persona-manager-dialog'
import { buildChatPrompt } from '@/lib/ai/chat-prompt-builder'
import { useAiGeneration } from '@/lib/ai/use-ai-generation'
import { cn } from '@/lib/utils'
import { useAiStore } from '@/stores/ai-store'
import { useCardStore } from '@/stores/card-store'
import { useChatStore } from '@/stores/chat-store'
import { useLorebookStore } from '@/stores/lorebook-store'
import { usePersonaStore } from '@/stores/persona-store'
import type { ChatMessage, ChatMode } from '@/types'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'

export function CardChat() {
  const { cardId } = useParams<{ cardId: string }>()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const { toast } = useToast()

  const cards = useCardStore((s) => s.cards)
  const cardStatus = useCardStore((s) => s.status)
  const loadCardsProject = useCardStore((s) => s.loadProject)
  const card = useMemo(() => cards.find((c) => c.id === cardId), [cards, cardId])
  useDocumentTitle(card?.displayName, 'Chat')

  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const loadCard = useChatStore((s) => s.loadCard)
  const createChat = useChatStore((s) => s.createChat)
  const renameChat = useChatStore((s) => s.renameChat)
  const deleteChat = useChatStore((s) => s.deleteChat)
  const setMode = useChatStore((s) => s.setMode)
  const setPersonaId = useChatStore((s) => s.setPersona)
  const setPresetId = useChatStore((s) => s.setPreset)
  const sendUserMessage = useChatStore((s) => s.sendUserMessage)
  const appendAssistantMessage = useChatStore((s) => s.appendAssistantMessage)
  const addSwipe = useChatStore((s) => s.addSwipe)
  const setActiveSwipe = useChatStore((s) => s.setActiveSwipe)
  const editMessage = useChatStore((s) => s.editMessage)
  const deleteMessage = useChatStore((s) => s.deleteMessage)

  const personas = usePersonaStore((s) => s.personas)
  const loadPersonas = usePersonaStore((s) => s.loadAll)

  const lorebooks = useLorebookStore((s) => s.lorebooks)
  const loadLorebooksProject = useLorebookStore((s) => s.loadProject)

  const presets = useAiStore((s) => s.presets)
  const providers = useAiStore((s) => s.providers)
  const loadAiStore = useAiStore((s) => s.loadAll)

  useEffect(() => {
    if (projectId) loadCardsProject(projectId)
  }, [projectId, loadCardsProject])
  useEffect(() => {
    if (cardId) loadCard(cardId)
  }, [cardId, loadCard])
  useEffect(() => {
    loadPersonas()
  }, [loadPersonas])
  useEffect(() => {
    if (projectId) loadLorebooksProject(projectId)
  }, [projectId, loadLorebooksProject])
  useEffect(() => {
    loadAiStore()
  }, [loadAiStore])

  const [text, setText] = useState('')
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const [personaManagerOpen, setPersonaManagerOpen] = useState(false)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { output, streaming, error, generate, reset } = useAiGeneration()

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null
  const persona = personas.find((p) => p.id === activeChat?.personaId) ?? null
  const preset =
    presets.find((p) => p.id === activeChat?.aiPresetId) ??
    presets.find((p) => p.isDefault) ??
    presets[0]
  const provider = preset ? providers.find((p) => p.id === preset.providerId) : undefined
  const personaName = persona?.name ?? 'You'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [activeChat?.messages.length, output])

  async function handleNewChat() {
    if (!projectId || !cardId || !card) return
    await createChat(projectId, cardId, {
      title: `Chat ${chats.length + 1}`,
      firstMessage: card.firstMessage,
    })
    setMobileListOpen(false)
  }

  async function runGeneration(chatId: string, history: ChatMessage[], messageId: string) {
    if (!card || !activeChat || !preset || !provider) return
    setPendingMessageId(messageId)
    reset()
    const built = buildChatPrompt({ card, chat: activeChat, persona, lorebooks, preset, history })
    const finalText = await generate({
      provider,
      model: preset.model || provider.defaultModel || '',
      messages: built.messages,
      temperature: preset.temperature,
      topP: preset.topP,
    })
    if (finalText.trim()) {
      await editMessage(chatId, messageId, finalText)
    } else {
      await deleteMessage(chatId, messageId)
    }
    setPendingMessageId(null)
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || !activeChat) return
    setText('')
    await sendUserMessage(activeChat.id, trimmed)

    if (!preset || !provider) {
      toast({ title: 'No AI provider configured', description: 'Add one in Settings → AI to get replies.' })
      return
    }

    const freshChat = useChatStore.getState().chats.find((c) => c.id === activeChat.id)
    if (!freshChat) return
    const placeholder = await appendAssistantMessage(activeChat.id, '')
    await runGeneration(activeChat.id, freshChat.messages, placeholder.id)
  }

  if (!projectId || !cardId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={ArrowLeft}
          title="No character selected"
          description="Open a character card to start a chat."
          action={
            <Button asChild>
              <Link to="/cards">Go to Cards</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (cardStatus === 'loading' && cards.length === 0) {
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

  const chatListContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chats</span>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={handleNewChat}>
          <MessageSquarePlus className="size-3.5" /> New
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {chats.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No chats yet.</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                'group flex items-center gap-1 rounded-md px-2 py-2 text-sm',
                chat.id === activeChatId
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => {
                  setActiveChat(chat.id)
                  setMobileListOpen(false)
                }}
              >
                {chat.title}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`More actions for ${chat.title}`}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      const next = prompt('Rename chat', chat.title)
                      if (next?.trim()) renameChat(chat.id, next.trim())
                    }}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeletingChatId(chat.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setMobileListOpen(true)}
            aria-label="Open chat list"
          >
            <PanelLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" asChild>
            <Link to={`/cards/${cardId}?project=${projectId}`} aria-label="Back to card">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{card.displayName}</p>
            {activeChat && <p className="truncate text-xs text-muted-foreground">{activeChat.title}</p>}
          </div>
        </div>

        {activeChat && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Select value={activeChat.mode} onValueChange={(v: ChatMode) => setMode(activeChat.id, v)}>
              <SelectTrigger className="hidden h-8 w-32 text-xs lg:flex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roleplay">Roleplay</SelectItem>
                <SelectItem value="interview">Interview</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={activeChat.personaId ?? 'none'}
              onValueChange={(v) => setPersonaId(activeChat.id, v === 'none' ? null : v)}
            >
              <SelectTrigger className="hidden h-8 w-32 text-xs lg:flex">
                <SelectValue placeholder="You" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">You</SelectItem>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {presets.length > 0 && (
              <Select
                value={activeChat.aiPresetId ?? presets.find((p) => p.isDefault)?.id ?? presets[0]?.id ?? ''}
                onValueChange={(v) => setPresetId(activeChat.id, v)}
              >
                <SelectTrigger className="hidden h-8 w-36 text-xs lg:flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSettingsOpen(true)}
              aria-label="Chat settings"
            >
              <Settings2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Manage lorebooks">
              <Link to={`/lorebooks?project=${projectId}`}>
                <BookMarked className="size-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPersonaManagerOpen(true)}
              aria-label="Manage personas"
            >
              <UserRound className="size-4" />
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border lg:block">
          {chatListContent}
        </aside>

        <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
            <VisuallyHidden>
              <SheetHeader>
                <SheetTitle>Chats</SheetTitle>
              </SheetHeader>
            </VisuallyHidden>
            {chatListContent}
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          {!activeChat ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={MessageSquarePlus}
                title={`Start a chat with ${card.displayName}`}
                description="Chat in character, or switch to interview mode to develop them out of character."
                action={
                  <Button onClick={handleNewChat}>
                    <MessageSquarePlus /> New chat
                  </Button>
                }
                className="max-w-md border-none bg-transparent"
              />
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                {activeChat.messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Say something to start the conversation.
                  </p>
                ) : (
                  activeChat.messages.map((message, index) => {
                    // The in-flight placeholder for a streaming reply is rendered separately
                    // below (driven by the hook's live `output`), so skip it here.
                    if (message.id === pendingMessageId) return null
                    return (
                      <ChatMessageBubble
                        key={message.id}
                        message={message}
                        characterName={card.displayName}
                        personaName={personaName}
                        onEdit={(content) => editMessage(activeChat.id, message.id, content)}
                        onDelete={() => deleteMessage(activeChat.id, message.id)}
                        onRegenerate={
                          message.role === 'assistant' && preset && provider
                            ? async () => {
                                await addSwipe(activeChat.id, message.id, '')
                                await runGeneration(
                                  activeChat.id,
                                  activeChat.messages.slice(0, index),
                                  message.id,
                                )
                              }
                            : undefined
                        }
                        onSwipe={
                          message.role === 'assistant'
                            ? (direction) => setActiveSwipe(activeChat.id, message.id, message.activeSwipe + direction)
                            : undefined
                        }
                      />
                    )
                  })
                )}
                {pendingMessageId && streaming && (
                  <ChatMessageBubble
                    key={`${pendingMessageId}-streaming`}
                    message={{
                      id: pendingMessageId,
                      role: 'assistant',
                      content: '',
                      createdAt: 0,
                      swipes: [output],
                      activeSwipe: 0,
                    }}
                    characterName={card.displayName}
                    personaName={personaName}
                    streaming
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                )}
                {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              </div>

              <div className="border-t border-border p-3 sm:p-4">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={`Message ${card.displayName}…`}
                    rows={2}
                    className="min-h-0 flex-1 resize-none"
                  />
                  <Button size="icon" onClick={handleSend} disabled={!text.trim() || streaming} aria-label="Send message">
                    <Send className="size-4" />
                  </Button>
                </div>
                {!provider && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    No AI provider configured — messages are saved but won't get replies.{' '}
                    <Link to="/settings" className="underline">
                      Set one up
                    </Link>
                    .
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {activeChat && (
        <Sheet open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
          <SheetContent side="bottom" className="lg:hidden">
            <SheetHeader>
              <SheetTitle>Chat settings</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label>Mode</Label>
                <Select value={activeChat.mode} onValueChange={(v: ChatMode) => setMode(activeChat.id, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roleplay">Roleplay</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Persona</Label>
                <Select
                  value={activeChat.personaId ?? 'none'}
                  onValueChange={(v) => setPersonaId(activeChat.id, v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="You" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">You</SelectItem>
                    {personas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {presets.length > 0 && (
                <div className="grid gap-1.5">
                  <Label>AI preset</Label>
                  <Select
                    value={activeChat.aiPresetId ?? presets.find((p) => p.isDefault)?.id ?? presets[0]?.id ?? ''}
                    onValueChange={(v) => setPresetId(activeChat.id, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      <PersonaManagerDialog open={personaManagerOpen} onOpenChange={setPersonaManagerOpen} />

      <ConfirmDeleteDialog
        open={deletingChatId !== null}
        onOpenChange={(open) => !open && setDeletingChatId(null)}
        title="Delete this chat?"
        description="This permanently deletes the conversation. This can't be undone."
        onConfirm={async () => {
          if (!deletingChatId) return
          await deleteChat(deletingChatId)
          setDeletingChatId(null)
        }}
      />
    </div>
  )
}
