import { Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import {
  CardDetail,
  CardsHome,
  CodexEntryDetail,
  CodexHome,
  CoversHome,
  EditorHome,
  PlanningHome,
  ProjectsHome,
  SettingsHome,
  StatsHome,
} from '@/app/lazy-routes'
import { AppShell } from '@/app/layout/app-shell'
import { RouteLoading } from '@/components/common/route-loading'

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: 'projects', element: withSuspense(<ProjectsHome />) },
      { path: 'editor', element: withSuspense(<EditorHome />) },
      { path: 'codex', element: withSuspense(<CodexHome />) },
      { path: 'codex/:entryId', element: withSuspense(<CodexEntryDetail />) },
      { path: 'cards', element: withSuspense(<CardsHome />) },
      { path: 'cards/:cardId', element: withSuspense(<CardDetail />) },
      { path: 'planning', element: withSuspense(<PlanningHome />) },
      { path: 'covers', element: withSuspense(<CoversHome />) },
      { path: 'stats', element: withSuspense(<StatsHome />) },
      { path: 'settings', element: withSuspense(<SettingsHome />) },
      { path: '*', element: <Navigate to="/projects" replace /> },
    ],
  },
])
