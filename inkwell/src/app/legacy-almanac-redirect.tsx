import { Navigate, useLocation, useParams } from 'react-router-dom'

/**
 * Carries an old /codex/:id link, and its ?project=, to the new path.
 *
 * The Almanac used to be called the Codex. Anyone who bookmarked an entry, or
 * pasted a link into their own notes, should not find it broken because the
 * feature got a different name.
 */
export function LegacyAlmanacRedirect() {
  const { entryId } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/almanac/${entryId ?? ''}${search}`} replace />
}
