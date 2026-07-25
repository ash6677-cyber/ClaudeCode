import * as THREE from './vendor/three.module.min.js';

/* ===========================================================
   Dynamic 3D Trophy Cabinet
   One shared WebGL renderer draws into many page "slots" each
   frame (the standard three.js "multiple elements" technique),
   so having dozens of trophies on screen stays cheap — a single
   GL context instead of one per card.

   Trophies are original stylized designs (not replicas of any
   specific real trophy), rendered with product-photography-style
   lighting: smoothed lathe profiles, clearcoat metal, a baked
   environment map, ACES tone mapping and a grounded contact
   shadow for a premium, true-to-type (crown/cup/shield/medal)
   look.
   =========================================================== */

const TIER_MATERIAL = {
  gold:   { color: 0xcda44d, metalness: 1, roughness: 0.32, emissive: 0x000000, emissiveIntensity: 0 },
  silver: { color: 0xc6cad2, metalness: 1, roughness: 0.28, emissive: 0x000000, emissiveIntensity: 0 },
  bronze: { color: 0xa9754e, metalness: 1, roughness: 0.38, emissive: 0x000000, emissiveIntensity: 0 }
};

const FLOOR_Y = -1.28;

let renderer = null;
let canvas = null;
let sharedEnvMap = null;
let sharedPlinthMaterial = null;
let sharedShadowMaterial = null;
let sharedShadowGeometry = null;
const instances = new Map();

/* ---- Shared (never-disposed) resources ---- */

function makeShadowTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function ensureSharedResources() {
  if (sharedPlinthMaterial) return;
  sharedPlinthMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x15161c, metalness: 0.15, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.22
  });
  sharedShadowMaterial = new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false });
  sharedShadowGeometry = new THREE.PlaneGeometry(1.9, 1.9);
}

function makeSoftGradientTexture(size, innerHex, outerHex, stopPos) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, innerHex);
  grad.addColorStop(stopPos != null ? stopPos : 0.65, innerHex);
  grad.addColorStop(1, outerHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function makeStudioGridTexture(size, cells, cellHex, gapHex) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = gapHex;
  ctx.fillRect(0, 0, size, size);
  const cell = size / cells;
  ctx.fillStyle = cellHex;
  const pad = cell * 0.1;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2);
    }
  }
  return new THREE.CanvasTexture(c);
}

function buildEnvScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x14161e);

  const planeGeo = new THREE.PlaneGeometry(9, 9);
  const panel = (texture, tint, x, y, z, rx, ry, scale) => {
    const mat = new THREE.MeshBasicMaterial({ map: texture, color: tint || 0xffffff });
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    mesh.scale.setScalar(scale || 1);
    envScene.add(mesh);
  };

  // Large soft overhead key light — gentle gradient, not a flat color block.
  panel(makeSoftGradientTexture(1024, '#fbf3e4', '#14161e', 0.35), 0xffffff, 0, 5.5, -1, Math.PI / 2.15, 0, 1.4);
  // Studio window/grid banks either side, the classic reason polished metal
  // reads as "real" instead of "plastic" — reflections pick up many small
  // panes rather than one solid color.
  panel(makeStudioGridTexture(1024, 5, '#eef2f8', '#1a1c24'), 0xffffff, -4.6, 0.4, 1.5, 0, Math.PI / 2.05, 1.15);
  panel(makeStudioGridTexture(1024, 6, '#f4efe6', '#20222c'), 0xffffff, 4.6, -0.3, 1.5, 0, -Math.PI / 2.05, 1.05);
  // Dim, muted ground bounce so undersides aren't pitch black.
  panel(makeSoftGradientTexture(1024, '#3a3428', '#0c0d12', 0.5), 0xffffff, 0, -4.6, 1.5, -Math.PI / 2.2, 0, 1);
  // Subtle rear fill, kept neutral rather than saturated.
  panel(makeSoftGradientTexture(1024, '#e7e2da', '#14161e', 0.4), 0xffffff, 0, 0.8, 4.8, Math.PI, 0, 0.85);

  return envScene;
}

function buildSharedEnvMap() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const rt = pmrem.fromScene(buildEnvScene(), 0.18);
  pmrem.dispose();
  return rt.texture;
}

function makeMaterial(tier) {
  const t = TIER_MATERIAL[tier] || TIER_MATERIAL.gold;
  return new THREE.MeshPhysicalMaterial({
    color: t.color, metalness: t.metalness, roughness: t.roughness,
    emissive: t.emissive, emissiveIntensity: t.emissiveIntensity,
    clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 1.05
  });
}

/* ---- Geometry helpers ---- */

function smoothProfile(points, samples) {
  const curve = new THREE.SplineCurve(points);
  return curve.getPoints(samples || 64);
}

function latheCup(rawPoints, material, segments, samples) {
  const pts = smoothProfile(rawPoints, samples);
  const geo = new THREE.LatheGeometry(pts, segments || 80);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// A flat extruded cap (e.g. the shield's front face) has no interior
// vertices — it's a handful of large triangles fanned across the boundary —
// so it can only ever catch one or two flat patches of reflection, reading
// as a shiny cardboard cutout. This builds a real subdivided grid clipped to
// a width profile and bulged into a shallow dome, so it shades like a
// pressed metal plate instead.
function buildDomedPanel(widthFn, yBottom, yTop, rows, cols, bulge) {
  const positions = [];
  const yMid = (yTop + yBottom) / 2;
  const yHalf = (yTop - yBottom) / 2;
  for (let iy = 0; iy <= rows; iy++) {
    const y = yBottom + (iy / rows) * (yTop - yBottom);
    const w = Math.max(0.001, widthFn(y));
    for (let ix = 0; ix <= cols; ix++) {
      const x = -w + (ix / cols) * (2 * w);
      const rx = x / w;
      const ry = (y - yMid) / yHalf;
      const r = Math.min(1, Math.sqrt(rx * rx + ry * ry));
      const z = bulge * (1 - r * r);
      positions.push(x, y, z);
    }
  }
  const indices = [];
  const stride = cols + 1;
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const a = ix + stride * iy;
      const b = ix + stride * (iy + 1);
      const c = (ix + 1) + stride * (iy + 1);
      const d = (ix + 1) + stride * iy;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function plinth(radius, height) {
  ensureSharedResources();
  const geo = new THREE.CylinderGeometry(radius, radius * 1.08, height, 48, 1, false);
  const mesh = new THREE.Mesh(geo, sharedPlinthMaterial);
  mesh.position.y = height / 2;
  return mesh;
}

function metalCollar(radius, height, material) {
  const geo = new THREE.CylinderGeometry(radius * 1.12, radius * 1.22, height, 48);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = height / 2;
  return mesh;
}

function neckBand(radius, y, material) {
  const geo = new THREE.TorusGeometry(radius, radius * 0.08, 16, 56);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function handle(radiusMajor, radiusMinor, y, side, material) {
  const geo = new THREE.TorusGeometry(radiusMajor, radiusMinor, 20, 48, Math.PI * 1.08);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.z = Math.PI / 2 + (side < 0 ? Math.PI : 0);
  mesh.rotation.y = side < 0 ? Math.PI : 0;
  mesh.position.set(side * radiusMajor * 0.7, y, 0);
  return mesh;
}

/* ---- Trophy archetypes ---- */

function buildClassicCup(material) {
  const g = new THREE.Group();
  g.add(plinth(0.66, 0.2));
  const collar = metalCollar(0.5, 0.16, material);
  collar.position.y = 0.2 + 0.08;
  g.add(collar);

  const stemTop = 0.36;
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.16, 0.0),
    new THREE.Vector2(0.18, 0.03),
    new THREE.Vector2(0.14, 0.1),
    new THREE.Vector2(0.13, stemTop),
    new THREE.Vector2(0.22, stemTop + 0.14),
    new THREE.Vector2(0.44, stemTop + 0.3),
    new THREE.Vector2(0.5, stemTop + 0.52),
    new THREE.Vector2(0.46, stemTop + 0.74),
    new THREE.Vector2(0.36, stemTop + 0.86),
    new THREE.Vector2(0.4, stemTop + 0.92),
    new THREE.Vector2(0.0, stemTop + 0.95)
  ];
  const cupY = 0.2 + 0.16;
  const cup = latheCup(pts, material, 88);
  cup.position.y = cupY;
  g.add(cup);
  g.add(neckBand(0.135, cupY + stemTop * 0.55, material));

  const h1 = handle(0.4, 0.045, cupY + stemTop + 0.22, 1, material);
  const h2 = handle(0.4, 0.045, cupY + stemTop + 0.22, -1, material);
  g.add(h1, h2);

  return g;
}

function buildCrownTitle(material) {
  const g = new THREE.Group();
  g.add(plinth(0.64, 0.22));
  const collar = metalCollar(0.48, 0.16, material);
  collar.position.y = 0.22 + 0.08;
  g.add(collar);

  const stemTop = 0.3;
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.15, 0.0),
    new THREE.Vector2(0.17, 0.04),
    new THREE.Vector2(0.12, 0.14),
    new THREE.Vector2(0.11, stemTop),
    new THREE.Vector2(0.24, stemTop + 0.16),
    new THREE.Vector2(0.42, stemTop + 0.42),
    new THREE.Vector2(0.46, stemTop + 0.64),
    new THREE.Vector2(0.38, stemTop + 0.8),
    new THREE.Vector2(0.42, stemTop + 0.86),
    new THREE.Vector2(0.0, stemTop + 0.88)
  ];
  const cupY = 0.22 + 0.16;
  const cup = latheCup(pts, material, 88);
  cup.position.y = cupY;
  g.add(cup);
  g.add(neckBand(0.115, cupY + stemTop * 0.5, material));

  const spikeGeo = new THREE.ConeGeometry(0.065, 0.24, 12);
  const rimY = cupY + stemTop + 0.88;
  const rimR = 0.4;
  const spikeCount = 6;
  for (let i = 0; i < spikeCount; i++) {
    const a = (i / spikeCount) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, material);
    spike.position.set(Math.cos(a) * rimR, rimY + 0.11, Math.sin(a) * rimR);
    g.add(spike);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 32), material);
  ball.position.y = rimY + 0.3;
  g.add(ball);

  return g;
}

function buildContinental(material) {
  const g = new THREE.Group();
  g.add(plinth(0.7, 0.22));
  const collar = metalCollar(0.5, 0.18, material);
  collar.position.y = 0.22 + 0.09;
  g.add(collar);

  const stemTop = 0.5;
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.16, 0.03),
    new THREE.Vector2(0.1, 0.12),
    new THREE.Vector2(0.08, stemTop),
    new THREE.Vector2(0.14, stemTop + 0.1),
    new THREE.Vector2(0.24, stemTop + 0.22),
    new THREE.Vector2(0.42, stemTop + 0.4),
    new THREE.Vector2(0.5, stemTop + 0.6),
    new THREE.Vector2(0.34, stemTop + 0.8),
    new THREE.Vector2(0.4, stemTop + 0.9),
    new THREE.Vector2(0.0, stemTop + 0.92)
  ];
  const cupY = 0.22 + 0.18;
  const cup = latheCup(pts, material, 96);
  cup.position.y = cupY;
  g.add(cup);
  g.add(neckBand(0.09, cupY + stemTop * 0.55, material));

  const h1 = handle(0.35, 0.04, cupY + stemTop + 0.3, 1, material);
  const h2 = handle(0.35, 0.04, cupY + stemTop + 0.3, -1, material);
  g.add(h1, h2);

  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 40, 40), material);
  globe.position.y = cupY + stemTop + 0.92 + 0.18;
  g.add(globe);
  const globeRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.014, 12, 48), material);
  globeRing.rotation.x = Math.PI / 2.4;
  globeRing.position.y = globe.position.y;
  g.add(globeRing);

  return g;
}

function buildShield(material) {
  ensureSharedResources();
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0.6);
  shape.lineTo(0.5, 0.6);
  shape.lineTo(0.5, -0.05);
  shape.bezierCurveTo(0.5, -0.5, 0.28, -0.66, 0.0, -0.82);
  shape.bezierCurveTo(-0.28, -0.66, -0.5, -0.5, -0.5, -0.05);
  shape.lineTo(-0.5, 0.6);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.045, bevelSegments: 6, curveSegments: 24 });
  geo.center();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = 0.55;
  g.add(mesh);

  // Raised, domed face plaque inset within the shield frame — the frame's
  // own front cap is a flat, un-subdivided triangle fan and can't shade like
  // metal, so the visible "face" of the shield is this separate subdivided
  // panel instead.
  const plaqueWidth = (y) => {
    if (y >= 0.62) return 0.36;
    const t = Math.max(0, Math.min(1, (y - 0.08) / 0.54));
    return 0.36 * Math.pow(t, 0.6);
  };
  const plaqueGeo = buildDomedPanel(plaqueWidth, 0.08, 1.02, 20, 16, 0.11);
  const plaque = new THREE.Mesh(plaqueGeo, material);
  plaque.position.z = 0.14;
  g.add(plaque);

  const badgeGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.045, 48);
  const badge = new THREE.Mesh(badgeGeo, sharedPlinthMaterial);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, 0.62, 0.29);
  g.add(badge);
  const badgeRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 12, 48), material);
  badgeRing.position.set(0, 0.62, 0.295);
  g.add(badgeRing);

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.42, 24), material);
  stand.position.y = 0.02;
  g.add(stand);
  g.add(plinth(0.46, 0.2));

  return g;
}

function buildMedal(material) {
  ensureSharedResources();
  const g = new THREE.Group();
  const ribbonMat = new THREE.MeshPhysicalMaterial({ color: 0x33437a, metalness: 0.05, roughness: 0.6, clearcoat: 0.2 });
  const ribbonGeo = new THREE.BoxGeometry(0.46, 0.72, 0.05);
  const ribbonL = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonL.position.set(-0.15, 0.52, -0.02);
  ribbonL.rotation.z = 0.14;
  const ribbonR = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonR.position.set(0.15, 0.52, -0.02);
  ribbonR.rotation.z = -0.14;
  g.add(ribbonL, ribbonR);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 64), material);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 16, 64), material);
  rim.position.z = 0.05;
  g.add(rim);

  const star = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 5), material);
  star.rotation.x = Math.PI / 2;
  star.rotation.z = Math.PI;
  star.position.z = 0.09;
  g.add(star);

  g.position.y = 0.3;
  g.scale.setScalar(0.92);
  return g;
}

const BUILDERS = {
  cup: buildClassicCup,
  crown: buildCrownTitle,
  continental: buildContinental,
  shield: buildShield,
  medal: buildMedal
};

function buildTrophyGroup(type, tier) {
  ensureSharedResources();
  const material = makeMaterial(tier);
  const builder = BUILDERS[type] || BUILDERS.cup;
  return builder(material);
}

/* ---- Renderer plumbing ---- */

function ensureRenderer() {
  if (renderer) return;
  ensureSharedResources();
  canvas = document.createElement('canvas');
  canvas.id = 'trophy3d-shared-canvas';
  document.body.appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  // Force real supersampling rather than only scaling up for already-retina
  // screens: a plain 1x monitor previously rendered trophies at exactly one
  // sample per screen pixel (antialias alone can't fix that), so cards
  // looked soft compared to the rest of the glass-morphic UI. Flooring at 2x
  // and allowing up to 3x on genuine hi-dpi panels gets consistently crisp,
  // near-4K-density renders across all displays.
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 2), 3));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  sharedEnvMap = buildSharedEnvMap();
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(renderLoop);
  wireInteraction();
}

function resize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function addLights(scene) {
  const hemi = new THREE.HemisphereLight(0xf5f3ef, 0x24242e, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6e8, 2.1);
  key.position.set(2.2, 3.2, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe3f2, 1.0);
  rim.position.set(-3, 1.5, -2.5);
  scene.add(rim);
  const fill = new THREE.PointLight(0xfff2dc, 0.6, 10);
  fill.position.set(-1.5, -1, 2.5);
  scene.add(fill);
  const kicker = new THREE.PointLight(0xffffff, 0.35, 8);
  kicker.position.set(0, -1.5, 3.5);
  scene.add(kicker);
}

export function mountTrophy(key, container, type, tier) {
  ensureRenderer();
  if (instances.has(key)) return;
  const scene = new THREE.Scene();
  scene.environment = sharedEnvMap;
  scene.environmentIntensity = 1.35;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.15, 4.6);
  camera.lookAt(0, 0.05, 0);

  addLights(scene);
  const group = buildTrophyGroup(type, tier);

  const box = new THREE.Box3().setFromObject(group);
  group.position.y += (FLOOR_Y - box.min.y);
  scene.add(group);

  const shadow = new THREE.Mesh(sharedShadowGeometry, sharedShadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = FLOOR_Y + 0.005;
  scene.add(shadow);

  container.dataset.trophy3d = key;
  container.classList.add('trophy3d-slot');

  instances.set(key, {
    scene, camera, group, container,
    rotY: -0.5, rotX: 0.08,
    dragging: false, autoRotate: true
  });
}

export function unmountTrophy(key) {
  const inst = instances.get(key);
  if (!inst) return;
  inst.group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material !== sharedPlinthMaterial) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    }
  });
  instances.delete(key);
}

export function unmountAll() {
  Array.from(instances.keys()).forEach(unmountTrophy);
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  if (!renderer) return;
  const canvasHeight = renderer.domElement.clientHeight;
  const canvasWidth = renderer.domElement.clientWidth;

  // Each render() below only clears its own scissored viewport, so any
  // pixels not covered by a currently-visible trophy slot this frame (e.g.
  // a card that just left the DOM, or a slot that moved) would otherwise
  // keep showing whatever was drawn there last — a persistent ghost image.
  // A full-canvas clear up front guarantees nothing lingers between frames.
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, canvasWidth, canvasHeight);
  renderer.clear();

  if (!instances.size) return;

  instances.forEach(inst => {
    if (!inst.container.isConnected) { unmountTrophy(inst.container.dataset.trophy3d); return; }
    const rect = inst.container.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > canvasHeight || rect.right < 0 || rect.left > canvasWidth || rect.width < 2) return;

    if (!inst.dragging && inst.autoRotate) inst.rotY += 0.0045;
    inst.group.rotation.y = inst.rotY;
    inst.group.rotation.x = inst.rotX;

    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    const left = rect.left;
    const bottom = canvasHeight - rect.bottom;

    renderer.setScissorTest(false);
    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setScissorTest(true);
    inst.camera.aspect = width / height;
    inst.camera.updateProjectionMatrix();
    renderer.render(inst.scene, inst.camera);
  });
}

function wireInteraction() {
  let activeKey = null, startX = 0, startY = 0, startRotY = 0, startRotX = 0, moved = false;

  window.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-trophy3d]');
    if (!el) return;
    const inst = instances.get(el.dataset.trophy3d);
    if (!inst) return;
    activeKey = el.dataset.trophy3d;
    inst.dragging = true;
    moved = false;
    startX = e.clientX; startY = e.clientY;
    startRotY = inst.rotY; startRotX = inst.rotX;
  });
  window.addEventListener('pointermove', e => {
    if (!activeKey) return;
    const inst = instances.get(activeKey);
    if (!inst) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    inst.rotY = startRotY + dx * 0.012;
    inst.rotX = Math.max(-0.6, Math.min(0.6, startRotX + dy * 0.008));
  });
  window.addEventListener('pointerup', () => {
    if (activeKey) {
      const inst = instances.get(activeKey);
      if (inst) inst.dragging = false;
    }
    activeKey = null;
  });

  window.__trophy3dWasDragged = () => moved;
}

window.Trophy3D = { mountTrophy, unmountTrophy, unmountAll };
window.dispatchEvent(new Event('trophy3d-ready'));
