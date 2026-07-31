import { Suspense } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'

import {
  BookCreatorWizard,
  CardChat,
  CardDetail,
  CardsHome,
  CodexEntryDetail,
  CodexHome,
  CoversHome,
  EditorHome,
  LorebooksHome,
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

// Hash-based routing (`#/projects` instead of `/projects`) so the app works
// identically whether it's served by a dev server with SPA fallback or
// loaded as static files from a packaged desktop shell, which has no server
// to rewrite arbitrary paths back to index.html.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: 'projects', element: withSuspense(<ProjectsHome />) },
      { path: 'book-creator', element: withSuspense(<BookCreatorWizard />) },
      { path: 'editor', element: withSuspense(<EditorHome />) },
      { path: 'codex', element: withSuspense(<CodexHome />) },
      { path: 'codex/:entryId', element: withSuspense(<CodexEntryDetail />) },
      { path: 'cards', element: withSuspense(<CardsHome />) },
      { path: 'cards/:cardId', element: withSuspense(<CardDetail />) },
      { path: 'cards/:cardId/chat', element: withSuspense(<CardChat />) },
      { path: 'lorebooks', element: withSuspense(<LorebooksHome />) },
      { path: 'planning', element: withSuspense(<PlanningHome />) },
      { path: 'covers', element: withSuspense(<CoversHome />) },
      { path: 'stats', element: withSuspense(<StatsHome />) },
      { path: 'settings', element: withSuspense(<SettingsHome />) },
      { path: '*', element: <Navigate to="/projects" replace /> },
    ],
  },
])
