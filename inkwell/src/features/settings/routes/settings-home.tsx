import { Settings } from 'lucide-react'

import { PlaceholderPage } from '@/components/common/placeholder-page'

export function SettingsHome() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Settings"
      description="AI provider keys, presets, shortcuts, and data management will live here as each phase adds its settings."
      phase="later phases"
    />
  )
}
