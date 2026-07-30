import type { BaseEntity } from './base'

export interface ImageAsset extends BaseEntity {
  blob: Blob
  mimeType: string
  width: number
  height: number
  fileName: string
}
