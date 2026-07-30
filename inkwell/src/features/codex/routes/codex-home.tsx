import { BookOpen } from 'lucide-react'

import { PlaceholderPage } from '@/components/common/placeholder-page'

export function CodexHome() {
  return (
    <PlaceholderPage
      icon={BookOpen}
      title="Codex"
      description="Your worldbuilding wiki — characters, locations, factions, and lore, linked straight into your manuscript."
      phase="Phase 3"
    />
  )
}
