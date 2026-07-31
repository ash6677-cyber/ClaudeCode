import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppShell } from '@/app/layout/app-shell'
import { CardsHome } from '@/features/cards/routes/cards-home'
import { CodexEntryDetail } from '@/features/codex/routes/codex-entry-detail'
import { CodexHome } from '@/features/codex/routes/codex-home'
import { CoversHome } from '@/features/covers/routes/covers-home'
import { EditorHome } from '@/features/editor/routes/editor-home'
import { PlanningHome } from '@/features/planning/routes/planning-home'
import { ProjectsHome } from '@/features/projects/routes/projects-home'
import { SettingsHome } from '@/features/settings/routes/settings-home'
import { StatsHome } from '@/features/stats/routes/stats-home'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: 'projects', element: <ProjectsHome /> },
      { path: 'editor', element: <EditorHome /> },
      { path: 'codex', element: <CodexHome /> },
      { path: 'codex/:entryId', element: <CodexEntryDetail /> },
      { path: 'cards', element: <CardsHome /> },
      { path: 'planning', element: <PlanningHome /> },
      { path: 'covers', element: <CoversHome /> },
      { path: 'stats', element: <StatsHome /> },
      { path: 'settings', element: <SettingsHome /> },
      { path: '*', element: <Navigate to="/projects" replace /> },
    ],
  },
])
