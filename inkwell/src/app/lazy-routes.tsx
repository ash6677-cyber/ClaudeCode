import { lazy } from 'react'

export const ProjectsHome = lazy(() =>
  import('@/features/projects/routes/projects-home').then((m) => ({ default: m.ProjectsHome })),
)
export const EditorHome = lazy(() =>
  import('@/features/editor/routes/editor-home').then((m) => ({ default: m.EditorHome })),
)
export const CodexHome = lazy(() =>
  import('@/features/codex/routes/codex-home').then((m) => ({ default: m.CodexHome })),
)
export const CodexEntryDetail = lazy(() =>
  import('@/features/codex/routes/codex-entry-detail').then((m) => ({
    default: m.CodexEntryDetail,
  })),
)
export const CardsHome = lazy(() =>
  import('@/features/cards/routes/cards-home').then((m) => ({ default: m.CardsHome })),
)
export const CardDetail = lazy(() =>
  import('@/features/cards/routes/card-detail').then((m) => ({ default: m.CardDetail })),
)
export const CardChat = lazy(() =>
  import('@/features/cards/routes/card-chat').then((m) => ({ default: m.CardChat })),
)
export const LorebooksHome = lazy(() =>
  import('@/features/cards/routes/lorebooks-home').then((m) => ({ default: m.LorebooksHome })),
)
export const PlanningHome = lazy(() =>
  import('@/features/planning/routes/planning-home').then((m) => ({ default: m.PlanningHome })),
)
export const CoversHome = lazy(() =>
  import('@/features/covers/routes/covers-home').then((m) => ({ default: m.CoversHome })),
)
export const StatsHome = lazy(() =>
  import('@/features/stats/routes/stats-home').then((m) => ({ default: m.StatsHome })),
)
export const SettingsHome = lazy(() =>
  import('@/features/settings/routes/settings-home').then((m) => ({ default: m.SettingsHome })),
)
