import type { ReactNode } from 'react'

/** Keeps content in the accessibility tree (for screen readers) while hiding it visually. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
      {children}
    </span>
  )
}
