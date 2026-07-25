import * as THREE from './vendor/three.module.min.js';

/* ===========================================================
   Dynamic 3D Trophy Cabinet
   One shared WebGL renderer draws into many page "slots" each
   frame (the standard three.js "multiple elements" technique),
   so having dozens of trophies on screen stays cheap — a single
   GL context instead of one per card.
   =========================================================== */

const TIER_MATERIAL = {
  gold:   { color: 0xffc21f, metalness: 1, roughness: 0.24, emissive: 0x4a2c00, emissiveIntensity: 0.3 },
  silver: { color: 0xd7dbe6, metalness: 1, roughness: 0.18, emissive: 0x0d0f18, emissiveIntensity: 0.12 },
  bronze: { color: 0xcd8a54, metalness: 1, roughness: 0.3, emissive: 0x2a1300, emissiveIntensity: 0.22 }
};

let renderer = null;
let canvas = null;
let sharedEnvMap = null;
const instances = new Map();

function buildEnvScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0c0e18);

  const planeGeo = new THREE.PlaneGeometry(8, 8);
  const softbox = (color, x, y, z, rx, ry) => {
    const mesh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    envScene.add(mesh);
  };
  softbox(0xfff6e0, 0, 4, -1, Math.PI / 2.3, 0);
  softbox(0xcfe6ff, -4, 0.5, 2, 0, Math.PI / 2.1);
  softbox(0xffffff, 4, -0.5, 2, 0, -Math.PI / 2.1);
  softbox(0x4a4436, 0, -4, 2, -Math.PI / 2.3, 0);
  return envScene;
}

function buildSharedEnvMap() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const rt = pmrem.fromScene(buildEnvScene(), 0.035);
  pmrem.dispose();
  return rt.texture;
}

function makeMaterial(tier) {
  const t = TIER_MATERIAL[tier] || TIER_MATERIAL.gold;
  return new THREE.MeshStandardMaterial({
    color: t.color, metalness: t.metalness, roughness: t.roughness,
    emissive: t.emissive, emissiveIntensity: t.emissiveIntensity
  });
}

function pedestal(radius, height, material) {
  const geo = new THREE.CylinderGeometry(radius * 1.15, radius * 1.3, height, 40);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = height / 2;
  return mesh;
}

function latheCup(points, material, segments) {
  const geo = new THREE.LatheGeometry(points, segments || 48);
  return new THREE.Mesh(geo, material);
}

function handle(radiusMajor, radiusMinor, y, side, material) {
  const geo = new THREE.TorusGeometry(radiusMajor, radiusMinor, 16, 32, Math.PI * 1.1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.z = Math.PI / 2 + (side < 0 ? Math.PI : 0);
  mesh.rotation.y = side < 0 ? Math.PI : 0;
  mesh.position.set(side * radiusMajor * 0.72, y, 0);
  return mesh;
}

/* ---- Trophy archetypes ---- */

function buildClassicCup(material) {
  const g = new THREE.Group();
  const base = pedestal(0.62, 0.22, material);
  g.add(base);

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.42, 0.0),
    new THREE.Vector2(0.46, 0.06),
    new THREE.Vector2(0.3, 0.16),
    new THREE.Vector2(0.24, 0.32),
    new THREE.Vector2(0.3, 0.5),
    new THREE.Vector2(0.5, 0.66),
    new THREE.Vector2(0.56, 0.86),
    new THREE.Vector2(0.42, 1.0),
    new THREE.Vector2(0.46, 1.08),
    new THREE.Vector2(0.0, 1.1)
  ];
  const cup = latheCup(pts, material);
  cup.position.y = 0.24;
  g.add(cup);

  const h1 = handle(0.42, 0.05, 0.24 + 0.62, 1, material);
  const h2 = handle(0.42, 0.05, 0.24 + 0.62, -1, material);
  g.add(h1, h2);

  g.position.y = -0.75;
  return g;
}

function buildCrownTitle(material) {
  const g = new THREE.Group();
  const base = pedestal(0.6, 0.24, material);
  g.add(base);

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.4, 0.0),
    new THREE.Vector2(0.44, 0.08),
    new THREE.Vector2(0.26, 0.22),
    new THREE.Vector2(0.34, 0.55),
    new THREE.Vector2(0.5, 0.72),
    new THREE.Vector2(0.4, 0.9),
    new THREE.Vector2(0.44, 0.98),
    new THREE.Vector2(0.0, 1.0)
  ];
  const cup = latheCup(pts, material);
  cup.position.y = 0.26;
  g.add(cup);

  // crown points on the rim
  const spikeGeo = new THREE.ConeGeometry(0.07, 0.22, 6);
  const rimY = 0.26 + 0.98;
  const rimR = 0.42;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, material);
    spike.position.set(Math.cos(a) * rimR, rimY + 0.1, Math.sin(a) * rimR);
    g.add(spike);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 20), material);
  ball.position.y = rimY + 0.24;
  g.add(ball);

  g.position.y = -0.78;
  return g;
}

function buildContinental(material) {
  const g = new THREE.Group();
  const base = pedestal(0.66, 0.24, material);
  g.add(base);

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.4, 0.05),
    new THREE.Vector2(0.22, 0.14),
    new THREE.Vector2(0.16, 0.3),
    new THREE.Vector2(0.22, 0.46),
    new THREE.Vector2(0.4, 0.6),
    new THREE.Vector2(0.5, 0.82),
    new THREE.Vector2(0.34, 1.0),
    new THREE.Vector2(0.4, 1.1),
    new THREE.Vector2(0.0, 1.12)
  ];
  const cup = latheCup(pts, material, 64);
  cup.position.y = 0.26;
  g.add(cup);

  const h1 = handle(0.36, 0.045, 0.26 + 0.5, 1, material);
  const h2 = handle(0.36, 0.045, 0.26 + 0.5, -1, material);
  g.add(h1, h2);

  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 32), material);
  globe.position.y = 0.26 + 1.12 + 0.17;
  g.add(globe);

  g.position.y = -0.82;
  return g;
}

function buildShield(material) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0.55);
  shape.lineTo(0.5, 0.55);
  shape.lineTo(0.5, -0.1);
  shape.quadraticCurveTo(0.5, -0.55, 0.0, -0.75);
  shape.quadraticCurveTo(-0.5, -0.55, -0.5, -0.1);
  shape.lineTo(-0.5, 0.55);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4 });
  geo.center();
  const mesh = new THREE.Mesh(geo, material);
  g.add(mesh);

  const standGeo = new THREE.BoxGeometry(0.14, 0.4, 0.14);
  const stand = new THREE.Mesh(standGeo, material);
  stand.position.y = -0.85;
  g.add(stand);
  const baseMesh = pedestal(0.42, 0.16, material);
  baseMesh.position.y = -1.05;
  g.add(baseMesh);

  return g;
}

function buildMedal(material) {
  const g = new THREE.Group();
  const ribbonGeo = new THREE.BoxGeometry(0.5, 0.7, 0.05);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x3355dd, metalness: 0.1, roughness: 0.7 });
  const ribbonL = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonL.position.set(-0.16, 0.5, -0.02);
  ribbonL.rotation.z = 0.15;
  const ribbonR = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonR.position.set(0.16, 0.5, -0.02);
  ribbonR.rotation.z = -0.15;
  g.add(ribbonL, ribbonR);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 48), material);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);

  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 5), material);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.z = 0.02;
  g.add(emblem);

  g.scale.setScalar(0.95);
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
  const material = makeMaterial(tier);
  const builder = BUILDERS[type] || BUILDERS.cup;
  return builder(material);
}

/* ---- Renderer plumbing ---- */

function ensureRenderer() {
  if (renderer) return;
  canvas = document.createElement('canvas');
  canvas.id = 'trophy3d-shared-canvas';
  document.body.appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.setClearColor(0x000000, 0);
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
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a2a, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.2, 3, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fd0ff, 1.4);
  rim.position.set(-3, 1.5, -2.5);
  scene.add(rim);
  const fill = new THREE.PointLight(0xffe9b0, 0.8, 10);
  fill.position.set(-1.5, -1, 2.5);
  scene.add(fill);
}

export function mountTrophy(key, container, type, tier) {
  ensureRenderer();
  if (instances.has(key)) return;
  const scene = new THREE.Scene();
  scene.environment = sharedEnvMap;
  scene.environmentIntensity = 1.3;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.15, 4.4);
  camera.lookAt(0, 0, 0);

  addLights(scene);
  const group = buildTrophyGroup(type, tier);
  scene.add(group);

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
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
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
