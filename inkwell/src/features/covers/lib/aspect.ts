import type { CoverAspectPreset } from '@/types'

export const ASPECT_DIMENSIONS: Record<CoverAspectPreset, { w: number; h: number; label: string }> = {
  ebook: { w: 1600, h: 2560, label: 'Ebook (5:8)' },
  print: { w: 1800, h: 2700, label: 'Print (2:3)' },
  square: { w: 2000, h: 2000, label: 'Square (1:1)' },
}
