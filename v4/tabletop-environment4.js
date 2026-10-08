/* Board and scenery only. Nothing in this module is a combat obstacle. */
import * as THREE from './vendor/three.module.min.js';
import { visualRandom } from './tabletop-materials4.js';

export const LOOKS = [null,
  { name: '숲의 원목 보드', paper: '#e6ddc9', alternate: '#ddd1bc', wood: '#eed4ac', rock: '#c8c2a1', grass: '#607645', felt: '#384b3d', table: '#968677', sky: '#484039', light: '#fff0d6', fill: '#d1e0d0', exposure: 1.08 },
  { name: '폐허의 석판 보드', paper: '#cec9bc', alternate: '#bab8ad', wood: '#bdb2a2', rock: '#a6a9a0', grass: '#647257', felt: '#3d4746', table: '#6f6961', sky: '#383b38', light: '#f4efe5', fill: '#c7d6de', exposure: 1.05 },
  { name: '황야의 사암 보드', paper: '#e8cda9', alternate: '#d4b897', wood: '#e7c09a', rock: '#d5a477', grass: '#ba9c57', felt: '#5c4737', table: '#8e6f55', sky: '#463a2e', light: '#ffdfab', fill: '#d9e0e3', exposure: 1.08 },
  { name: '설원의 보드', paper: '#e8eeec', alternate: '#cfdde0', wood: '#c9c9bf', rock: '#b4c4c7', grass: '#526853', felt: '#3d515a', table: '#777f7d', sky: '#3d464b', light: '#f2f5ed', fill: '#aacde4', exposure: 1.06 },
  { name: '밤의 유적 보드', paper: '#dad4cb', alternate: '#c4bdbe', wood: '#a59a8a', rock: '#a49ba7', grass: '#5d5e56', felt: '#30343b', table: '#62554e', sky: '#242b34', light: '#ffe3bb', fill: '#92b4d5', exposure: 1.14 },
];

// A beveled prism in the board's X/Z plane; stable shared UVs for PBR maps.
function prism(points, height, bevel = .015) {
  const shape = new THREE.Shape(); points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z)); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.001, height - bevel * 2), bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, -height / 2 + bevel, 0);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getY(i)) > .65) uv.setXY(i, p.getX(i) / 2, -p.getZ(i) / 2);
    else if (Math.abs(n.getX(i)) > .65) uv.setXY(i, p.getZ(i) / 2, p.getY(i) * 2);
    else uv.setXY(i, p.getX(i) / 2, p.getY(i) * 2);
  }
  return g;
}
const blockGeometry = (w, h, d, bevel = .015) => prism([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], h, bevel);

export function createEnvironment(config, materials, low = false) {
  const { W, H, CS, ML, M, grid } = config, root = new THREE.Group(), geometries = new Map(), allMaterials = new Set();
  let localTextures = [], decorative = [], theme = 0;
  const own = m => { allMaterials.add(m); return m; };
  const geo = (name, make) => { if (!geometries.has(name)) geometries.set(name, make()); return geometries.get(name); };
  const xy = (x, y) => new THREE.Vector3((x - W / 2) / CS, 0, (y - H / 2) / CS);
  function add(g, m, x, y, z, scale) {
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); if (scale) mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  function box(w, h, d, m, x, y, z, bevel = .012) {
    return add(geo(`box:${w}:${h}:${d}:${bevel}`, () => blockGeometry(w, h, d, bevel)), m, x, y, z);
  }
  function batches(g, m, transforms, shadows = true) {
    if (!transforms.length) return;
    const mesh = new THREE.InstancedMesh(g, m, transforms.length), dummy = new THREE.Object3D();
    transforms.forEach((t, i) => { dummy.position.set(...t.position); dummy.scale.set(...(t.scale || [1, 1, 1])); dummy.rotation.set(...(t.rotation || [0, 0, 0])); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.castShadow = shadows && !low; mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  function clear() {
    root.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    root.clear(); allMaterials.forEach(m => m.dispose()); allMaterials.clear();
    localTextures.forEach(t => t.dispose()); localTextures = []; decorative = [];
    // Geometry is shared across all five themes; keep it until renderer disposal.
  }
  function build(act) {
    clear(); theme = act; const L = LOOKS[act] || LOOKS[1], rnd = visualRandom(6200 + act);
    const wood = own(materials.wood(L.wood, .32)), endGrain = own(materials.wood('#958878', .4));
    const table = own(materials.wood(L.table, .26)), fabric = own(materials.fabric(L.felt));
    const stone = own(materials.stone(L.rock, .6));
    const leaf = own(new THREE.MeshStandardMaterial({ color: L.grass, roughness: .95 }));
    const snow = own(new THREE.MeshStandardMaterial({ color: '#e9f1ed', roughness: .88 }));
    const brass = own(new THREE.MeshStandardMaterial({ color: '#bfa26a', metalness: .65, roughness: .42 }));
    const dark = own(new THREE.MeshStandardMaterial({ color: '#302d25', roughness: .9 }));
    const BW = 5, BH = 6, center = xy(ML + CS * 2.5, M + CS * 3), width = W / CS;
    // Actual desk planks, felt beneath the board, and a layered physical underside.
    const deskRows = [];
    for (let i = -3; i <= 3; i++) deskRows.push({ position: [0, -.75, i * 1.85], scale: [1, 1, 1] });
    batches(geo('desk', () => blockGeometry(16, .18, 1.84, .02)), table, deskRows, false);
    box(width + .16, .04, H / CS + .1, fabric, 0, -.52, 0, .015);
    box(width - .07, .29, H / CS - .07, endGrain, 0, -.33, 0, .025);
    box(width - .1, .018, H / CS - .1, wood, 0, -.173, 0, .003);
    box(BW + .09, .08, BH + .09, dark, center.x, -.08, center.z, .01);
    // Mitered frame joints; the left flank remains the existing synergy rail space.
    const outer = .22, left = center.x - BW / 2 - outer, right = center.x + BW / 2 + outer;
    const back = center.z - BH / 2 - outer, front = center.z + BH / 2 + outer;
    const plankPoints = [[left, back], [right, back], [right - outer, back + outer], [left + outer, back + outer]];
    const backRail = geo('miter-back', () => prism(plankPoints, .2, .02)); add(backRail, wood, 0, -.045, 0);
    const frontRail = geo('miter-front', () => prism(plankPoints.map(([x, z]) => [x, -z]), .2, .02)); add(frontRail, wood, 0, -.045, 0);
    box(.19, .16, BH, wood, right - .11, -.055, center.z, .012);
    box(.19, .16, BH, wood, left + .11, -.055, center.z, .012);
    const railX = xy(ML / 2 - 2, 0).x;
    box((ML - 17) / CS, .04, 6.03, fabric, railX, -.1, center.z, .01);
    // Instanced tiles share one bevel geometry and two materials (60 old faces → two batches).
    const tileGeometry = geo('tile', () => blockGeometry(.966, .065, .966, .012));
    const tilings = [[], []];
    for (const c of grid.cells) { const p = xy(c.x, c.y); tilings[(c.c + c.r) % 2].push({ position: [p.x, -.033, p.z], rotation: [0, ((c.c * 3 + c.r) % 4) * Math.PI / 2, 0] }); }
    const tone = act === 2 ? .32 : act === 3 ? .18 : act === 4 ? .10 : .20;
    batches(tileGeometry, own(materials.tile(act, L.paper, tone)), tilings[0]);
    batches(tileGeometry, own(materials.tile(act, L.alternate, tone)), tilings[1]);
    const nails = [];
    for (const y of [M - 9, H - M + 9]) for (const x of [ML - 10, W - 9]) { const p = xy(x, y); nails.push({ position: [p.x, .074, p.z] }); }
    batches(geo('nail', () => new THREE.CylinderGeometry(.027, .027, .02, 12)), brass, nails);
    const labelScale = low ? 1 : 1.5;
    const label = document.createElement('canvas'); label.width = W * labelScale; label.height = H * labelScale;
    const c = label.getContext('2d'); c.scale(labelScale, labelScale); c.fillStyle = '#d6bf93'; c.font = 'bold 8px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) { c.fillText('ABCDE'[i], ML + i * CS + 32, M - 10); c.fillText('ABCDE'[i], ML + i * CS + 32, H - M + 10); }
    for (let i = 0; i < 6; i++) c.fillText(6 - i, W - 9, M + i * CS + 32);
    const t = new THREE.CanvasTexture(label); t.colorSpace = THREE.SRGBColorSpace; localTextures.push(t);
    const print = add(geo('labels', () => new THREE.PlaneGeometry(W / CS, H / CS)), own(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })), 0, .077, 0);
    print.rotation.x = -Math.PI / 2;
    // Every scenery footprint is outside the 30 playable squares.
    const spots = [[ML + CS * .4, M - CS * .17, 'back'], [ML + CS * 2.3, M - CS * .17, 'back'],
      [ML + CS * 4.5, M - CS * .17, 'back'], [ML + CS * 5.17, M + CS * 1.4, 'right'],
      [ML + CS * 5.17, M + CS * 4.7, 'right'], [ML + CS * .5, H - M + CS * .17, 'front']];
    const rocks = [], grass = [], moss = [], needles = [], rubble = [], sand = [], ice = [];
    const rockGeo = geo('rock', () => new THREE.IcosahedronGeometry(1, 1));
    const bladeGeo = geo('blade', () => new THREE.ConeGeometry(1, 1, 5));
    const stoneBlock = geo('rubble', () => blockGeometry(.13, .09, .13, .009));
    const amber = own(new THREE.MeshStandardMaterial({ color: '#d6a451', roughness: .5, metalness: .3, emissive: '#ffad32', emissiveIntensity: 1.1 }));
    const crystal = own(new THREE.MeshStandardMaterial({ color: '#b3d3df', metalness: .12, roughness: .26 }));
    for (let j = 0; j < spots.length; j++) {
      const [x, y, side] = spots[j], p = xy(x, y), radius = .16;
      decorative.push({ x, y, radius: radius * CS, kind: ['forest', 'ruins', 'sandstone', 'snow', 'night'][act - 1] });
      const along = () => (rnd() - .5) * .14;
      const jitter = () => side === 'right' ? [0, along()] : [along(), 0];
      for (let i = 0; i < (low ? 2 : 4); i++) {
        const [dx, dz] = jitter(), r = .045 + rnd() * .037;
        rocks.push({ position: [p.x + dx, .07, p.z + dz], scale: [r, r * .55, r], rotation: [rnd(), rnd(), rnd()] });
      }
      if (act === 1 || act === 2) {
        for (let i = 0; i < (low ? 3 : 8); i++) { const [dx, dz] = jitter(); grass.push({ position: [p.x + dx, .095, p.z + dz], scale: [.012, .085 + rnd() * .07, .012], rotation: [0, rnd() * 5, (rnd() - .5) * .8] }); }
        for (let i = 0; i < 3; i++) { const [dx, dz] = jitter(); moss.push({ position: [p.x + dx, .05, p.z + dz], scale: [.035, .012, .027] }); }
      }
      if (act === 1 && side === 'back' && j !== 1) {
        box(.037, .19, .037, endGrain, p.x, .13, p.z, .005);
        for (let i = 0; i < 3; i++) needles.push({ position: [p.x, .18 + i * .068, p.z], scale: [.095 - i * .018, .16, .095 - i * .018] });
      }
      if (act === 2 || act === 5) {
        const tall = side === 'back'; const count = tall ? 4 : 1;
        for (let i = 0; i < count; i++) rubble.push({ position: [p.x, .08 + i * .08, p.z], rotation: [0, (i % 2) * .07, 0] });
        if (tall) box(.15, .055, .15, stone, p.x, .4, p.z, .008);
      }
      if (act === 3) {
        for (let i = 0; i < 6; i++) { const [dx, dz] = jitter(); sand.push({ position: [p.x + dx, .04, p.z + dz], scale: [.025, .005, .027] }); }
        for (let i = 0; i < 4; i++) { const [dx, dz] = jitter(); grass.push({ position: [p.x + dx, .09, p.z + dz], scale: [.009, .1, .009], rotation: [0, rnd() * 3, (rnd() - .5) * .9] }); }
        if (side === 'back') { const m = add(rockGeo, stone, p.x, .13, p.z, [.11, .17, .08]); m.rotation.y = rnd() * 3; }
      }
      if (act === 4) {
        sand.push({ position: [p.x, .058, p.z], scale: [.11, .033, .095] });
        if (side === 'back') {
          box(.033, .14, .033, endGrain, p.x, .11, p.z, .005);
          for (let i = 0; i < 3; i++) { needles.push({ position: [p.x, .16 + i * .055, p.z], scale: [.09 - i * .02, .12, .09 - i * .02] }); sand.push({ position: [p.x, .2 + i * .052, p.z], scale: [.081 - i * .018, .022, .081 - i * .018] }); }
        }
        else ice.push({ position: [p.x, .13, p.z], scale: [.04, .16, .035], rotation: [0, .3, .17] });
      }
      if (act === 5 && side === 'back' && j !== 1) {
        box(.07, .09, .07, dark, p.x + .035, .095, p.z, .008);
        const flame = add(geo('flame', () => new THREE.SphereGeometry(1, 8, 6)), amber, p.x + .035, .17, p.z, [.026, .055, .026]); flame.castShadow = false;
        if (!low) { const lamp = new THREE.PointLight('#ffbd64', .12, 1, 2); lamp.position.set(p.x + .035, .2, p.z); root.add(lamp); }
      }
    }
    batches(rockGeo, stone, rocks);
    batches(bladeGeo, leaf, grass, false); batches(rockGeo, leaf, moss, false);
    batches(bladeGeo, leaf, needles); batches(stoneBlock, stone, rubble);
    batches(rockGeo, act === 4 ? snow : stone, sand, false); batches(bladeGeo, crystal, ice);
    return L;
  }
  return { root, build, diagnostics: () => ({ theme, decorations: decorative,
    sharedGeometries: geometries.size, localTextures: localTextures.length,
    textureMiB: localTextures.reduce((sum, t) => sum + t.image.width * t.image.height * 4 * 4 / 3 / 1048576, 0) }),
    dispose() { clear(); geometries.forEach(g => g.dispose()); geometries.clear(); } };
}
