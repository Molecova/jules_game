/* A small, local photographic studio. No HDRI download or game-state access. */
import * as THREE from './vendor/three.module.min.js';

export function createStudio(renderer, scene, low = false) {
  // Photograph-style softboxes become real reflections in the metal edges.
  // Capture at 128px (64px on low), then prefilter once for rough surfaces.
  const room = new THREE.Scene(), owned = [];
  function panel(w, h, position, radiance) {
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...radiance), side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.lookAt(0, 0, 0);
    room.add(mesh); owned.push(geometry, material);
  }
  room.background = new THREE.Color().setRGB(.12, .14, .16);
  panel(10, 10, [0, -5, 0], [.10, .085, .07]);
  panel(12, 12, [0, 0, -8], [.32, .33, .34]);
  panel(7, 5, [-4, 6, -3], [5.5, 5.15, 4.65]);
  panel(2, 7, [5, 3, 2], [2.4, 2.6, 2.9]);
  const capture = new THREE.WebGLCubeRenderTarget(low ? 64 : 128, { type: THREE.HalfFloatType });
  const camera = new THREE.CubeCamera(.1, 30, capture);
  const shadowEnabled = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  camera.update(renderer, room); renderer.shadowMap.enabled = shadowEnabled;
  const generator = new THREE.PMREMGenerator(renderer), reflection = generator.fromCubemap(capture.texture);
  generator.dispose(); capture.dispose(); owned.forEach(o => o.dispose());
  scene.environment = reflection.texture;
  const hemisphere = new THREE.HemisphereLight('#f4f2ec', '#55514a', .35);
  const key = new THREE.DirectionalLight('#fff6e9', 2.1); key.position.set(-3.5, 7, -4.5);
  key.castShadow = true; key.shadow.mapSize.set(low ? 512 : 1024, low ? 512 : 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -5;
  key.shadow.camera.right = key.shadow.camera.top = 5;
  key.shadow.camera.near = .1; key.shadow.camera.far = 22;
  key.shadow.normalBias = .008; key.shadow.bias = -.0001; key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#dee5ee', .25); fill.position.set(4, 4, 4);
  scene.add(hemisphere, key, fill);
  return { key, fill, hemisphere,
    theme(look) { key.color.set(look.light); fill.color.set(look.fill); },
    stats: () => ({ reflectionMiB: reflection.width * reflection.height * 8 / 1048576,
      shadowMiB: key.shadow.mapSize.x * key.shadow.mapSize.y * 8 / 1048576,
      reflectionSize: low ? 64 : 128, source: 'local softbox studio' }),
    dispose() { scene.environment = null; reflection.dispose(); key.shadow.dispose(); scene.remove(key, fill, hemisphere); }
  };
}
