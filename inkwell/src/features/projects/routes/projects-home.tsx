import { Library } from 'lucide-react'

import { PlaceholderPage } from '@/components/common/placeholder-page'

export function ProjectsHome() {
  return (
    <PlaceholderPage
      icon={Library}
      title="Projects"
      description="Create, open, and manage your novels from here — your dashboard, goals, and recent work will all live on this page."
      phase="Phase 1"
    />
  )
}
