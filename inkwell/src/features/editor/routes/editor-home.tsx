import { Feather } from 'lucide-react'

import { PlaceholderPage } from '@/components/common/placeholder-page'

export function EditorHome() {
  return (
    <PlaceholderPage
      icon={Feather}
      title="Editor"
      description="A distraction-free manuscript editor with chapter and scene navigation, autosave, and focus mode."
      phase="Phase 2"
    />
  )
}
