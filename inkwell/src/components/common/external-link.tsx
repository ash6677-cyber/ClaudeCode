import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'

import { isTauriRuntime } from '@/lib/db/tauri-bridge'

/**
 * An <a> that reaches the outside world from either build.
 *
 * In the browser it is exactly the anchor it looks like. Inside the desktop
 * shell, the webview swallows target="_blank" whole — the link looks
 * clickable and does nothing — so there the click is handed to the opener
 * plugin, which puts the page in the system browser where it belongs. The
 * href stays on the element either way: right-click copy, hover preview,
 * and screen readers all keep telling the truth.
 */
export function ExternalLink({
  href,
  children,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || !isTauriRuntime()) return
    event.preventDefault()
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(href)
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
