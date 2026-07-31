import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center animate-fade-in',
        className,
      )}
    >
      <div className="relative flex size-14 items-center justify-center rounded-full bg-accent shadow-sm">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-40 blur-md brand-gradient-surface"
        />
        <Icon className="relative size-6 text-accent-foreground" strokeWidth={1.75} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
