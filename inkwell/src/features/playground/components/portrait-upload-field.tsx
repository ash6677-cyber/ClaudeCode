import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Loader2, X, ZoomIn } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { imageAssetRepo } from '@/lib/db/repositories'
import { useObjectUrl } from '@/lib/hooks/use-object-url'
import { storeImageFile } from '@/lib/image-upload'
import { cn } from '@/lib/utils'
import type { CropSettings } from '@/types'

interface PortraitUploadFieldProps {
  imageId: string | null
  cropSettings: CropSettings | null
  onImageChange: (imageId: string | null) => void
  onCropChange: (crop: CropSettings) => void
  className?: string
}

const DEFAULT_CROP: CropSettings = { x: 50, y: 50, zoom: 1 }

export function PortraitUploadField({
  imageId,
  cropSettings,
  onImageChange,
  onCropChange,
  className,
}: PortraitUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const image = useLiveQuery(
    () => (imageId ? imageAssetRepo.get(imageId) : Promise.resolve(undefined)),
    [imageId],
  )
  const imageUrl = useObjectUrl(image?.blob)
  const crop = cropSettings ?? DEFAULT_CROP

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const asset = await storeImageFile(file)
      onImageChange(asset.id)
      onCropChange(DEFAULT_CROP)
    } catch {
      toast({ title: 'Could not read that image', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="group relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-md">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=""
              className="size-full object-cover transition-transform duration-200"
              style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3 opacity-0 transition-opacity group-hover:opacity-100">
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onImageChange(null)}
                aria-label="Remove portrait"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            {uploading ? (
              <Loader2 className="size-8 animate-spin" />
            ) : (
              <ImagePlus className="size-8" strokeWidth={1.5} />
            )}
            <span className="text-sm">{uploading ? 'Uploading…' : 'Add a portrait'}</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>

      {imageUrl && (
        <div className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ZoomIn className="size-3.5" /> Frame the portrait
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Zoom
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={crop.zoom}
              onChange={(e) => onCropChange({ ...crop, zoom: Number(e.target.value) })}
              className="accent-primary"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Horizontal
            <input
              type="range"
              min={0}
              max={100}
              value={crop.x}
              onChange={(e) => onCropChange({ ...crop, x: Number(e.target.value) })}
              className="accent-primary"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Vertical
            <input
              type="range"
              min={0}
              max={100}
              value={crop.y}
              onChange={(e) => onCropChange({ ...crop, y: Number(e.target.value) })}
              className="accent-primary"
            />
          </label>
        </div>
      )}
    </div>
  )
}
