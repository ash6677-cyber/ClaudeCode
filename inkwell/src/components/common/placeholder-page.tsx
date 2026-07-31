import type { LucideIcon } from 'lucide-react'

import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
  phase: string
}

/** Used for feature areas whose build phase hasn't landed yet. Never a crash, always a clear "coming soon." */
export function PlaceholderPage({ icon: Icon, title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center animate-fade-in">
          <div className="relative flex size-16 items-center justify-center rounded-2xl bg-accent shadow-sm">
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl opacity-40 blur-lg brand-gradient-surface"
            />
            <Icon className="relative size-7 text-accent-foreground" strokeWidth={1.6} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground">{title} is coming soon</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            Arrives in {phase}
          </Badge>
        </div>
      </div>
    </div>
  )
}
