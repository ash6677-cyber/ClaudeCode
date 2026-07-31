import { useEffect, useState } from 'react'

/** Creates an object URL for a Blob and revokes it on cleanup or when the blob changes. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  // Clear immediately during render when the blob identity changes, so a stale
  // URL is never shown while the effect below creates the new one.
  const [renderedBlob, setRenderedBlob] = useState(blob)
  if (blob !== renderedBlob) {
    setRenderedBlob(blob)
    setUrl(null)
  }

  useEffect(() => {
    if (!blob) return
    // Allocating a browser resource (object URL) is a genuine external-system
    // side effect — it can't happen during render without leaking on every
    // re-render, so this isn't the "mirroring props into state" anti-pattern.
    const objectUrl = URL.createObjectURL(blob)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return url
}
