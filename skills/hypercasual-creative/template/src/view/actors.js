import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Toy materials: clearcoat plastic, saturated base, light sheen.
export const toy = (color, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, ...extra });

// Placeholder hero. Swap for the game's own model (GLB from the Unity export,
// see references/unity-assets.md); keep the root/body split: root = position
// + heading, body = squash/bob, so sim-driven juice still works.
export function createBlob(color, face = '#ffffff') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), toy(color, { sheen: 0.5, sheenColor: new THREE.Color('#ffffff') }));
  shell.scale.set(1, 0.86, 1);
  shell.position.y = 0.86;
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);
  const white = toy(face);
  const pupil = toy('#1b1530', { roughness: 0.15, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), white);
    eye.position.set(0.78, 1.18, s * 0.34);
    eye.scale.set(0.6, 1, 1);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), pupil);
    dot.position.set(0.94, 1.18, s * 0.34);
    body.add(eye, dot);
  }
  return { root, body };
}

export class GemPool {
  constructor(scene, max = 200) {
    const geo = new THREE.OctahedronGeometry(0.55, 0);
    geo.scale(1, 1.3, 1);
    this.mesh = new THREE.InstancedMesh(geo, toy('#ffffff', { roughness: 0.15, flatShading: true }), max);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
  }

  sync(gems, time) {
    let n = 0;
    for (const g of gems) {
      // Taken gems shrink-pop out over 0.15 s instead of vanishing.
      const k = g.taken ? 1 - Math.min(1, g.age / 0.15) : 1;
      if (k <= 0) continue;
      const sc = (g.big ? 2.2 : 1) * k * (g.taken ? 1 + (1 - k) * 0.6 : 1);
      this.p.set(g.x, (g.big ? 1.9 : 1) + Math.sin(time * 3 + g.spin) * 0.15, g.z);
      this.q.setFromEuler(this.e.set(0, g.spin, 0));
      this.s.setScalar(sc);
      this.mesh.setMatrixAt(n, this.m.compose(this.p, this.q, this.s));
      this.mesh.setColorAt(n, this.c.set(g.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class ParticlePool {
  constructor(scene, max = 600) {
    this.mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.25), toy('#ffffff'), max);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.max = max;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
  }

  sync(particles) {
    let n = 0;
    for (const q of particles) {
      if (n >= this.max) break;
      const fade = 1 - Math.max(0, (q.age - q.life * 0.6) / (q.life * 0.4));
      this.p.set(q.x, q.y, q.z);
      this.q.setFromEuler(this.e.set(q.age * q.spin, q.age * q.spin * 0.7, 0));
      this.s.setScalar(q.size * 2 * fade);
      this.mesh.setMatrixAt(n, this.m.compose(this.p, this.q, this.s));
      this.mesh.setColorAt(n, this.c.set(q.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
