/* Physical coin tokens. Visual state only: never writes to combat entities or RNG. */
import * as THREE from './vendor/three.module.min.js';
import { visualRandom } from './tabletop-materials4.js';

const THICKNESS = .045, DROP_TIME = .26, DEATH_TIME = .56;
const clamp = n => Math.max(0, Math.min(1, n));
const pulse = (time, event, duration) => event ? Math.sin(Math.PI * clamp((time - event.at) / duration)) : 0;
const bytesMiB = t => t.image.width * t.image.height * 4 * (t.generateMipmaps ? 4 / 3 : 1) / 1048576;
const uid = e => e ? `${e.side}:${e.uidRef ?? 'entity-' + e.id}` : null;
const direction = (a, b) => {
  const x = (b?.px ?? a.px) - a.px, z = (b?.py ?? a.py + 1) - a.py, length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
};

export function createCoins(scene, config, invalidateShadow = () => {}) {
  const { W, H, CS, sprite } = config, entries = new Map(), portraits = new Map(), used = new Set(), effects = new Map(), deaths = new Map();
  const reducedPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const bodyGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0, -.5), new THREE.Vector2(.96, -.5), new THREE.Vector2(1, -.28),
    new THREE.Vector2(1, .28), new THREE.Vector2(.96, .5), new THREE.Vector2(0, .5),
  ], 48);
  const faceGeometry = new THREE.CircleGeometry(1, 48);
  const edgeCanvas = document.createElement('canvas'); edgeCanvas.width = 256; edgeCanvas.height = 32;
  const edgeContext = edgeCanvas.getContext('2d'); edgeContext.fillStyle = '#999999'; edgeContext.fillRect(0, 0, 256, 32);
  for (let x = 0; x < 256; x += 4) { edgeContext.fillStyle = '#dddddd'; edgeContext.fillRect(x, 2, 1, 28); edgeContext.fillStyle = '#555555'; edgeContext.fillRect(x + 1, 2, 1, 28); }
  const edgeTexture = new THREE.CanvasTexture(edgeCanvas);
  const sides = ['#a9afb4', '#c4c8cb', '#c4a66b'].map(color => new THREE.MeshStandardMaterial({ color, metalness: .94, roughness: .29, envMapIntensity: .8, bumpMap: edgeTexture, bumpScale: .0008 }));
  const grainCanvas = document.createElement('canvas'); grainCanvas.width = grainCanvas.height = 128;
  const gc = grainCanvas.getContext('2d'), random = visualRandom(273);
  gc.fillStyle = '#bcbcbc'; gc.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 6500; i++) { gc.fillStyle = i % 2 ? '#c5c5c5' : '#b5b5b5'; gc.fillRect(random()*128, random()*128, 1, 1); }
  const printGrain = new THREE.CanvasTexture(grainCanvas);
  // One instanced contact-shadow pass grounds all coins, even on low quality.
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const sc = shadowCanvas.getContext('2d'), gradient = sc.createRadialGradient(32,32,23,32,32,32);
  gradient.addColorStop(0,'rgba(33,27,20,.40)'); gradient.addColorStop(.55,'rgba(33,27,20,.17)'); gradient.addColorStop(1,'rgba(33,27,20,0)');
  sc.fillStyle=gradient;sc.fillRect(0,0,64,64);
  const contactTexture=new THREE.CanvasTexture(shadowCanvas),contactGeometry=new THREE.PlaneGeometry(2,2);
  const contactMaterial=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false});
  const contact=new THREE.InstancedMesh(contactGeometry,contactMaterial,64),shadowPose=new THREE.Object3D();
  contact.frustumCulled=false;contact.renderOrder=1;contact.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(contact);
  let frame = 0, time = 0, previous = performance.now(), context, reduced = reducedPreference.matches, phase = 'prep';
  const counts = { placed: 0, moved: 0, melee: 0, ranged: 0, magic: 0, cast: 0, hit: 0, death: 0 };
  const xy = (x, y) => new THREE.Vector3((x - W / 2) / CS, 0, (y - H / 2) / CS);

  function release(entry) {
    scene.remove(entry.group); entry.face.material.dispose();
    if (entry.ghostMaterial) entry.ghostMaterial.dispose();
    entries.delete(entry.id); effects.delete(entry.id); invalidateShadow();
  }
  function begin(state = {}) {
    const now = performance.now(), dt = Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now;
    reduced = state.reducedMotion ?? reducedPreference.matches; phase = state.phase || 'prep';
    if (!state.paused) time += dt * (state.speed || 1);
    if (context !== state.context) {
      for (const e of [...entries.values()]) { if (e.dying) release(e); else { e.attack = e.hit = e.cast = null; e.lastCasts = null; } }
      effects.clear(); deaths.clear(); context = state.context;
    }
    frame++; used.clear();
  }
  function portrait(o, radius) {
    const key = [o.artId, o.side, o.kind || '', o.star || 1].join(':'); used.add(key);
    if (!portraits.has(key)) {
      const original = sprite(o.artId, o.side, o.kind), canvas = document.createElement('canvas');
      canvas.width = original.width; canvas.height = original.height;
      const c = canvas.getContext('2d'); c.drawImage(original, 0, 0);
      // Flat rank marks retain a clean coin silhouette; no raised star pins.
      if (o.star > 1) {
        const s = canvas.width; c.fillStyle = '#232a3b'; c.beginPath(); c.roundRect(s * .36, s * .84, s * .28, s * .065, s * .025); c.fill();
        c.fillStyle = '#f5cf74';
        for (let i = 0; i < o.star; i++) {
          const x = s * (.5 + (i - (o.star - 1) / 2) * .075), y = s * .873, r = s * .026;
          c.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fill();
        }
      }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2;
      portraits.set(key, texture);
    }
    return { key, texture: portraits.get(key) };
  }
  function token(x, y, o, radius) {
    const asset = portrait(o, radius);
    let id = o.tokenId != null ? `${o.side}:${o.tokenId}` : uid(o.entity);
    if (!id) { let n = 0; while (entries.get(asset.key + ':' + n)?.seen === frame) n++; id = asset.key + ':' + n; }
    let e = entries.get(id);
    if (e && e.asset !== asset.key) { release(e); e = null; }
    const target = xy(x, y);
    if (!e) {
      const group = new THREE.Group(), body = new THREE.Mesh(bodyGeometry, sides[Math.min(2, Math.max(0, (o.star || 1) - 1))]);
      body.scale.set(radius / CS, THICKNESS, radius / CS); body.castShadow = body.receiveShadow = true; group.add(body);
      const face = new THREE.Mesh(faceGeometry, new THREE.MeshStandardMaterial({ map: asset.texture, transparent: true, roughness: .90, metalness: 0,
        bumpMap: printGrain, bumpScale: .00035, envMapIntensity: .3 }));
      face.rotation.x = -Math.PI / 2; face.position.y = THICKNESS / 2 + .001; face.scale.setScalar(radius / CS * .966); face.receiveShadow = true; group.add(face);
      scene.add(group); e = { id, asset: asset.key, group, body, face, radius: radius / CS, born: time, target, origin: target.clone(), seen: frame, o, lastCasts: null };
      entries.set(id, e); counts.placed++; invalidateShadow();
    }
    if (e.dying && !o.entity?.dead) {
      e.body.material = sides[Math.min(2, Math.max(0, (o.star || 1) - 1))]; e.ghostMaterial?.dispose(); e.ghostMaterial = null; e.face.material.opacity = 1; e.dying = null; e.born = time;
    }
    if (!o.entity && e.target.distanceToSquared(target) > .00001) { e.origin.copy(e.group.position); e.target.copy(target); e.moveAt = time; counts.moved++; }
    else e.target.copy(target);
    if (o.entity?.moving && !e.wasMoving) counts.moved++;
    e.wasMoving = !!o.entity?.moving; e.seen = frame; e.o = o;
    const events = effects.get(id); if (events) { Object.assign(e, events); effects.delete(id); }
    const casts = Object.values(o.entity?.castCount || {}).reduce((n, v) => n + v, 0);
    if (e.lastCasts != null && casts > e.lastCasts) { e.cast = { at: time }; counts.cast++; }
    e.lastCasts = casts;
  }
  function event(entity, name, data) {
    const id = uid(entity); if (!id) return;
    const payload = { [name]: { at: time, ...data } }, e = entries.get(id);
    if (e) Object.assign(e, payload); else effects.set(id, { ...(effects.get(id) || {}), ...payload });
  }
  function attack(entity, target) {
    const kind = entity.cls === 'mag' ? 'magic' : entity.range > 1 ? 'ranged' : 'melee';
    counts[kind]++; event(entity, 'attack', { kind, dir: direction(entity, target) });
  }
  function hit(entity, source) { counts.hit++; event(entity, 'hit', { dir: direction(source || { px: entity.px, py: entity.py - 1 }, entity) }); }
  function death(entity, source) { deaths.set(uid(entity), { entity, dir: direction(source || { px: entity.px, py: entity.py - 1 }, entity), at: time }); }

  function update() {
    for (const [id, d] of deaths) {
      deaths.delete(id);
      // The death hook can immediately revive an entity; do not animate that as a corpse.
      if (!d.entity.dead) continue;
      let e = entries.get(id);
      if (!e) {
        const u = d.entity, kind = u.boss ? 'boss' : u.elite ? 'elite' : '';
        token(u.px, u.py, { artId: u.artId, side: u.side, kind, star: u.card?.star || 1, entity: u }, kind === 'boss' ? 31 : kind === 'elite' ? 27 : 23); e = entries.get(id);
      }
      if (reduced) { release(e); continue; }
      e.dying = d; e.deathOrigin = e.target.clone(); e.ghostMaterial = e.body.material.clone(); e.ghostMaterial.transparent = true; e.body.material = e.ghostMaterial; counts.death++;
    }
    for (const e of [...entries.values()]) {
      if (e.seen !== frame && !e.dying) { release(e); continue; }
      used.add(e.asset);
      const oldPosition = e.group.position.clone(), oldRotation = e.group.rotation.clone();
      let p = e.target.clone(), lift = (e.o.lift || 0) / CS, rx = 0, rz = 0, yaw = -(e.o.rot || 0);
      if (!reduced) {
        const birth = clamp((time - e.born) / DROP_TIME);
        lift += .16 * (1 - birth) ** 2; rx += .10 * Math.sin(birth * Math.PI * 2) * (1 - birth);
        if (e.moveAt != null && !e.o.entity) {
          const k = clamp((time - e.moveAt) / .22), smooth = k * k * (3 - 2 * k);
          p.lerpVectors(e.origin, e.target, smooth); lift += .075 * Math.sin(k * Math.PI); rz += .09 * Math.sin(k * Math.PI);
        }
        const moving = e.o.entity?.moving;
        if (moving) { const h = Math.sin(Math.PI * clamp(moving.t)), a = Math.atan2(moving.ty - moving.fy, moving.tx - moving.fx); rx += Math.sin(a) * .1 * h; rz -= Math.cos(a) * .1 * h; }
        const a = pulse(time, e.attack, .28), d = e.attack?.dir;
        if (d && a) {
          const forward = e.attack.kind === 'melee' ? .055 : -.035, lean = e.attack.kind === 'melee' ? .23 : -.14;
          p.x += d.x * a * forward; p.z += d.z * a * forward; rx += d.z * a * lean; rz -= d.x * a * lean;
          lift += a * (e.attack.kind === 'magic' ? .035 : .008); if (e.attack.kind === 'magic') yaw += .13 * a;
        }
        const h = pulse(time, e.hit, .22), hd = e.hit?.dir;
        if (hd && h) { const wobble = Math.sin((time - e.hit.at) * 48) * h; rx += hd.z * wobble * .1; rz -= hd.x * wobble * .1; p.x += hd.x * h * .018; p.z += hd.z * h * .018; }
        const casting = pulse(time, e.cast, .42); lift += casting * .055; yaw += casting * .14;
        if (!e.o.entity && e.o.lift) { rx += .085; rz -= .045; }
        if (e.o.popT > 0) lift += .11 * Math.sin(Math.PI * clamp(1 - e.o.popT / .35));
      } else { lift = 0; yaw = -(e.o.entity?.rot || e.o.rot || 0); }
      if (e.dying) {
        const k = clamp((time - e.dying.at) / DEATH_TIME);
        if (k >= 1) { release(e); continue; }
        const d = e.dying.dir, fall = 1.18 * Math.sin(k * Math.PI / 2);
        p.copy(e.deathOrigin); p.x += d.x * .16 * k; p.z += d.z * .16 * k; rx = d.z * fall; rz = -d.x * fall; yaw += .5 * k; lift = 0;
        const alpha = 1 - clamp((k - .35) / .65); e.face.material.opacity = alpha; e.ghostMaterial.opacity = alpha;
      }
      // A tilted coin rests on its edge instead of sinking through the tile.
      const tilt = Math.hypot(rx, rz);
      p.y = .003 + THICKNESS / 2 * Math.abs(Math.cos(tilt)) + e.radius * Math.abs(Math.sin(tilt)) + lift;
      e.group.position.copy(p); e.group.rotation.set(rx, yaw, rz, 'YXZ');
      e.face.material.emissive.set('#ffffff'); e.face.material.emissiveIntensity = reduced ? 0 : Math.min(.5, (e.o.flash || 0) / .12 * .5);
      if (oldPosition.distanceToSquared(p) > 1e-8 || oldRotation.x !== rx || oldRotation.y !== yaw || oldRotation.z !== rz) invalidateShadow();
    }
    let shadowCount=0;
    for(const e of entries.values()) {
      if(shadowCount===64)break;
      const height=e.group.position.y-THICKNESS/2,visible=height<.13&&e.face.material.opacity>.3;
      shadowPose.position.set(e.group.position.x,.0015,e.group.position.z);
      shadowPose.rotation.set(-Math.PI/2,0,0);shadowPose.scale.setScalar(visible?e.radius*1.10:0);shadowPose.updateMatrix();
      contact.setMatrixAt(shadowCount++,shadowPose.matrix);
    }
    contact.count=shadowCount;contact.instanceMatrix.needsUpdate=true;
    // Leave visible and departing faces intact; bound only the unused GPU cache.
    let cached = [...portraits.values()].reduce((n, t) => n + bytesMiB(t), 0);
    for (const [key, t] of portraits) { if (cached <= 1.5) break; if (!used.has(key)) { cached -= bytesMiB(t); t.dispose(); portraits.delete(key); } }
  }
  return { begin, token, attack, hit, death, update,
    stats: () => ({ tokens: entries.size, portraitTextures: portraits.size, portraitMiB: [...portraits.values()].reduce((n, t) => n + bytesMiB(t), 0), extraTextureMiB: bytesMiB(edgeTexture)+bytesMiB(printGrain)+bytesMiB(contactTexture),
      coins: { thickness: THICKNESS, thicknessPx: THICKNESS * CS, raisedPins: 0, reducedMotion: reduced, time, phase, ghosts: [...entries.values()].filter(e => e.dying).length, events: { ...counts } } }),
    inspect: () => [...entries.values()].map(e => ({ id: e.id, artId: e.o.artId, side: e.o.side, star: e.o.star || 1, dying: !!e.dying, diameter: e.radius * 2, thickness: THICKNESS,
      position: e.group.position.toArray(), rotation: [e.group.rotation.x, e.group.rotation.y, e.group.rotation.z], opacity: e.face.material.opacity, meshes: e.group.children.length })),
    dispose() { [...entries.values()].forEach(release); portraits.forEach(t => t.dispose()); portraits.clear(); sides.forEach(m => m.dispose()); edgeTexture.dispose(); printGrain.dispose(); contactTexture.dispose(); contactGeometry.dispose(); contactMaterial.dispose(); contact.dispose(); scene.remove(contact); bodyGeometry.dispose(); faceGeometry.dispose(); effects.clear(); deaths.clear(); },
  };
}
