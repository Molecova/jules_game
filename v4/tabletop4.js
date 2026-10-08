/* A direction: a real 3D board around the existing, unchanged combat engine. */
import * as THREE from './vendor/three.module.min.js';

const LOOKS = [null,
  { name: '숲의 원목 보드', paper: '#e8dec8', alternate: '#dfd2b8', rock: '#777e69', grass: '#576a36', wood: '#946139', table: '#43352b' },
  { name: '폐허의 석판 보드', paper: '#d9d4c8', alternate: '#c9c4b9', rock: '#777b78', grass: '#626b43', wood: '#685145', table: '#363b38' },
  { name: '황야의 사암 보드', paper: '#e5c4a0', alternate: '#d8b38e', rock: '#976d53', grass: '#927b47', wood: '#865037', table: '#443026' },
  { name: '설원의 보드', paper: '#e6ecec', alternate: '#d5e0e2', rock: '#9aabb0', grass: '#b7c7bd', wood: '#71665a', table: '#354149' },
  { name: '밤의 유적 보드', paper: '#cec7cf', alternate: '#bdb5c1', rock: '#69626e', grass: '#665b70', wood: '#544237', table: '#28242e' },
];
// A private visual RNG: no game random calls, IDs or persisted state.
const random = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
function surface(kind, color, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d'), rnd = random(seed);
  c.fillStyle = color; c.fillRect(0, 0, 512, 512);
  if (kind === 'wood') {
    for (let i = 0; i < 240; i++) {
      const y = rnd() * 512, phase = rnd() * 6, amplitude = 2 + rnd() * 9;
      c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= 512; x += 8) c.lineTo(x, y + Math.sin(x / 80 + phase) * amplitude);
      c.strokeStyle = i % 3 ? 'rgba(40,20,8,.11)' : 'rgba(255,228,180,.14)';
      c.lineWidth = .3 + rnd() * 1.8; c.stroke();
    }
  }
  for (let i = 0; i < 6500; i++) {
    c.fillStyle = i % 2 ? 'rgba(30,25,15,.035)' : 'rgba(255,255,245,.11)';
    c.fillRect(rnd() * 512, rnd() * 512, .5 + rnd() * 1.3, .5 + rnd());
  }
  const texture = new THREE.CanvasTexture(cv); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function create(source, config) {
  const { W, H, CS, ML, M, grid } = config;
  if (new URLSearchParams(location.search).get('view') === '2d') return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (_) { document.getElementById('tabletopStatus').textContent = '2D 보드'; return null; }
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const dom = renderer.domElement; dom.id = 'tabletopCanvas'; dom.setAttribute('aria-hidden', 'true');
  source.before(dom); source.parentElement.classList.add('has-tabletop');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-W / CS / 2, W / CS / 2, H / CS / 2, -H / CS / 2, .1, 60);
  camera.position.set(0, 12, 8); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#fff5dc', '#7f8077', 2.2));
  const light = new THREE.DirectionalLight('#fff2dd', 3.1); light.position.set(-4, 8, -4);
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 22 });
  light.shadow.normalBias = .02; light.shadow.bias = -.0002; scene.add(light);
  const fill = new THREE.DirectionalLight('#d4e5ef', .6); fill.position.set(4, 4, 4); scene.add(fill);
  const xy = (x, y) => new THREE.Vector3((x - W / 2) / CS, 0, (y - H / 2) / CS);
  const world = new THREE.Group(); scene.add(world);
  const tokens = new Map(), portraits = new Map(); let frame = 0, act = 0, draws = 0, active = true, lastDraw = 0;
  const overlayTexture = new THREE.CanvasTexture(source); overlayTexture.colorSpace = THREE.SRGBColorSpace;
  overlayTexture.minFilter = THREE.LinearFilter; overlayTexture.generateMipmaps = false;
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(W / CS, H / CS), new THREE.MeshBasicMaterial({ map: overlayTexture, transparent: true, depthWrite: false, toneMapped: false }));
  overlay.rotation.x = -Math.PI / 2; overlay.position.y = .21; overlay.renderOrder = 10; scene.add(overlay);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const bodyGeometry = new THREE.CylinderGeometry(1, 1, 1, 40), faceGeometry = new THREE.CircleGeometry(1, 48);
  const sideMaterials = [new THREE.MeshStandardMaterial({ color: '#c5b697', roughness: .88 }), new THREE.MeshStandardMaterial({ color: '#b5a188', roughness: .9 })];

  function box(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; world.add(mesh); return mesh;
  }
  function disposeWorld() {
    const materials = new Set(), textures = new Set();
    world.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { materials.add(o.material); if (o.material.map) textures.add(o.material.map); if (o.material.bumpMap) textures.add(o.material.bumpMap); } });
    materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); world.clear();
  }
  function build(next) {
    disposeWorld(); act = next; const L = LOOKS[act] || LOOKS[1], rnd = random(500 + act);
    renderer.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(L.table);
    const woodTexture = surface('wood', L.wood, act), paperTexture = surface('paper', '#ffffff', act + 10);
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture, bumpMap: woodTexture, bumpScale: .012, roughness: .74 });
    const darkWood = new THREE.MeshStandardMaterial({ map: woodTexture, color: '#8e7762', roughness: .85 });
    const paper = color => new THREE.MeshStandardMaterial({ color, map: paperTexture, bumpMap: paperTexture, bumpScale: .007, roughness: .97 });
    const tiles = [paper(L.paper), paper(L.alternate)];
    box(25, .3, 25, darkWood, 0, -.66, 0);
    box(W / CS - .06, .28, H / CS - .06, wood, 0, -.28, 0);
    const center = xy(ML + CS * 2.5, M + CS * 3);
    box(5.12, .06, 6.12, new THREE.MeshStandardMaterial({ color: '#594d3e', roughness: 1 }), center.x, -.1, center.z);
    box(5.3, .17, .23, wood, center.x, -.04, xy(0, M - 8).z);
    box(5.3, .17, .23, wood, center.x, -.04, xy(0, M + CS * 6 + 8).z);
    box(.2, .17, 6, wood, xy(ML - 8, 0).x, -.04, center.z);
    box(.2, .17, 6, wood, xy(ML + CS * 5 + 8, 0).x, -.04, center.z);
    for (const cell of grid.cells) {
      const p = xy(cell.x, cell.y);
      box(.985, .095, .985, tiles[(cell.c + cell.r) % 2], p.x, -.037, p.z);
    }
    // Coordinates are printed, not floating over the game.
    const labels = document.createElement('canvas'); labels.width = W * 2; labels.height = H * 2;
    const c = labels.getContext('2d'); c.scale(2, 2); c.fillStyle = '#ead9b4'; c.font = '600 9px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) { c.fillText('ABCDE'[i], ML + i * CS + 32, M - 10); c.fillText('ABCDE'[i], ML + i * CS + 32, H - M + 10); }
    for (let i = 0; i < 6; i++) c.fillText(6 - i, W - 8, M + i * CS + 32);
    const tex = new THREE.CanvasTexture(labels); tex.colorSpace = THREE.SRGBColorSpace;
    const printed = new THREE.Mesh(new THREE.PlaneGeometry(W / CS, H / CS), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    printed.rotation.x = -Math.PI / 2; printed.position.y = .051; world.add(printed);
    const brass = new THREE.MeshStandardMaterial({ color: '#b49961', metalness: .7, roughness: .48 });
    for (const y of [M - 9, H - M + 9]) for (const x of [ML - 8, W - 10]) {
      const p = xy(x, y), peg = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .025, 12), brass); peg.position.set(p.x, .06, p.z); world.add(peg);
    }
    // Decorative objects stay on the frame. No gameplay cells or obstacles are added.
    const stone = new THREE.MeshStandardMaterial({ color: L.rock, roughness: 1 }), foliage = new THREE.MeshStandardMaterial({ color: L.grass, roughness: .95 });
    for (const [x, y] of [[ML - 7, M + 3], [W - 11, M + 6], [W - 11, H - M - 3]]) {
      const p = xy(x, y);
      for (let i = 0; i < 4; i++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.08 + rnd() * .07, 0), stone);
        rock.position.set(p.x + (rnd() - .5) * .13, .07 + rnd() * .04, p.z + (rnd() - .5) * .35);
        rock.scale.set(1, .6, 1); rock.rotation.set(rnd(), rnd(), rnd()); rock.castShadow = true; world.add(rock);
      }
      for (let i = 0; i < 7; i++) {
        const grass = new THREE.Mesh(new THREE.ConeGeometry(.025, .15 + rnd() * .08, 4), foliage);
        grass.position.set(p.x + (rnd() - .5) * .16, .12, p.z + (rnd() - .5) * .4); grass.rotation.z = (rnd() - .5) * .7; grass.castShadow = true; world.add(grass);
      }
    }
    for (const [x, y] of [[ML - 7, M + 10], [W - 11, H - M - 13]]) {
      const p = xy(x, y);
      for (let i = 0; i < 3; i++) box(.15, .09, .16, stone, p.x, .08 + i * .092, p.z);
      box(.19, .08, .2, stone, p.x, .4, p.z);
    }
    document.getElementById('tabletopStatus').textContent = L.name;
    document.getElementById('phone').dataset.tabletop = '3d';
  }
  function resize() {
    const w = source.clientWidth, h = source.clientHeight;
    if (!w || !h || !active) return;
    renderer.setSize(w, h); dom.style.left = source.offsetLeft + 'px'; dom.style.top = source.offsetTop + 'px';
  }
  function begin(nextAct) { if (!active) return; if (nextAct !== act) build(nextAct); frame++; }
  function token(x, y, o, radius) {
    if (!active) return;
    const key = [o.artId, o.side, o.kind || '', o.star || 0].join(':');
    const assetKey = [o.artId, o.side, o.kind || ''].join(':');
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
  return { begin, token, render, resize, point, screen, get active() { return active; },
    diagnostics: () => ({ act, draws, tokens: tokens.size, portraitTextures: portraits.size, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, name: LOOKS[act]?.name }) };
}
window.TABLETOP4 = { create, LOOKS };
window.dispatchEvent(new Event('tabletopready'));
