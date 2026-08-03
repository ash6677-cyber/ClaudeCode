import { RotateCcw } from 'lucide-react'
import { useState } from 'react'

import {
  contrastRatio,
  contrastVerdict,
  formatOklch,
  toHex,
  type Oklch,
} from '@/features/theme/lib/oklch'
import type { TokenSpec } from '@/features/theme/lib/tokens'
import { cn } from '@/lib/utils'

interface ColorRowProps {
  spec: TokenSpec
  color: Oklch
  /** What text on this sits against, when the token is a foreground. */
  against: Oklch | null
  overridden: boolean
  onChange: (color: Oklch) => void
  onReset: () => void
}

const VERDICT_STYLE: Record<string, string> = {
  fails: 'border-destructive/50 bg-destructive/10 text-destructive',
  'large-only': 'border-warning/50 bg-warning/10 text-warning',
  good: 'border-success/40 bg-success/10 text-success',
  excellent: 'border-success/40 bg-success/10 text-success',
}

const VERDICT_WORD: Record<string, string> = {
  fails: 'hard to read',
  'large-only': 'headings only',
  good: 'readable',
  excellent: 'crisp',
}

function Channel({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-primary"
        aria-label={label}
      />
      <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
        {value.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}
        {suffix}
      </span>
    </label>
  )
}

/**
 * One colour, with the three things it is actually made of.
 *
 * Lightness, chroma and hue rather than a hex field, because they are the
 * three questions a person asks — is it lighter, is it stronger, is it a
 * different colour — and moving one leaves the other two where they were. The
 * hex is shown, because it is what a writer will paste somewhere else.
 */
export function ColorRow({
  spec,
  color,
  against,
  overridden,
  onChange,
  onReset,
}: ColorRowProps) {
  const [open, setOpen] = useState(false)
  const ratio = against ? contrastRatio(color, against) : null
  const verdict = ratio === null ? null : contrastVerdict(ratio)

  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2.5 p-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Edit ${spec.label}`}
          className="size-8 shrink-0 rounded-md border border-border shadow-inner transition-transform hover:scale-105"
          style={{ background: formatOklch(color) }}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{spec.label}</span>
            {overridden && (
              <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Changed" />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{spec.hint}</span>
        </button>

        {verdict && (
          <span
            className={cn(
              'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
              VERDICT_STYLE[verdict],
            )}
            title={`Contrast ${ratio!.toFixed(2)}:1`}
          >
            {ratio!.toFixed(1)} · {VERDICT_WORD[verdict]}
          </span>
        )}

        <span className="hidden w-[4.5rem] shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
          {toHex(color)}
        </span>

        <button
          type="button"
          onClick={onReset}
          disabled={!overridden}
          aria-label={`Reset ${spec.label}`}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-25"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="space-y-1.5 border-t border-border px-2 py-2.5">
          <Channel
            label="Lightness"
            value={color.l}
            min={0}
            max={1}
            step={0.005}
            suffix=""
            onChange={(l) => onChange({ ...color, l })}
          />
          <Channel
            label="Chroma"
            value={color.c}
            min={0}
            max={0.37}
            step={0.002}
            suffix=""
            onChange={(c) => onChange({ ...color, c })}
          />
          <Channel
            label="Hue"
            value={color.h}
            min={0}
            max={360}
            step={1}
            suffix="°"
            onChange={(h) => onChange({ ...color, h })}
          />
        </div>
      )}
    </li>
  )
}
