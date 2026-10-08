/* Local CC0 PBR maps. The bundle owns textures for the renderer's lifetime. */
import * as THREE from './vendor/three.module.min.js';

export const visualRandom = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
export async function createMaterials(low = false) {
  const textures = new Set(), loader = new THREE.TextureLoader(), palette = new Map();
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
  const packs = await Promise.all(['Wood062', 'Rock030'].map(async id => {
    const [color, normal, roughness] = await Promise.all(['color', 'normal-dx', 'roughness'].map(ch => map(id, ch)));
    return { color, normal, roughness };
  }));
  const [woodMaps, stoneMaps] = packs;
  function wood(color = '#ffffff', depth = .45) {
    return new THREE.MeshStandardMaterial({ color, map: woodMaps.color, normalMap: woodMaps.normal,
      normalScale: new THREE.Vector2(depth, -depth), roughnessMap: woodMaps.roughness, roughness: .8, metalness: 0 });
  }
  function stone(color = '#ffffff', depth = .45) {
    return new THREE.MeshStandardMaterial({ color, map: stoneMaps.color, normalMap: stoneMaps.normal,
      normalScale: new THREE.Vector2(depth, -depth), roughnessMap: stoneMaps.roughness, roughness: .95 });
  }
  function tile(act, color, amount = .2) {
    if (!palette.has(act)) {
      const cv = document.createElement('canvas'); cv.width = cv.height = low ? 256 : 512;
      const c = cv.getContext('2d'); c.fillStyle = '#eee8db'; c.fillRect(0, 0, cv.width, cv.height);
      c.globalAlpha = amount; c.drawImage(stoneMaps.color.image, 0, 0, cv.width, cv.height); c.globalAlpha = 1;
      const rnd = visualRandom(1031 + act);
      for (let i = 0; i < 45; i++) {
        const x = rnd() * cv.width, y = rnd() * cv.height;
        c.fillStyle = 'rgba(90,67,39,.035)'; c.fillRect(x, y, 1 + rnd() * 2, 1);
      }
      // A carved border and small corner cuts on each individual stone slab.
      const s = cv.width; c.strokeStyle = 'rgba(72,58,42,.19)'; c.lineWidth = s / 250;
      c.strokeRect(s * .055, s * .055, s * .89, s * .89);
      c.strokeStyle = 'rgba(255,253,237,.55)'; c.strokeRect(s * .064, s * .064, s * .872, s * .872);
      c.strokeStyle = 'rgba(64,52,40,.24)';
      for (const [x, y, dx, dy] of [[.085,.085,1,1],[.915,.085,-1,1],[.085,.915,1,-1],[.915,.915,-1,-1]]) {
        c.beginPath(); c.moveTo(s*x,s*(y+dy*.06)); c.lineTo(s*x,s*y); c.lineTo(s*(x+dx*.06),s*y); c.stroke();
      }
      const light = c.createLinearGradient(0, 0, s, s); light.addColorStop(0, 'rgba(255,255,238,.16)'); light.addColorStop(1, 'rgba(45,38,29,.08)');
      c.fillStyle = light; c.fillRect(0, 0, s, s);
      palette.set(act, canvasTexture(cv, true));
    }
    return new THREE.MeshStandardMaterial({ color, map: palette.get(act), normalMap: stoneMaps.normal,
      normalScale: new THREE.Vector2(.11, -.11), roughnessMap: stoneMaps.roughness, roughness: .82 });
  }
  const feltCanvas = document.createElement('canvas'); feltCanvas.width = feltCanvas.height = 128;
  const ctx = feltCanvas.getContext('2d'), rnd = visualRandom(390);
  ctx.fillStyle = '#d3d3d3'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2200; i++) { ctx.fillStyle = i % 2 ? '#dddddd' : '#a9a9a9'; ctx.fillRect(rnd() * 128, rnd() * 128, 1, 1); }
  const felt = canvasTexture(feltCanvas, true);
  return { wood, stone, tile,
    fabric: color => new THREE.MeshStandardMaterial({ color, map: felt, bumpMap: felt, bumpScale: .003, roughness: 1 }),
    track: own, get fallback() { return fallback; },
    stats: () => {
      let bytes = 0;
      for (const t of textures) bytes += (t.image?.width || 0) * (t.image?.height || 0) * 4 * (t.generateMipmaps ? 4 / 3 : 1);
      return { source: fallback ? 'local PBR + fallback' : 'ambientCG Wood062 + Rock030 (CC0)', count: textures.size, textureMiB: bytes / 1048576 };
    },
    dispose() { textures.forEach(t => t.dispose()); textures.clear(); }
  };
}
