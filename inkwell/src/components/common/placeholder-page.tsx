import type { LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/common/empty-state'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
  phase: string
}

/** Used for feature areas whose build phase hasn't landed yet. Never a crash, always a clear "coming soon." */
export function PlaceholderPage({ icon, title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
        <h1 className="font-serif text-lg font-semibold">{title}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={icon}
          title={`${title} is coming soon`}
          description={`${description} Arrives in ${phase}.`}
        />
      </div>
    </div>
  )
}
