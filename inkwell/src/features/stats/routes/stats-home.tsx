import { BarChart3 } from 'lucide-react'

import { PlaceholderPage } from '@/components/common/placeholder-page'

export function StatsHome() {
  return (
    <PlaceholderPage
      icon={BarChart3}
      title="Stats"
      description="Word-count goals, streaks, and session history across every project."
      phase="Phase 12"
    />
  )
}
