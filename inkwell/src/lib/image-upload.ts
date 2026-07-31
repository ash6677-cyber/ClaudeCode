import { imageAssetRepo } from '@/lib/db/repositories'
import type { ImageAsset } from '@/types'

function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image dimensions'))
    }
    img.src = url
  })
}

/** Stores an uploaded image file as a local ImageAsset (blob lives in IndexedDB). */
export async function storeImageFile(file: File): Promise<ImageAsset> {
  const { width, height } = await readImageDimensions(file)
  return imageAssetRepo.create({
    blob: file,
    mimeType: file.type,
    width,
    height,
    fileName: file.name,
  })
}
