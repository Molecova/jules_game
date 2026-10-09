/* Local CC0 PBR maps. The bundle owns textures for the renderer's lifetime. */
import * as THREE from './vendor/three.module.min.js';

export const visualRandom = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
export async function createMaterials(low = false) {
  const textures = new Set(), loader = new THREE.TextureLoader();
  let fallback = false;
  const own = texture => { textures.add(texture); return texture; };
  const canvasTexture = (canvas, color = false) => {
    const t = own(new THREE.CanvasTexture(canvas));
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = low ? 1 : 4; return t;
  };
  async function map(asset, channel) {
    let original;
    try { original = await loader.loadAsync(new URL(`./assets/tabletop/${asset}-${channel}.jpg`, import.meta.url).href); }
    catch (_) { fallback = true; }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = channel === 'color' ? (low ? 512 : 768) : (low ? 256 : 512);
    const c = canvas.getContext('2d');
    if (original) { c.drawImage(original.image, 0, 0, canvas.width, canvas.height); original.dispose(); }
    else { c.fillStyle = channel === 'normal-dx' ? '#8080ff' : channel === 'roughness' ? '#cccccc' : asset === 'Wood062' ? '#927459' : '#77746b'; c.fillRect(0, 0, canvas.width, canvas.height); }
    return canvasTexture(canvas, channel === 'color');
  }
  const [color, normal, roughness] = await Promise.all(['color', 'normal-dx', 'roughness'].map(ch => map('Wood062', ch)));
  const woodMaps = { color, normal, roughness };
  function wood(color = '#ffffff', depth = .45) {
    return new THREE.MeshStandardMaterial({ color, map: woodMaps.color, normalMap: woodMaps.normal,
      normalScale: new THREE.Vector2(depth, -depth), roughnessMap: woodMaps.roughness, roughness: .62, metalness: 0 });
  }
  // One continuous printed sheet, with a fine paper weave instead of stone slabs.
  const sheet = document.createElement('canvas'); sheet.width = low ? 400 : 800; sheet.height = low ? 480 : 960;
  const p = sheet.getContext('2d'), sx = sheet.width / 5, sy = sheet.height / 6, grain = visualRandom(791);
  p.fillStyle = '#eee9dc'; p.fillRect(0, 0, sheet.width, sheet.height);
  for (let i = 0; i < 26000; i++) {
    p.fillStyle = i % 2 ? 'rgba(106,93,68,.035)' : 'rgba(255,255,255,.16)';
    p.fillRect(grain() * sheet.width, grain() * sheet.height, .5 + grain(), .4 + grain());
  }
  for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) {
    const x = col * sx, y = row * sy;
    p.fillStyle = row < 3 ? 'rgba(107,97,79,.035)' : 'rgba(62,90,73,.055)';
    p.fillRect(x, y, sx, sy);
    // Print registration corners and a discreet point at each square's centre.
    p.strokeStyle = 'rgba(70,67,53,.28)'; p.lineWidth = sheet.width / 900;
    for (const [dx, dy, ax, ay] of [[.05,.05,1,1],[.95,.05,-1,1],[.05,.95,1,-1],[.95,.95,-1,-1]]) {
      p.beginPath(); p.moveTo(x+sx*(dx+ax*.065),y+sy*dy); p.lineTo(x+sx*dx,y+sy*dy); p.lineTo(x+sx*dx,y+sy*(dy+ay*.065)); p.stroke();
    }
    p.fillStyle = 'rgba(70,67,53,.20)'; p.beginPath(); p.arc(x+sx/2,y+sy/2,sx*.005,0,Math.PI*2); p.fill();
  }
  p.strokeStyle = 'rgba(70,67,53,.46)'; p.lineWidth = sheet.width / 400;
  for (let i = 1; i < 5; i++) { p.beginPath(); p.moveTo(i*sx,0); p.lineTo(i*sx,sheet.height); p.stroke(); }
  for (let i = 1; i < 6; i++) { p.beginPath(); p.moveTo(0,i*sy); p.lineTo(sheet.width,i*sy); p.stroke(); }
  p.strokeStyle = 'rgba(61,75,59,.50)'; p.lineWidth = sheet.width / 300;
  p.beginPath(); p.moveTo(0,3*sy); p.lineTo(sheet.width,3*sy); p.stroke();
  const printedSheet = canvasTexture(sheet, true);
  const feltCanvas = document.createElement('canvas'); feltCanvas.width = feltCanvas.height = 128;
  const ctx = feltCanvas.getContext('2d'), rnd = visualRandom(390);
  ctx.fillStyle = '#d3d3d3'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2200; i++) { ctx.fillStyle = i % 2 ? '#dddddd' : '#a9a9a9'; ctx.fillRect(rnd() * 128, rnd() * 128, 1, 1); }
  const felt = canvasTexture(feltCanvas, true);
  const paperGrain = canvasTexture(feltCanvas);
  return { wood,
    paper: color => new THREE.MeshStandardMaterial({ color, map: printedSheet, bumpMap: paperGrain,
      bumpScale: .0006, roughness: .91, metalness: 0, envMapIntensity: .35 }),
    fabric: color => new THREE.MeshStandardMaterial({ color, map: felt, bumpMap: felt, bumpScale: .003, roughness: 1 }),
    track: own, get fallback() { return fallback; },
    stats: () => {
      let bytes = 0;
      for (const t of textures) bytes += (t.image?.width || 0) * (t.image?.height || 0) * 4 * (t.generateMipmaps ? 4 / 3 : 1);
      return { source: fallback ? 'local PBR + fallback' : 'ambientCG Wood062 (CC0) + original printed paper', count: textures.size, textureMiB: bytes / 1048576 };
    },
    dispose() { textures.forEach(t => t.dispose()); textures.clear(); }
  };
}
