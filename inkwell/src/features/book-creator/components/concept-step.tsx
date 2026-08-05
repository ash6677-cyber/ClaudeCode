import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { STRUCTURE_OPTIONS } from '@/features/projects/lib/structure-options'
import { TemplatePicker } from '@/features/templates/components/template-picker'
import { cn } from '@/lib/utils'
import type { PointOfView, StructureMode, Tense } from '@/types'

export interface ConceptDraft {
  title: string
  author: string
  genre: string
  synopsis: string
  targetWordCount: number
  pov: PointOfView
  tense: Tense
  structureMode: StructureMode
  /** The format the manuscript starts in; null until the writer picks one. */
  templateId: string | null
}

interface ConceptStepProps {
  draft: ConceptDraft
  onChange: (changes: Partial<ConceptDraft>) => void
}

export function ConceptStep({ draft, onChange }: ConceptStepProps) {
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <div>
        <h2 className="font-serif text-xl font-semibold">Let's start with the idea</h2>
        <p className="text-sm text-muted-foreground">
          A working title and a rough premise are enough — you can refine everything later.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="wizard-title">Title</Label>
        <Input
          id="wizard-title"
          autoFocus
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="The name of your novel"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="wizard-author">Author</Label>
          <Input
            id="wizard-author"
            value={draft.author}
            onChange={(e) => onChange({ author: e.target.value })}
            placeholder="Your name or pen name"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wizard-genre">Genre</Label>
          <Input
            id="wizard-genre"
            value={draft.genre}
            onChange={(e) => onChange({ genre: e.target.value })}
            placeholder="Fantasy, thriller, ..."
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="wizard-synopsis">Premise</Label>
        <Textarea
          id="wizard-synopsis"
          rows={4}
          value={draft.synopsis}
          onChange={(e) => onChange({ synopsis: e.target.value })}
          placeholder="What's this book about? A paragraph is plenty — the more you give, the better the AI can help with an outline and cast later."
        />
      </div>

      <TemplatePicker
        value={draft.templateId}
        onChange={(templateId) => onChange({ templateId })}
        structureMode={draft.structureMode}
        onStructureMode={(structureMode) => onChange({ structureMode })}
      />

      <div className="grid gap-1.5">
        <Label>Manuscript structure</Label>
        <div className="grid grid-cols-2 gap-3">
          {STRUCTURE_OPTIONS.map((option) => {
            const Icon = option.icon
            const selected = draft.structureMode === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ structureMode: option.value })}
                aria-pressed={selected}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-accent',
                )}
              >
                <Icon className={cn('size-4', selected ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="wizard-target">Target words</Label>
          <Input
            id="wizard-target"
            type="number"
            min={0}
            step={1000}
            value={draft.targetWordCount}
            onChange={(e) => onChange({ targetWordCount: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Point of view</Label>
          <Select value={draft.pov} onValueChange={(v: PointOfView) => onChange({ pov: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">First person</SelectItem>
              <SelectItem value="second">Second person</SelectItem>
              <SelectItem value="third-limited">Third limited</SelectItem>
              <SelectItem value="third-omniscient">Third omniscient</SelectItem>
              <SelectItem value="multiple">Multiple</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Tense</Label>
          <Select value={draft.tense} onValueChange={(v: Tense) => onChange({ tense: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="present">Present</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
