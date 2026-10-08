/* A direction: a real 3D board around the existing, unchanged combat engine. */
import * as THREE from './vendor/three.module.min.js';

import { createMaterials } from './tabletop-materials4.js';
import { createEnvironment, LOOKS } from './tabletop-environment4.js';
const lowQuality = new URLSearchParams(location.search).get('quality') === 'low';
const use2d = new URLSearchParams(location.search).get('view') === '2d';
const materials = use2d ? null : await createMaterials(lowQuality);

function create(source, config) {
  const { W, H, CS, ML, M, grid } = config;
  if (use2d) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (_) { document.getElementById('tabletopStatus').textContent = '2D 보드'; return null; }
  renderer.setPixelRatio(Math.min(lowQuality ? 1 : 1.5, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const dom = renderer.domElement; dom.id = 'tabletopCanvas'; dom.setAttribute('aria-hidden', 'true');
  source.before(dom); source.parentElement.classList.add('has-tabletop');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-W / CS / 2, W / CS / 2, H / CS / 2, -H / CS / 2, .1, 60);
  camera.position.set(0, 13, 9.5); camera.lookAt(0, 0, 0);
  const hemisphere = new THREE.HemisphereLight('#fff1da', '#666354', 1.5); scene.add(hemisphere);
  const light = new THREE.DirectionalLight('#fff2dd', 2.7); light.position.set(-4, 8, -4);
  light.castShadow = true; light.shadow.mapSize.set(lowQuality ? 512 : 1024, lowQuality ? 512 : 1024);
  Object.assign(light.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 22 });
  light.shadow.normalBias = .02; light.shadow.bias = -.0002; scene.add(light);
  const fill = new THREE.DirectionalLight('#d4e5ef', .6); fill.position.set(4, 4, 4); scene.add(fill);
  const xy = (x, y) => new THREE.Vector3((x - W / 2) / CS, 0, (y - H / 2) / CS);
  const environment = createEnvironment(config, materials, lowQuality); scene.add(environment.root);
  const tokens = new Map(), portraits = new Map(), usedPortraits = new Set(); let frame = 0, act = 0, draws = 0, active = true, lastDraw = 0;
  const textureMiB = t => t.image.width * t.image.height * 4 * (t.generateMipmaps ? 4 / 3 : 1) / 1048576;
  const overlayTexture = new THREE.CanvasTexture(source); overlayTexture.colorSpace = THREE.SRGBColorSpace;
  overlayTexture.minFilter = THREE.LinearFilter; overlayTexture.generateMipmaps = false;
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(W / CS, H / CS), new THREE.MeshBasicMaterial({ map: overlayTexture, transparent: true, depthWrite: false, toneMapped: false }));
  overlay.rotation.x = -Math.PI / 2; overlay.position.y = .21; overlay.renderOrder = 10; scene.add(overlay);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const bodyGeometry = new THREE.CylinderGeometry(1, 1, 1, 40), faceGeometry = new THREE.CircleGeometry(1, 48);
  const sideMaterials = [new THREE.MeshStandardMaterial({ color: '#c5b697', roughness: .88 }), new THREE.MeshStandardMaterial({ color: '#b5a188', roughness: .9 })];

  function build(next) {
    act = next;
    const L = environment.build(act);
    renderer.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(L.sky);
    light.color.set(L.light); fill.color.set(L.fill);
    hemisphere.color.set(L.light); hemisphere.groundColor.set(L.sky);
    renderer.toneMappingExposure = L.exposure;
    document.getElementById('tabletopStatus').textContent = L.name;
    document.getElementById('phone').dataset.tabletop = '3d';
  }
  function resize() {
    const w = source.clientWidth, h = source.clientHeight;
    if (!w || !h || !active) return;
    renderer.setSize(w, h); dom.style.left = source.offsetLeft + 'px'; dom.style.top = source.offsetTop + 'px';
  }
  function begin(nextAct) { if (!active) return; if (nextAct !== act) build(nextAct); frame++; usedPortraits.clear(); }
  function token(x, y, o, radius) {
    if (!active) return;
    const key = [o.artId, o.side, o.kind || '', o.star || 0].join(':');
    const assetKey = [o.artId, o.side, o.kind || ''].join(':');
    usedPortraits.add(assetKey);
    let texture = portraits.get(assetKey);
    if (!texture) {
      const image = config.sprite(o.artId, o.side, o.kind);
      texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); portraits.set(assetKey, texture);
    }
    // Multiple identical cards are legal. Reuse meshes by this frame's occurrence, never card IDs.
    let n = 0; while (tokens.get(key + ':' + n)?.seen === frame) n++;
    const id = key + ':' + n; let entry = tokens.get(id);
    if (!entry) {
      const group = new THREE.Group(), side = new THREE.Mesh(bodyGeometry, sideMaterials[o.side ? 1 : 0]);
      side.scale.set(radius / CS, .105, radius / CS); side.castShadow = side.receiveShadow = true; group.add(side);
      const face = new THREE.Mesh(faceGeometry, new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: .96, metalness: 0 }));
      face.rotation.x = -Math.PI / 2; face.position.y = .054; face.scale.setScalar((radius + 1) / CS); face.receiveShadow = true; group.add(face);
      if (o.star > 1) {
        for (let i = 0; i < o.star; i++) { const pin = new THREE.Mesh(new THREE.SphereGeometry(.023, 8, 6), new THREE.MeshStandardMaterial({ color: '#d2ae54', metalness: .5, roughness: .5 })); pin.position.set((i - (o.star - 1) / 2) * .07, .07, radius / CS * .76); group.add(pin); }
      }
      scene.add(group); entry = { group, seen: frame }; tokens.set(id, entry);
      renderer.shadowMap.needsUpdate = true;
    }
    entry.seen = frame; entry.group.visible = true;
    const p = xy(x, y), height = .065 + (o.lift || 0) / CS;
    if (entry.group.position.x !== p.x || entry.group.position.z !== p.z || entry.group.position.y !== height) renderer.shadowMap.needsUpdate = true;
    entry.group.position.set(p.x, height, p.z);
    entry.group.rotation.y = -(o.rot || 0);
  }
  function render() {
    if (!active) return;
    if (performance.now() - lastDraw < 1000 / 30) return;
    lastDraw = performance.now();
    for (const [id, entry] of tokens) if (entry.seen !== frame) {
      scene.remove(entry.group); entry.group.traverse(o => { if (o.material && !sideMaterials.includes(o.material)) o.material.dispose(); if (o.geometry && o.geometry !== bodyGeometry && o.geometry !== faceGeometry) o.geometry.dispose(); }); tokens.delete(id);
      renderer.shadowMap.needsUpdate = true;
    }
    // Visiting many enemy types must not retain every old portrait on the GPU.
    // Keep every visible face; evict only unused textures after their meshes are removed.
    let cachedMiB = [...portraits.values()].reduce((n, t) => n + textureMiB(t), 0);
    for (const [key, texture] of portraits) {
      if (cachedMiB <= 1.5) break;
      if (!usedPortraits.has(key)) { cachedMiB -= textureMiB(texture); texture.dispose(); portraits.delete(key); }
    }
    overlayTexture.needsUpdate = true; renderer.render(scene, camera); draws++;
  }
  function point(clientX, clientY) {
    const r = dom.getBoundingClientRect(); if (!r.width || !r.height || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    ndc.set((clientX - r.left) / r.width * 2 - 1, 1 - (clientY - r.top) / r.height * 2); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x * CS + W / 2, y: hit.z * CS + H / 2 };
  }
  function screen(x, y) {
    const p = xy(x, y); p.project(camera); const r = dom.getBoundingClientRect();
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  }
  dom.addEventListener('webglcontextlost', e => {
    e.preventDefault(); active = false; source.parentElement.classList.remove('has-tabletop');
    dom.hidden = true; document.getElementById('tabletopStatus').textContent = '2D 보드';
    document.getElementById('phone').dataset.tabletop = '2d';
  });
  function diagnostics() {
    const materialStats = materials.stats(), envStats = environment.diagnostics();
    // RGBA8 maps + mip levels, live canvas, and a conservative 8 B/px shadow target.
    // This is a budget estimate, not a device-driver GPU allocation measurement.
    const portraitMiB = [...portraits.values()].reduce((n, t) => n + textureMiB(t), 0);
    const textureBudgetMiB = materialStats.textureMiB + envStats.textureMiB + textureMiB(overlayTexture)
      + portraitMiB
      + light.shadow.mapSize.x * light.shadow.mapSize.y * 8 / 1048576;
    return { act, draws, tokens: tokens.size, portraitTextures: portraits.size,
      triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls,
      textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
      programs: renderer.info.programs.length, quality: lowQuality ? 'low' : 'normal', textureBudgetMiB, portraitMiB,
      materials: materialStats, environment: envStats, name: LOOKS[act]?.name };
  }
  return { begin, token, render, resize, point, screen, get active() { return active; },
    diagnostics };
}
window.TABLETOP4 = { create, LOOKS };
window.dispatchEvent(new Event('tabletopready'));
