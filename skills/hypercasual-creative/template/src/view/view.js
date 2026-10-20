import * as THREE from 'three';
import { VIEW_W, VIEW_H } from '../timing.js';
import { createRenderer } from './renderer.js';
import { createEnvironment } from './environment.js';
import { createBlob, GemPool, ParticlePool } from './actors.js';

// Stateless view: sync(world) poses every three.js object from sim state.
// Nothing here may accumulate across frames (seek order is arbitrary).
export function createView(canvas) {
  const gfx = createRenderer(canvas);
  const scene = new THREE.Scene();
  const env = createEnvironment(scene, gfx.renderer);
  const camera = new THREE.PerspectiveCamera(38, VIEW_W / VIEW_H, 0.5, 400);
  const hero = createBlob('#ff4a8d');
  scene.add(hero.root);
  const rivals = [];
  const gems = new GemPool(scene);
  const particles = new ParticlePool(scene);
  const pitch = THREE.MathUtils.degToRad(58);
  const focus = new THREE.Vector3();

  function poseActor(a, actor, time, size = 1, squash = 0) {
    actor.root.position.set(a.x, 0, a.z);
    actor.root.rotation.y = -a.heading;
    const bob = Math.abs(Math.sin(time * 10)) * 0.12;
    actor.body.scale.set(size * (1 + squash * 0.25), size * (1 - squash * 0.3), size * (1 + squash * 0.25));
    actor.body.position.y = bob * size;
  }

  function poseCamera(c) {
    focus.set(c.x, 0, c.z);
    const d = c.dist * (1 - c.punch * 0.08 + c.kick * 0.12 - c.focus * 0.2);
    camera.position.set(c.x, Math.sin(pitch) * d, c.z + Math.cos(pitch) * d - 1.6);
    const s = c.trauma * c.trauma;
    const t = c.t * 38;
    camera.position.x += (Math.sin(t * 1.13) + Math.sin(t * 2.71) * 0.4) * s * 0.6;
    camera.position.z += (Math.cos(t * 0.97) + Math.cos(t * 2.33) * 0.4) * s * 0.6;
    camera.lookAt(c.x, 0, c.z - 1.6);
    if (Math.abs(camera.fov - c.fov) > 1e-3) {
      camera.fov = c.fov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    camera,
    scene,
    gfx,
    sync(w) {
      poseActor(w.player, hero, w.time, w.player.size, w.player.squash);
      w.rivals.forEach((r, i) => {
        if (!rivals[i]) {
          rivals[i] = createBlob('#27c6dc');
          scene.add(rivals[i].root);
        }
        rivals[i].root.visible = r.visible;
        poseActor(r, rivals[i], w.time + i, 1.15);
      });
      gems.sync(w.gems, w.time);
      particles.sync(w.particles);
      poseCamera(w.cam);
      env.update(w.time, focus);
    },
    render() {
      gfx.render(scene, camera);
    },
  };
}
