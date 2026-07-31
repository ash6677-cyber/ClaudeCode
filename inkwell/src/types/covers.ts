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
}

export interface Cover extends BaseEntity {
  projectId: string
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
