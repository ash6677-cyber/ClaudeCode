import type { BaseEntity } from './base'

export type CoverAspectPreset = 'ebook' | 'print' | 'square'

export interface CoverTypographyLayer {
  id: string
  kind: 'title' | 'author' | 'custom'
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  letterSpacing: number
  align: 'left' | 'center' | 'right'
  x: number
  y: number
  shadow: boolean
  /** A contrasting outline for legibility over busy art. Off when absent. */
  stroke?: boolean
}

export interface Cover extends BaseEntity {
  projectId: string
  /** What the writer calls this design. Rows made before variants have none. */
  name?: string
  /**
   * Whether this is the design the rest of the app shows. At most one per
   * project; rows made before variants existed have no flag, and the newest
   * of them stands in as the active one.
   */
  active?: boolean
  sourceImageId: string | null
  aspectPreset: CoverAspectPreset
  crop: { x: number; y: number; zoom: number; rotation: number }
  overlay: {
    enabled: boolean
    color: string
    opacity: number
    direction: 'top' | 'bottom' | 'full'
  }
  typography: CoverTypographyLayer[]
  exportedImageId: string | null
}
