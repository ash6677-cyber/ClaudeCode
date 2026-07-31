import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { CastStep, type CastItem } from '@/features/book-creator/components/cast-step'
import { ConceptStep, type ConceptDraft } from '@/features/book-creator/components/concept-step'
import { OutlineStep, type OutlineItem } from '@/features/book-creator/components/outline-step'
import { ReviewStep } from '@/features/book-creator/components/review-step'
import { WizardStepper } from '@/features/book-creator/components/wizard-stepper'
import {
  buildCastPrompt,
  buildOutlinePrompt,
  parseCastResponse,
  parseOutlineResponse,
} from '@/features/book-creator/lib/prompts'
import { cardRepo, chapterRepo, codexRepo, projectRepo, sceneRepo } from '@/lib/db/repositories'
import { useAiGeneration } from '@/lib/ai/use-ai-generation'
import { useAiStore } from '@/stores/ai-store'

const STEPS = [
  { id: 'concept', label: 'Concept' },
  { id: 'outline', label: 'Outline' },
  { id: 'cast', label: 'Cast' },
  { id: 'review', label: 'Review' },
]

const DEFAULT_CONCEPT: ConceptDraft = {
  title: '',
  author: '',
  genre: '',
  synopsis: '',
  targetWordCount: 80000,
  pov: 'third-limited',
  tense: 'past',
  structureMode: 'scenes',
}

function newOutlineItem(title = '', summary = ''): OutlineItem {
  return { id: crypto.randomUUID(), title, summary }
}

function newCastItem(name = '', role = '', personality = ''): CastItem {
  return { id: crypto.randomUUID(), name, role, personality, addToCodex: true }
}

export function BookCreatorWizard() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const presets = useAiStore((s) => s.presets)
  const providers = useAiStore((s) => s.providers)
  const loadAiStore = useAiStore((s) => s.loadAll)
  useEffect(() => {
    loadAiStore()
  }, [loadAiStore])

  const preset = presets.find((p) => p.isDefault) ?? presets[0]
  const provider = preset ? providers.find((p) => p.id === preset.providerId) : undefined
  const aiAvailable = Boolean(preset && provider)

  const [activeIndex, setActiveIndex] = useState(0)
  const [furthestIndex, setFurthestIndex] = useState(0)
  const [creating, setCreating] = useState(false)

  const [concept, setConcept] = useState<ConceptDraft>(DEFAULT_CONCEPT)
  const [chapterCount, setChapterCount] = useState(12)
  const [chapters, setChapters] = useState<OutlineItem[]>([])
  const [castCount, setCastCount] = useState(4)
  const [cast, setCast] = useState<CastItem[]>([])

  const outlineGen = useAiGeneration()
  const [outlineError, setOutlineError] = useState<string | null>(null)
  const castGen = useAiGeneration()
  const [castError, setCastError] = useState<string | null>(null)

  function goToStep(index: number) {
    if (index > furthestIndex) return
    setActiveIndex(index)
  }

  function goNext() {
    const next = Math.min(activeIndex + 1, STEPS.length - 1)
    setActiveIndex(next)
    setFurthestIndex((f) => Math.max(f, next))
  }

  function goBack() {
    setActiveIndex((i) => Math.max(0, i - 1))
  }

  async function handleGenerateOutline() {
    if (!preset || !provider) return
    setOutlineError(null)
    const messages = buildOutlinePrompt({
      title: concept.title,
      genre: concept.genre,
      synopsis: concept.synopsis,
      pov: concept.pov,
      tense: concept.tense,
      chapterCount,
    })
    const finalText = await outlineGen.generate({
      provider,
      model: preset.model || provider.defaultModel || '',
      messages,
      temperature: preset.temperature,
      topP: preset.topP,
    })
    const parsed = parseOutlineResponse(finalText)
    if (!parsed) {
      setOutlineError("Could not read the AI's outline — try again, or add chapters by hand below.")
      return
    }
    setChapters(parsed.map((c) => newOutlineItem(c.title, c.summary)))
  }

  async function handleGenerateCast() {
    if (!preset || !provider) return
    setCastError(null)
    const messages = buildCastPrompt({
      title: concept.title,
      genre: concept.genre,
      synopsis: concept.synopsis,
      castCount,
    })
    const finalText = await castGen.generate({
      provider,
      model: preset.model || provider.defaultModel || '',
      messages,
      temperature: preset.temperature,
      topP: preset.topP,
    })
    const parsed = parseCastResponse(finalText)
    if (!parsed) {
      setCastError("Could not read the AI's suggestions — try again, or add characters by hand below.")
      return
    }
    setCast(parsed.map((c) => newCastItem(c.name, c.role, c.personality)))
  }

  async function handleCreate() {
    if (!concept.title.trim()) {
      setActiveIndex(0)
      return
    }
    setCreating(true)
    try {
      const project = await projectRepo.create({
        title: concept.title.trim(),
        author: concept.author.trim(),
        synopsis: concept.synopsis.trim(),
        genre: concept.genre.trim(),
        targetWordCount: concept.targetWordCount,
        coverId: null,
        seriesId: null,
        status: 'planning',
        settings: {
          defaultAiPresetId: null,
          pov: concept.pov,
          tense: concept.tense,
          measureWidthCh: 68,
          structureMode: concept.structureMode,
        },
      })

      for (const [index, chapter] of chapters.entries()) {
        const created = await chapterRepo.create({
          projectId: project.id,
          title: chapter.title.trim() || `Chapter ${index + 1}`,
          order: index,
          status: 'outline',
        })
        await sceneRepo.create({
          chapterId: created.id,
          projectId: project.id,
          title: 'Scene 1',
          order: 0,
          content: null,
          plainText: '',
          wordCount: 0,
          status: 'outline',
          povCharacterId: null,
          locationCodexId: null,
          summary: chapter.summary.trim(),
          beats: [],
          labels: [],
          linkedCodexIds: [],
        })
      }

      for (const character of cast) {
        if (!character.name.trim()) continue
        let codexEntryId: string | null = null
        if (character.addToCodex) {
          const entry = await codexRepo.create({
            projectId: project.id,
            seriesId: null,
            type: 'character',
            name: character.name.trim(),
            aliases: [],
            summary: character.role.trim(),
            body: '',
            plainText: '',
            attributes: [],
            relationships: [],
            imageId: null,
            tags: [],
            aiContext: 'when-relevant',
            aiContextTokenBudget: null,
          })
          codexEntryId = entry.id
        }
        await cardRepo.create({
          projectId: project.id,
          codexEntryId,
          displayName: character.name.trim(),
          avatarImageId: null,
          cropSettings: null,
          description: character.role.trim(),
          personality: character.personality.trim(),
          scenario: '',
          firstMessage: '',
          exampleDialogue: [],
          systemPromptOverride: null,
          voiceNotes: '',
          tags: [],
        })
      }

      toast({ title: `"${project.title}" created` })
      navigate(`/editor?project=${project.id}`)
    } catch {
      toast({ title: 'Could not create the book', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const onLastStep = activeIndex === STEPS.length - 1
  const nextDisabled = activeIndex === 0 && !concept.title.trim()

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h1 className="font-serif text-lg font-semibold">Book Creator</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            Cancel
          </Button>
        </div>
        <WizardStepper steps={STEPS} activeIndex={activeIndex} furthestIndex={furthestIndex} onSelect={goToStep} />
      </header>

      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        {activeIndex === 0 && (
          <ConceptStep draft={concept} onChange={(changes) => setConcept((c) => ({ ...c, ...changes }))} />
        )}
        {activeIndex === 1 && (
          <OutlineStep
            chapterCount={chapterCount}
            onChapterCountChange={setChapterCount}
            chapters={chapters}
            onAdd={() => setChapters((c) => [...c, newOutlineItem()])}
            onUpdate={(id, changes) =>
              setChapters((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)))
            }
            onRemove={(id) => setChapters((list) => list.filter((c) => c.id !== id))}
            onMove={(id, direction) =>
              setChapters((list) => {
                const index = list.findIndex((c) => c.id === id)
                const target = index + direction
                if (target < 0 || target >= list.length) return list
                const next = [...list]
                ;[next[index], next[target]] = [next[target], next[index]]
                return next
              })
            }
            onGenerate={handleGenerateOutline}
            generating={outlineGen.streaming}
            aiAvailable={aiAvailable}
            error={outlineError}
          />
        )}
        {activeIndex === 2 && (
          <CastStep
            castCount={castCount}
            onCastCountChange={setCastCount}
            cast={cast}
            onAdd={() => setCast((c) => [...c, newCastItem()])}
            onUpdate={(id, changes) => setCast((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)))}
            onRemove={(id) => setCast((list) => list.filter((c) => c.id !== id))}
            onGenerate={handleGenerateCast}
            generating={castGen.streaming}
            aiAvailable={aiAvailable}
            error={castError}
          />
        )}
        {activeIndex === 3 && <ReviewStep concept={concept} chapters={chapters} cast={cast} />}
      </div>

      <footer className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
        <Button variant="outline" onClick={goBack} disabled={activeIndex === 0} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        {onLastStep ? (
          <Button onClick={handleCreate} disabled={creating || !concept.title.trim()} className="gap-1.5">
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {creating ? 'Creating…' : 'Create book'}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={nextDisabled} className="gap-1.5">
            Next <ArrowRight className="size-4" />
          </Button>
        )}
      </footer>
    </div>
  )
}
