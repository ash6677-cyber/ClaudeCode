import { useLiveQuery } from 'dexie-react-hooks'
import { Download, ImagePlus, Library, Loader2, Plus, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { CoverPreview } from '@/features/covers/components/cover-preview'
import { TypographyLayerRow } from '@/features/covers/components/typography-layer-row'
import { ASPECT_DIMENSIONS } from '@/features/covers/lib/aspect'
import { exportCoverPng } from '@/features/covers/lib/render-cover'
import { imageAssetRepo } from '@/lib/db/repositories'
import { DEFAULT_EDITOR_FONT_ID } from '@/lib/editor/fonts'
import { useObjectUrl } from '@/lib/hooks/use-object-url'
import { storeImageFile } from '@/lib/image-upload'
import { useCoverStore } from '@/stores/cover-store'
import { useProjectStore } from '@/stores/project-store'
import type { CoverAspectPreset, CoverTypographyLayer } from '@/types'

function newLayer(kind: CoverTypographyLayer['kind'], text: string): Omit<CoverTypographyLayer, 'id'> {
  const isTitle = kind === 'title'
  return {
    kind,
    text,
    fontFamily: DEFAULT_EDITOR_FONT_ID,
    fontSize: isTitle ? 9 : 4.5,
    fontWeight: isTitle ? 700 : 500,
    color: '#ffffff',
    letterSpacing: isTitle ? 2 : 8,
    align: 'center',
    x: 50,
    y: isTitle ? 42 : 88,
    shadow: true,
  }
}

export function CoversHome() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const { toast } = useToast()

  const projects = useProjectStore((s) => s.projects)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)
  const project = projects.find((p) => p.id === projectId)

  const {
    cover,
    status,
    loadProject,
    setSourceImage,
    setAspectPreset,
    updateCrop,
    updateOverlay,
    addTypographyLayer,
    updateTypographyLayer,
    removeTypographyLayer,
    setExportedImage,
  } = useCoverStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])
  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sourceImage = useLiveQuery(
    () => (cover?.sourceImageId ? imageAssetRepo.get(cover.sourceImageId) : Promise.resolve(undefined)),
    [cover?.sourceImageId],
  )
  const imageUrl = useObjectUrl(sourceImage?.blob)

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
      await setSourceImage(asset.id)
    } catch {
      toast({ title: 'Could not read that image', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  async function handleExport() {
    if (!cover || !project) return
    setExporting(true)
    try {
      const blob = await exportCoverPng(cover, imageUrl)
      const asset = await imageAssetRepo.create({
        blob,
        mimeType: 'image/png',
        width: ASPECT_DIMENSIONS[cover.aspectPreset].w,
        height: ASPECT_DIMENSIONS[cover.aspectPreset].h,
        fileName: `${project.title || 'cover'}.png`,
      })
      await setExportedImage(asset.id)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.title || 'cover'}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Cover exported', description: 'Saved to your device and set as the project cover.' })
    } catch {
      toast({ title: 'Could not export the cover', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Library}
          title="No project selected"
          description="Open a project from the Projects page to design its cover."
          action={
            <Button asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'loading' || !cover || !project) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Cover Studio" />
        <div className="flex-1 p-6">
          <Skeleton className="mx-auto h-[32rem] max-w-md" />
        </div>
      </div>
    )
  }

  const selectedLayer = cover.typography.find((l) => l.id === selectedLayerId) ?? null

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Cover Studio"
        description={project.title}
        actions={
          <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export PNG
          </Button>
        }
      />

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex flex-1 items-start justify-center p-5 sm:p-8 lg:overflow-y-auto">
          <CoverPreview
            cover={cover}
            imageUrl={imageUrl}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onCommitLayerPosition={(id, x, y) => updateTypographyLayer(id, { x, y })}
            className="w-full max-w-sm"
          />
        </div>

        <aside className="w-full shrink-0 space-y-5 overflow-y-auto border-t border-border p-4 sm:p-5 lg:w-80 lg:border-l lg:border-t-0">
          <section className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Source image
            </Label>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
              {imageUrl ? 'Replace image' : 'Upload image'}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </section>

          <section className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aspect</Label>
            <Select value={cover.aspectPreset} onValueChange={(v: CoverAspectPreset) => setAspectPreset(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASPECT_DIMENSIONS).map(([key, dims]) => (
                  <SelectItem key={key} value={key}>
                    {dims.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {imageUrl && (
            <section className="space-y-3">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Frame image
              </Label>
              <div className="grid gap-1.5">
                <Label className="text-xs">Zoom</Label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={cover.crop.zoom}
                  onChange={(e) => updateCrop({ zoom: Number(e.target.value) })}
                  className="accent-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Horizontal</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={cover.crop.x}
                  onChange={(e) => updateCrop({ x: Number(e.target.value) })}
                  className="accent-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Vertical</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={cover.crop.y}
                  onChange={(e) => updateCrop({ y: Number(e.target.value) })}
                  className="accent-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1 text-xs">
                  <RotateCw className="size-3" /> Rotation
                </Label>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  value={cover.crop.rotation}
                  onChange={(e) => updateCrop({ rotation: Number(e.target.value) })}
                  className="accent-primary"
                />
              </div>
            </section>
          )}

          <section className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Overlay
              </Label>
              <Switch
                checked={cover.overlay.enabled}
                onCheckedChange={(v) => updateOverlay({ enabled: v })}
              />
            </div>
            {cover.overlay.enabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Color</Label>
                    <input
                      type="color"
                      value={cover.overlay.color}
                      onChange={(e) => updateOverlay({ color: e.target.value })}
                      className="h-9 w-full cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Direction</Label>
                    <Select
                      value={cover.overlay.direction}
                      onValueChange={(v: 'top' | 'bottom' | 'full') => updateOverlay({ direction: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">Bottom fade</SelectItem>
                        <SelectItem value="top">Top fade</SelectItem>
                        <SelectItem value="full">Full tint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Opacity — {Math.round(cover.overlay.opacity * 100)}%</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cover.overlay.opacity}
                    onChange={(e) => updateOverlay({ opacity: Number(e.target.value) })}
                    className="accent-primary"
                  />
                </div>
              </>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Text layers
              </Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={() => addTypographyLayer(newLayer('title', project.title))}
                >
                  <Plus className="size-3" /> Title
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={() => addTypographyLayer(newLayer('author', project.author))}
                >
                  <Plus className="size-3" /> Author
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={() => addTypographyLayer(newLayer('custom', ''))}
                >
                  <Plus className="size-3" /> Text
                </Button>
              </div>
            </div>

            {cover.typography.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Add a title, author, or custom text layer.
              </p>
            ) : (
              <div className="space-y-2">
                {cover.typography.map((layer) => (
                  <TypographyLayerRow
                    key={layer.id}
                    layer={layer}
                    expanded={selectedLayer?.id === layer.id}
                    onSelect={() => setSelectedLayerId((id) => (id === layer.id ? null : layer.id))}
                    onChange={(changes) => updateTypographyLayer(layer.id, changes)}
                    onDelete={() => {
                      removeTypographyLayer(layer.id)
                      if (selectedLayerId === layer.id) setSelectedLayerId(null)
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
