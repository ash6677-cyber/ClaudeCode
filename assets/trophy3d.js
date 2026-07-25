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
  gold:   { color: 0xffc21f, metalness: 1, roughness: 0.2, emissive: 0x4a2c00, emissiveIntensity: 0.24 },
  silver: { color: 0xdde1ea, metalness: 1, roughness: 0.14, emissive: 0x0d0f18, emissiveIntensity: 0.1 },
  bronze: { color: 0xcd8a54, metalness: 1, roughness: 0.26, emissive: 0x2a1300, emissiveIntensity: 0.18 }
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
  const size = 256;
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

function buildEnvScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0b0d16);

  const planeGeo = new THREE.PlaneGeometry(9, 9);
  const softbox = (color, x, y, z, rx, ry, intensity) => {
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    mesh.scale.setScalar(intensity || 1);
    envScene.add(mesh);
  };
  softbox(0xfff8e8, 0, 5, -1.5, Math.PI / 2.2, 0, 1.3);
  softbox(0xcfe6ff, -4.5, 0.5, 2, 0, Math.PI / 2.05, 1.1);
  softbox(0xffffff, 4.5, -0.5, 2, 0, -Math.PI / 2.05, 1.2);
  softbox(0x554c3a, 0, -4.5, 2, -Math.PI / 2.2, 0, 1);
  softbox(0xffe2b0, 0, 1, 4.5, Math.PI, 0, 0.7);
  return envScene;
}

function buildSharedEnvMap() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const rt = pmrem.fromScene(buildEnvScene(), 0.03);
  pmrem.dispose();
  return rt.texture;
}

function makeMaterial(tier) {
  const t = TIER_MATERIAL[tier] || TIER_MATERIAL.gold;
  return new THREE.MeshPhysicalMaterial({
    color: t.color, metalness: t.metalness, roughness: t.roughness,
    emissive: t.emissive, emissiveIntensity: t.emissiveIntensity,
    clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.25
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
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 6, curveSegments: 24 });
  geo.center();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = 0.55;
  g.add(mesh);

  const badgeGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.045, 48);
  const badge = new THREE.Mesh(badgeGeo, sharedPlinthMaterial);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, 0.62, 0.115);
  g.add(badge);
  const badgeRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 12, 48), material);
  badgeRing.position.set(0, 0.62, 0.12);
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
  const ribbonMat = new THREE.MeshPhysicalMaterial({ color: 0x2f4fd6, metalness: 0.05, roughness: 0.55, clearcoat: 0.3 });
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
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
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a2a, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(2.2, 3.2, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fd0ff, 1.5);
  rim.position.set(-3, 1.5, -2.5);
  scene.add(rim);
  const fill = new THREE.PointLight(0xffe9b0, 0.9, 10);
  fill.position.set(-1.5, -1, 2.5);
  scene.add(fill);
  const kicker = new THREE.PointLight(0xffffff, 0.5, 8);
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
  if (!renderer || !instances.size) return;
  const canvasHeight = renderer.domElement.clientHeight;
  const canvasWidth = renderer.domElement.clientWidth;

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
