import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProviderInput } from '@/stores/ai-store'
import type { AiProviderConfig, AiProviderKind } from '@/types'

const KIND_OPTIONS: { value: AiProviderKind; label: string; needsBaseUrl?: boolean; placeholder: string }[] = [
  { value: 'openai', label: 'OpenAI', placeholder: 'gpt-4o' },
  { value: 'anthropic', label: 'Anthropic', placeholder: 'claude-sonnet-4-5' },
  { value: 'openrouter', label: 'OpenRouter', placeholder: 'openrouter/auto' },
  { value: 'openai-compatible', label: 'OpenAI-compatible (custom / local)', needsBaseUrl: true, placeholder: 'llama3' },
]

interface ProviderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: AiProviderConfig
  onSubmit: (input: ProviderInput) => Promise<void>
}

function formFromProvider(provider?: AiProviderConfig): ProviderInput {
  return {
    kind: provider?.kind ?? 'openai',
    label: provider?.label ?? '',
    apiKey: provider?.apiKey ?? '',
    baseUrl: provider?.baseUrl ?? null,
    defaultModel: provider?.defaultModel ?? null,
  }
}

export function ProviderFormDialog({ open, onOpenChange, provider, onSubmit }: ProviderFormDialogProps) {
  const titleId = useId()
  const [form, setForm] = useState<ProviderInput>(() => formFromProvider(provider))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kindMeta = KIND_OPTIONS.find((k) => k.value === form.kind)!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.apiKey.trim()) {
      setError('An API key is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        ...form,
        label: form.label.trim() || kindMeta.label,
        baseUrl: form.baseUrl?.trim() || null,
        defaultModel: form.defaultModel?.trim() || null,
      })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{provider ? 'Edit provider' : 'Add AI provider'}</DialogTitle>
            <DialogDescription>
              Your key stays on this device and is sent only to the provider you choose here.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <Label>Provider</Label>
              <Select
                value={form.kind}
                onValueChange={(v: AiProviderKind) => setForm({ ...form, kind: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`${titleId}-label`}>Label</Label>
              <Input
                id={`${titleId}-label`}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={kindMeta.label}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`${titleId}-key`}>API key</Label>
              <Input
                id={`${titleId}-key`}
                type="password"
                autoComplete="off"
                value={form.apiKey}
                onChange={(e) => {
                  setForm({ ...form, apiKey: e.target.value })
                  if (error) setError(null)
                }}
                placeholder="sk-…"
                aria-invalid={error ? true : undefined}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            {(kindMeta.needsBaseUrl || form.kind === 'openai' || form.kind === 'openrouter') && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${titleId}-base-url`}>
                  Base URL {!kindMeta.needsBaseUrl && <span className="text-muted-foreground">(optional)</span>}
                </Label>
                <Input
                  id={`${titleId}-base-url`}
                  value={form.baseUrl ?? ''}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder={kindMeta.needsBaseUrl ? 'http://localhost:11434/v1' : 'Provider default'}
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor={`${titleId}-model`}>Default model</Label>
              <Input
                id={`${titleId}-model`}
                value={form.defaultModel ?? ''}
                onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
                placeholder={kindMeta.placeholder}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : provider ? 'Save changes' : 'Add provider'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
