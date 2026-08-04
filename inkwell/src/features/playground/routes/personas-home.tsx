import { useEffect } from 'react'

import { PersonaList } from '@/features/playground/components/persona-list'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { usePersonaStore } from '@/stores/persona-store'

/**
 * Personas are global, not per book — the same you, whichever story you are
 * in — so this screen deliberately takes no `?project=`.
 */
export function PersonasHome() {
  useDocumentTitle('Personas', 'Playground')
  const loadAll = usePersonaStore((s) => s.loadAll)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Who you are when you talk to a character. Pick one per conversation, or chat as
          yourself. Personas are shared across every book.
        </p>
        <PersonaList idPrefix="persona-page" />
      </div>
    </div>
  )
}
