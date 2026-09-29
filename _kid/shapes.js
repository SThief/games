// Small three.js helpers shared by the 3D kid games. Geometry and materials are cached and reused,
// which keeps the draw-call and memory cost low on the Intel laptop.
import * as THREE from 'three';
const MATS = {}, GEOS = {};
export const mat = c => MATS[c] || (MATS[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .7 }));
export const geo = (k, f) => GEOS[k] || (GEOS[k] = f());
export const box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat(c)); m.position.set(x, y, z); return m; };
export const cyl = (rt, rb, h, c, x = 0, y = 0, z = 0, seg = 16) => { const m = new THREE.Mesh(geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(c)); m.position.set(x, y, z); return m; };
export const sph = (r, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, 18, 14)), mat(c)); m.position.set(x, y, z); return m; };
export const cone = (r, h, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo(`n${r},${h}`, () => new THREE.ConeGeometry(r, h, 14)), mat(c)); m.position.set(x, y, z); return m; };
export const capsule = (r, l, c) => new THREE.Mesh(geo(`k${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 12)), mat(c));
export const torus = (r, t, c, arc = Math.PI * 2) => new THREE.Mesh(geo(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc)), mat(c));

// Compile every material once at load, including the ones on hidden things (toys, sparks, rings).
// Otherwise the first time each appears the game stalls for a moment while the graphics chip builds its shader.
export function prewarm(renderer, scene, camera) {
  const hidden = []; scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  renderer.compile(scene, camera);
  hidden.forEach(o => { o.visible = false; });
}
