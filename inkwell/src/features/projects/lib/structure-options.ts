import { BookOpen, Rows3 } from 'lucide-react'

import type { StructureMode } from '@/types'

export const STRUCTURE_OPTIONS: {
  value: StructureMode
  label: string
  description: string
  icon: typeof Rows3
}[] = [
  {
    value: 'scenes',
    label: 'Chapters & scenes',
    description: 'Each chapter holds multiple scenes you can reorder independently.',
    icon: Rows3,
  },
  {
    value: 'chapters-only',
    label: 'Chapters only',
    description: 'Each chapter is one writable unit — no scene subdivision.',
    icon: BookOpen,
  },
]
