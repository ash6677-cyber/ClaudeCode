import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface WizardStep {
  id: string
  label: string
}

interface WizardStepperProps {
  steps: WizardStep[]
  activeIndex: number
  furthestIndex: number
  onSelect: (index: number) => void
}

export function WizardStepper({ steps, activeIndex, furthestIndex, onSelect }: WizardStepperProps) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto px-1 py-1 sm:gap-2">
      {steps.map((step, index) => {
        const reachable = index <= furthestIndex
        const active = index === activeIndex
        const done = index < furthestIndex
        return (
          <li key={step.id} className="flex shrink-0 items-center gap-1 sm:gap-2">
            {index > 0 && <span className="h-px w-4 shrink-0 bg-border sm:w-8" aria-hidden />}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(index)}
              // Below `sm` the label is hidden and only the number is drawn,
              // which left the phone's back-to-an-earlier-step control
              // announcing itself as "4". The name should not depend on how
              // wide the screen happens to be.
              aria-label={step.label}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-medium transition-colors disabled:cursor-not-allowed max-sm:pr-1.5 sm:min-h-0 sm:min-w-0 sm:justify-start',
                active
                  ? 'bg-accent text-accent-foreground'
                  : reachable
                    ? 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    : 'text-muted-foreground/40',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
                  done
                    ? 'brand-gradient-surface text-primary-foreground'
                    : active
                      ? 'border-2 border-primary text-primary'
                      : 'border border-border',
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
