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
  ReaderHome,
  ProjectsHome,
  SettingsHome,
  StatsHome,
} from '@/app/lazy-routes'
import { AppShell } from '@/app/layout/app-shell'
import { RouteError } from '@/components/common/route-error'
import { RouteLoading } from '@/components/common/route-loading'

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

/**
 * Every screen gets its own error boundary so a failure stays inside the
 * content area and the nav survives — a writer who hits a broken screen can
 * still click their way back to the manuscript. A route without one would
 * bubble to the root and take the whole shell down with it.
 */
function screen(path: string, element: React.ReactNode) {
  return { path, element: withSuspense(element), errorElement: <RouteError /> }
}

// Hash-based routing (`#/projects` instead of `/projects`) so the app works
// identically whether it's served by a dev server with SPA fallback or
// loaded as static files from a packaged desktop shell, which has no server
// to rewrite arbitrary paths back to index.html.
export const router = createHashRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      screen('projects', <ProjectsHome />),
      screen('book-creator', <BookCreatorWizard />),
      screen('editor', <EditorHome />),
      screen('codex', <CodexHome />),
      screen('codex/:entryId', <CodexEntryDetail />),
      screen('cards', <CardsHome />),
      screen('cards/:cardId', <CardDetail />),
      screen('cards/:cardId/chat', <CardChat />),
      screen('lorebooks', <LorebooksHome />),
      screen('planning', <PlanningHome />),
      screen('read', <ReaderHome />),
      screen('covers', <CoversHome />),
      screen('stats', <StatsHome />),
      screen('settings', <SettingsHome />),
      { path: '*', element: <Navigate to="/projects" replace /> },
    ],
  },
])
