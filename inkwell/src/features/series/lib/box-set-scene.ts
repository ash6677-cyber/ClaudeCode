/**
 * The box set, as an actual scene.
 *
 * Built with three.js rather than CSS 3D on purpose. CSS composites whole
 * elements and sorts them as units, which is fine for a single turning page
 * but falls apart here: a dozen boxes packed inside another box, viewed from
 * every angle, need a real depth buffer or the faces punch through each other
 * as you orbit past them. Per-pixel depth, image-based lighting and a shadow
 * map are also what separate "a photograph of a box set" from "some shaded
 * rectangles", and none of the three exist in CSS.
 *
 * Everything is modelled at 1 unit = 1 centimetre, using the real dimensions
 * from `box-set-layout`, so the proportions are checkable rather than tuned.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Material,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import type { BoxSetFinish, SeriesBoxSet } from '@/types'

import {
  BOOK_HEIGHT_CM,
  BOOK_WIDTH_CM,
  CASE_WALL_CM,
  framingDistance,
  layoutBoxSet,
  type BoxSetLayout,
} from './box-set-layout'
import {
  paintBackCover,
  paintBoardEdge,
  paintCasePanel,
  paintCoverFromImage,
  paintFallbackCover,
  paintPageEdges,
  paintSpine,
} from './book-textures'
import { cameraPosition, type OrbitState } from './orbit-camera'
import { clothColorsFor, dominantColor, shade } from './palette'

export const CAMERA_FOV = 34

export interface BoxSetBook {
  projectId: string
  title: string
  author: string
  wordCount: number
  /** 1-based position in the series. */
  volume: number
  /** Cover art already decoded, or null to print a typographic jacket. */
  cover: { source: CanvasImageSource; width: number; height: number } | null
}

export interface BoxSetSceneInput {
  canvas: HTMLCanvasElement
  books: BoxSetBook[]
  seriesName: string
  author: string
  boxSet: SeriesBoxSet
}

/**
 * Surface response of the laminate, by finish.
 *
 * The base stays rough at every setting and only the clearcoat changes,
 * because that is how a printed case is actually made: ink on board is matte,
 * and the gloss belongs to the film laid over it. Dropping the base roughness
 * to make something look glossy instead turns the board itself into a mirror
 * — a whole panel reflecting the environment as flat white, with the artwork
 * printed on it nowhere to be seen.
 */
const FINISH: Record<
  BoxSetFinish,
  { roughness: number; clearcoat: number; clearcoatRoughness: number }
> = {
  matte: { roughness: 0.86, clearcoat: 0.06, clearcoatRoughness: 0.6 },
  satin: { roughness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.3 },
  gloss: { roughness: 0.6, clearcoat: 1, clearcoatRoughness: 0.07 },
}

/** How far a pulled book travels clear of the case mouth, in cm. */
const PULL_CLEARANCE_CM = 3

/**
 * Fraction of the remaining pull distance left after one second.
 *
 * Sampled per frame as `decay^dt` so the slide takes the same wall-clock time
 * at any refresh rate, and a dropped frame doesn't teleport the book.
 */
const PULL_DECAY_PER_SECOND = 0.0009

interface BookNode {
  projectId: string
  mesh: Mesh
  /** Resting position inside the case. */
  home: Vector3
  /** Position when fully drawn out and turned to face front. */
  out: Vector3
  /** 0 stowed, 1 fully drawn. */
  pull: number
  target: number
}

export interface BoxSetScene {
  resize(width: number, height: number, pixelRatio: number): void
  setOrbit(state: OrbitState): void
  /** Advances pull animations. Returns true while anything is still moving. */
  step(dt: number): boolean
  render(): void
  /** Which book is under a point in normalized device coordinates, if any. */
  pick(ndcX: number, ndcY: number): string | null
  togglePulled(projectId: string | null): void
  pulledProjectId(): string | null
  /** Distance that frames the whole set at the given viewport aspect. */
  framingDistanceFor(aspect: number): number
  distanceLimits(): { minDistance: number; maxDistance: number }
  /** Renders the current view off-screen at an arbitrary size. */
  renderToBlob(width: number, height: number): Promise<Blob>
  dispose(): void
}

function textureFrom(canvas: HTMLCanvasElement, anisotropy: number): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = anisotropy
  // Spines and board edges are read at a glancing angle almost all the time,
  // which is exactly where a texture without mipmaps shimmers as it turns.
  texture.generateMipmaps = true
  return texture
}

/** Reads a cover's own colour so its spine and boards match its art. */
function coverColor(book: BoxSetBook, fallback: string): string {
  if (!book.cover) return fallback
  try {
    const probe = document.createElement('canvas')
    probe.width = 48
    probe.height = 64
    const ctx = probe.getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.drawImage(book.cover.source, 0, 0, probe.width, probe.height)
    return dominantColor(ctx.getImageData(0, 0, probe.width, probe.height).data)
  } catch {
    // Cover art loaded from a blob URL is same-origin, but a tainted canvas
    // would throw here rather than fail visibly, so fall back quietly.
    return fallback
  }
}

export function createBoxSetScene(input: BoxSetSceneInput): BoxSetScene {
  const { canvas, books, seriesName, author, boxSet } = input

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  // Filmic response rather than a straight clamp: highlights on a gloss
  // laminate roll off instead of blowing out to flat white, which is most of
  // what makes a render read as a photograph.
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  // Percentage-closer soft shadows: a box set sitting on a surface has a
  // contact shadow with a soft edge, and a hard-edged one looks cut out.
  renderer.shadowMap.type = 2 // PCFSoftShadowMap
  // The shadow map is redrawn only when the set itself moves, never when the
  // camera does. The key light is fixed relative to the box, so orbiting
  // cannot change a single shadow pixel — yet left on automatic the renderer
  // re-draws every mesh into a 2048² depth map on every frame of every drag,
  // which is a second full render of the scene for an image that is
  // identical to the last one.
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true

  const anisotropy = renderer.capabilities.getMaxAnisotropy()

  const scene = new Scene()
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 1, 2000)

  // Image-based lighting from a generated room: the slipcase picks up a
  // broad soft reflection the way a laminated board does under studio light.
  // Nothing is fetched — the environment is built procedurally at runtime.
  const pmrem = new PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = environment.texture
  // Dialled back from full strength. The generated room has bright emissive
  // panels in it, and a gloss clearcoat reflecting them at anything near a
  // grazing angle returns a whole panel of flat white — the artwork printed
  // underneath vanishes behind its own reflection. At this strength the
  // laminate still catches a soft highlight and the print stays readable.
  scene.environmentIntensity = 0.55

  const layout = layoutBoxSet(
    books.map((book) => ({ projectId: book.projectId, wordCount: book.wordCount })),
    boxSet.reveal,
  )

  const disposables: { dispose(): void }[] = [renderer, pmrem, environment]
  const track = <T extends { dispose(): void }>(value: T): T => {
    disposables.push(value)
    return value
  }

  const root = new Group()
  scene.add(root)

  buildLighting(scene, layout)
  const bookNodes = buildBooks(root, books, layout, anisotropy, track)
  buildCase(root, layout, { seriesName, author, boxSet, books }, anisotropy, track)
  buildGroundShadow(scene, layout, track)

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let pulled: string | null = null

  const minDistance = Math.max(layout.caseWidth, layout.caseHeight) * 0.62
  const maxDistance = Math.max(layout.caseWidth, layout.caseHeight) * 7

  return {
    resize(width, height, pixelRatio) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
    },

    setOrbit(state) {
      const position = cameraPosition(state)
      camera.position.set(position.x, position.y, position.z)
      camera.lookAt(0, 0, 0)
    },

    step(dt) {
      const decay = Math.pow(PULL_DECAY_PER_SECOND, Math.min(Math.max(dt, 0), 0.064))
      let moving = false
      for (const node of bookNodes) {
        const remaining = node.target - node.pull
        if (Math.abs(remaining) < 0.001) {
          if (node.pull !== node.target) {
            node.pull = node.target
            applyPull(node)
            moving = true
          }
          continue
        }
        node.pull = node.target - remaining * decay
        applyPull(node)
        moving = true
      }
      // Geometry moved, so the depth map is stale for exactly these frames.
      if (moving) renderer.shadowMap.needsUpdate = true
      return moving
    },

    render() {
      renderer.render(scene, camera)
    },

    pick(ndcX, ndcY) {
      pointer.set(ndcX, ndcY)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(
        bookNodes.map((node) => node.mesh),
        false,
      )
      const first = hits[0]?.object
      return first ? ((first.userData.projectId as string) ?? null) : null
    },

    togglePulled(projectId) {
      pulled = projectId === pulled ? null : projectId
      for (const node of bookNodes) node.target = node.projectId === pulled ? 1 : 0
    },

    pulledProjectId() {
      return pulled
    },

    framingDistanceFor(aspect) {
      return framingDistance(layout, CAMERA_FOV, aspect)
    },

    distanceLimits() {
      return { minDistance, maxDistance }
    },

    async renderToBlob(width, height) {
      return exportFrame(renderer, scene, camera, width, height)
    },

    dispose() {
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.geometry.dispose()
        for (const material of materialsOf(object)) {
          const map = (material as MeshStandardMaterial).map
          if (map) map.dispose()
          material.dispose()
        }
      })
      for (const item of disposables) item.dispose()
    },
  }
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

/**
 * Three lights, each doing one job.
 *
 * A key from front-left casts the only shadow — more than one shadow-casting
 * light gives an object two contact shadows, which never happens in a studio
 * and reads as wrong even to someone who can't say why. The fill lifts the
 * shadow side just enough to keep the far boards from going black, and a
 * little ambient keeps the interior of the case from becoming a void.
 */
function buildLighting(scene: Scene, layout: BoxSetLayout) {
  const reach = Math.max(layout.caseWidth, layout.caseHeight) * 1.6
  const extent = shadowExtent(layout)

  const key = new DirectionalLight(0xfff4e8, 2.4)
  key.position.set(-reach * 0.7, reach * 1.25, reach * 1.1)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -extent
  key.shadow.camera.right = extent
  key.shadow.camera.top = extent
  key.shadow.camera.bottom = -extent
  key.shadow.camera.near = 1
  key.shadow.camera.far = reach * 4
  // Without a bias the box set self-shadows in fine stripes where a face is
  // nearly edge-on to the light — the classic shadow-map acne.
  key.shadow.bias = -0.0008
  key.shadow.normalBias = 0.04
  scene.add(key)

  const fill = new DirectionalLight(0xdce8ff, 0.55)
  fill.position.set(reach, reach * 0.35, -reach * 0.8)
  scene.add(fill)

  scene.add(new AmbientLight(0xffffff, 0.28))
}

function buildBooks(
  root: Group,
  books: BoxSetBook[],
  layout: BoxSetLayout,
  anisotropy: number,
  track: <T extends { dispose(): void }>(value: T) => T,
): BookNode[] {
  // One paper texture for every book: the cut edge of a block of trade stock
  // looks the same whoever wrote it, and a texture per book would cost real
  // memory for an effect nobody could distinguish.
  const pageTexture = track(textureFrom(paintPageEdges(), anisotropy))
  const pageMaterial = track(new MeshStandardMaterial({ map: pageTexture, roughness: 0.94 }))

  // Assigned across the whole shelf rather than per book, so no two volumes
  // standing next to each other end up in the same binding.
  const fallbacks = clothColorsFor(books.map((book) => book.projectId))

  return books.map((book, index) => {
    const block = layout.books[index]
    const color = coverColor(book, fallbacks[index])
    const print = {
      title: book.title || 'Untitled',
      author: book.author,
      volume: book.volume,
      thicknessCm: block.thickness,
      color,
    }

    const front = book.cover
      ? paintCoverFromImage(book.cover.source, book.cover.width, book.cover.height)
      : paintFallbackCover(print)

    const jacket = (canvasTexture: HTMLCanvasElement) =>
      track(
        new MeshPhysicalMaterial({
          map: track(textureFrom(canvasTexture, anisotropy)),
          roughness: 0.44,
          metalness: 0,
          // A printed jacket is laminated, so it has a thin specular layer
          // over the ink rather than a uniform sheen.
          clearcoat: 0.5,
          clearcoatRoughness: 0.26,
        }),
      )

    const geometry = track(new BoxGeometry(block.thickness, BOOK_HEIGHT_CM, BOOK_WIDTH_CM))
    // BoxGeometry material order is +X, −X, +Y, −Y, +Z, −Z. The books stand
    // spine-out through the mouth of the case, so +Z is the spine and the
    // covers face sideways — which is why only the two end volumes show a
    // cover until one is drawn out.
    const mesh = new Mesh(geometry, [
      jacket(front),
      jacket(paintBackCover(print)),
      pageMaterial,
      pageMaterial,
      jacket(paintSpine(print)),
      pageMaterial,
    ])
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.projectId = book.projectId

    // Resting against the back wall of the case, then pushed forward by the
    // set's reveal so the spines stand proud of the mouth.
    const restZ =
      -(layout.caseDepth / 2) + CASE_WALL_CM + BOOK_WIDTH_CM / 2 + layout.revealDepth
    const home = new Vector3(block.offset, 0, restZ)
    const out = new Vector3(
      block.offset,
      // Drawn out, it stands on the same surface as the case rather than
      // floating at the height of the case floor.
      -CASE_WALL_CM,
      layout.caseDepth / 2 + BOOK_WIDTH_CM / 2 + PULL_CLEARANCE_CM,
    )

    mesh.position.copy(home)
    root.add(mesh)

    return { projectId: book.projectId, mesh, home, out, pull: 0, target: 0 }
  })
}

/**
 * Half-width of the region the key light can cast a shadow into.
 *
 * One source for both the light's own frustum and the sheet that catches the
 * shadow, so the two cannot drift apart and leave either a clipped shadow or
 * a plane that is mostly wasted.
 */
function shadowExtent(layout: BoxSetLayout): number {
  return Math.max(layout.caseWidth, layout.caseHeight) * 1.1
}

/** Point in the slide at which a book is clear of the case and can turn. */
const TURN_STARTS_AT = 0.45

/** Moves a book between its slot and its drawn-out pose. */
function applyPull(node: BookNode) {
  const t = node.pull
  node.mesh.position.lerpVectors(node.home, node.out, t)
  // It turns a quarter circle on the way out, so a drawn book presents its
  // front cover instead of its spine — the way you would hold it up. The
  // turn is delayed until it has cleared the mouth, because a book cannot
  // rotate through the boards it is still sitting between.
  const turn = t <= TURN_STARTS_AT ? 0 : (t - TURN_STARTS_AT) / (1 - TURN_STARTS_AT)
  node.mesh.rotation.y = -turn * (Math.PI / 2)
}

function buildCase(
  root: Group,
  layout: BoxSetLayout,
  print: { seriesName: string; author: string; boxSet: SeriesBoxSet; books: BoxSetBook[] },
  anisotropy: number,
  track: <T extends { dispose(): void }>(value: T) => T,
) {
  const { caseWidth, caseHeight, caseDepth } = layout
  const finish = FINISH[print.boxSet.finish] ?? FINISH.satin

  const printInput = {
    seriesName: print.seriesName || 'Untitled series',
    author: print.author,
    bookCount: print.books.length,
    caseColor: print.boxSet.caseColor,
    foilColor: print.boxSet.foilColor,
    // The case is printed from the covers of the books inside it, so it
    // always matches whatever art those books currently carry — change a
    // cover in the studio and the slipcase changes with it.
    covers: print.books.flatMap((book) => (book.cover ? [book.cover] : [])),
  }

  const board = (canvasTexture: HTMLCanvasElement) =>
    track(
      new MeshPhysicalMaterial({
        map: track(textureFrom(canvasTexture, anisotropy)),
        roughness: finish.roughness,
        metalness: 0,
        clearcoat: finish.clearcoat,
        clearcoatRoughness: finish.clearcoatRoughness,
      }),
    )

  // The cut edge of greyboard and the unprinted inside of the case: the two
  // surfaces that give a slipcase away as a made object rather than a solid
  // coloured cube.
  const edge = track(
    new MeshStandardMaterial({
      map: track(textureFrom(paintBoardEdge(print.boxSet.caseColor), anisotropy)),
      roughness: 0.88,
    }),
  )
  const lining = track(
    new MeshStandardMaterial({ color: new Color(shade(print.boxSet.caseColor, -0.55)), roughness: 0.95 }),
  )

  const panel = (
    geometry: BoxGeometry,
    position: Vector3,
    materials: (Material | null)[],
  ) => {
    const mesh = new Mesh(
      track(geometry),
      materials.map((material) => material ?? edge),
    )
    mesh.position.copy(position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
  }

  const w = CASE_WALL_CM
  const backPrint = board(paintCasePanel(printInput, caseWidth, caseHeight))
  const sidePrint = () => board(paintCasePanel(printInput, caseDepth, caseHeight))
  const topPrint = board(paintCasePanel(printInput, caseWidth, caseDepth))

  // Back panel: printed outside (−Z), lined inside (+Z).
  panel(
    new BoxGeometry(caseWidth, caseHeight, w),
    new Vector3(0, 0, -caseDepth / 2 + w / 2),
    [edge, edge, edge, edge, lining, backPrint],
  )

  // Top and bottom: printed outside, lined in. Their front edges are cut
  // board, which is what you look straight at when facing the mouth.
  panel(
    new BoxGeometry(caseWidth, w, caseDepth),
    new Vector3(0, caseHeight / 2 - w / 2, 0),
    [edge, edge, topPrint, lining, edge, edge],
  )
  panel(
    new BoxGeometry(caseWidth, w, caseDepth),
    new Vector3(0, -caseHeight / 2 + w / 2, 0),
    [edge, edge, lining, topPrint, edge, edge],
  )

  // Sides: the big printed faces you see for most of an orbit.
  const innerHeight = caseHeight - w * 2
  panel(
    new BoxGeometry(w, innerHeight, caseDepth),
    new Vector3(caseWidth / 2 - w / 2, 0, 0),
    [sidePrint(), lining, edge, edge, edge, edge],
  )
  panel(
    new BoxGeometry(w, innerHeight, caseDepth),
    new Vector3(-caseWidth / 2 + w / 2, 0, 0),
    [lining, sidePrint(), edge, edge, edge, edge],
  )
}

/**
 * A contact shadow on an invisible floor.
 *
 * `ShadowMaterial` paints only where light is blocked, so the plane itself
 * stays transparent and the set appears to sit on the page's own background
 * rather than on a grey rectangle someone forgot to remove.
 */
function buildGroundShadow(
  scene: Scene,
  layout: BoxSetLayout,
  track: <T extends { dispose(): void }>(value: T) => T,
) {
  // Sized to the key light's shadow frustum, and no larger. Every pixel of
  // this plane runs a soft-shadow lookup, and outside the frustum that lookup
  // can only ever return "lit" — so a plane spilling off-screen costs a full
  // screen of percentage-closer filtering to draw nothing at all. The image
  // is identical either way: the same shadow, on a smaller sheet.
  const size = shadowExtent(layout) * 2
  const ground = new Mesh(
    track(new PlaneGeometry(size, size)),
    track(new ShadowMaterial({ opacity: 0.34 })),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -layout.caseHeight / 2 - CASE_WALL_CM
  ground.receiveShadow = true
  scene.add(ground)
}

/**
 * Renders one frame off-screen at an arbitrary size.
 *
 * Off-screen rather than by resizing the visible canvas: reading back the
 * default drawing buffer needs `preserveDrawingBuffer`, which costs every
 * frame of the interactive view for the sake of an export that happens once.
 * A multisampled render target gives the same antialiasing without that, and
 * it isn't bound by the canvas's own size limits.
 */
async function exportFrame(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  width: number,
  height: number,
): Promise<Blob> {
  const target = new WebGLRenderTarget(width, height, { samples: 4 })
  // Rendering to a target skips the renderer's output conversion, so the
  // target's own texture has to declare sRGB or the export comes back
  // noticeably darker than what is on screen.
  target.texture.colorSpace = SRGBColorSpace

  const previousTarget = renderer.getRenderTarget()
  const previousAspect = camera.aspect
  const previousSize = renderer.getSize(new Vector2())
  const previousPixelRatio = renderer.getPixelRatio()

  try {
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)

    const pixels = new Uint8Array(width * height * 4)
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot export the render')

    // WebGL hands back rows bottom-up; a 2D canvas wants them top-down.
    const flipped = new Uint8ClampedArray(pixels.length)
    const rowBytes = width * 4
    for (let y = 0; y < height; y++) {
      const from = (height - 1 - y) * rowBytes
      flipped.set(pixels.subarray(from, from + rowBytes), y * rowBytes)
    }
    ctx.putImageData(new ImageData(flipped, width, height), 0, 0)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the render'))),
        'image/png',
      )
    })
  } finally {
    renderer.setRenderTarget(previousTarget)
    renderer.setPixelRatio(previousPixelRatio)
    renderer.setSize(previousSize.x, previousSize.y, false)
    camera.aspect = previousAspect
    camera.updateProjectionMatrix()
    target.dispose()
  }
}
