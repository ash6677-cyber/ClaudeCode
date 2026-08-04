import { Navigate, useLocation, useParams } from 'react-router-dom'

import { PLAYGROUND_ROOT } from '@/features/playground/lib/playground-nav'

/**
 * Carries an old `/cards` or `/lorebooks` link into the Playground.
 *
 * Those screens were four separate destinations before they became one, and
 * a writer who bookmarked a character — or pasted the link into their own
 * notes — should not find it broken because the container got a name.
 *
 * `search` is passed through rather than rebuilt, so `?project=` survives
 * along with anything else that was on the URL.
 */
export function LegacyPlaygroundRedirect({ to, param }: { to: string; param?: string }) {
  const params = useParams()
  const { search } = useLocation()
  const id = param ? params[param] : undefined
  return <Navigate to={`${PLAYGROUND_ROOT}/${to}${id ? `/${id}` : ''}${search}`} replace />
}
