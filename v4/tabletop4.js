/* A direction: a real 3D board around the existing, unchanged combat engine. */
import * as THREE from './vendor/three.module.min.js';

import { createMaterials } from './tabletop-materials4.js';
import { createEnvironment, LOOKS } from './tabletop-environment4.js';
import { createCoins } from './tabletop-tokens4.js';
import { createStudio } from './tabletop-lighting4.js';
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
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const dom = renderer.domElement; dom.id = 'tabletopCanvas'; dom.setAttribute('aria-hidden', 'true');
  source.before(dom); source.parentElement.classList.add('has-tabletop');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-W / CS / 2, W / CS / 2, H / CS / 2, -H / CS / 2, .1, 60);
  camera.position.set(0, 13, 9.5); camera.lookAt(0, 0, 0);
  const studio = createStudio(renderer, scene, lowQuality);
  const xy = (x, y) => new THREE.Vector3((x - W / 2) / CS, 0, (y - H / 2) / CS);
  const environment = createEnvironment(config, materials, lowQuality); scene.add(environment.root);
  let act = 0, draws = 0, active = true, lastDraw = 0;
  const coins = createCoins(scene, config, () => { renderer.shadowMap.needsUpdate = true; });
  const textureMiB = t => t.image.width * t.image.height * 4 * (t.generateMipmaps ? 4 / 3 : 1) / 1048576;
  const overlayTexture = new THREE.CanvasTexture(source); overlayTexture.colorSpace = THREE.SRGBColorSpace;
  overlayTexture.minFilter = THREE.LinearFilter; overlayTexture.generateMipmaps = false;
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(W / CS, H / CS), new THREE.MeshBasicMaterial({ map: overlayTexture, transparent: true, depthWrite: false, toneMapped: false }));
  overlay.rotation.x = -Math.PI / 2; overlay.position.y = .21; overlay.renderOrder = 10; scene.add(overlay);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

  function build(next) {
    act = next;
    const L = environment.build(act);
    renderer.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(L.sky);
    studio.theme(L);
    renderer.toneMappingExposure = L.exposure;
    document.getElementById('tabletopStatus').textContent = L.name;
    document.getElementById('phone').dataset.tabletop = '3d';
  }
  function resize() {
    const w = source.clientWidth, h = source.clientHeight;
    if (!w || !h || !active) return;
    renderer.setSize(w, h); dom.style.left = source.offsetLeft + 'px'; dom.style.top = source.offsetTop + 'px';
  }
  function begin(nextAct, motion) { if (!active) return; if (nextAct !== act) build(nextAct); coins.begin(motion); }
  function render() {
    if (!active || performance.now() - lastDraw < 1000 / 30) return;
    lastDraw = performance.now(); coins.update();
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
    const coinStats = coins.stats(), portraitMiB = coinStats.portraitMiB, studioStats = studio.stats();
    const textureBudgetMiB = materialStats.textureMiB + envStats.textureMiB + textureMiB(overlayTexture)
      + portraitMiB + coinStats.extraTextureMiB
      + studioStats.shadowMiB + studioStats.reflectionMiB;
    return { act, draws, tokens: coinStats.tokens, portraitTextures: coinStats.portraitTextures, coins: coinStats.coins,
      triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls,
      textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
      programs: renderer.info.programs.length, quality: lowQuality ? 'low' : 'normal', textureBudgetMiB, portraitMiB,
      materials: materialStats, environment: envStats, studio: studioStats, name: LOOKS[act]?.name };
  }
  return { begin, token: coins.token, attack: coins.attack, hit: coins.hit, death: coins.death, inspectTokens: coins.inspect, render, resize, point, screen, get active() { return active; },
    diagnostics };
}
window.TABLETOP4 = { create, LOOKS };
window.dispatchEvent(new Event('tabletopready'));
