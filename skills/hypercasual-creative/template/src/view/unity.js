import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toy } from './actors.js';

// Load a model exported by scripts/unity/unity.mjs (`export` command) and
// restyle it with house materials using the Unity material colors/textures.
//   const hero = await loadUnityModel('assets/models/Player.unity.json');
//   hero.scene  -> THREE.Group (add under an actor's body group)
//   hero.clips  -> AnimationClips (GLB-embedded + converted Unity .anim); drive
//                  a mixer with mixer.setTime(simTime) in view.sync, never a clock.
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

// GLTFLoader strips characters like ':' and '.' from node names (mixamorig:Head -> mixamorigHead).
const clean = (n) => THREE.PropertyBinding.sanitizeNodeName(n ?? '');

function houseMaterial(m, base) {
  const mat = toy(m.color ?? '#ffffff');
  if (m.texture) {
    const t = texLoader.load(base + m.texture);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    mat.map = t;
  }
  return mat;
}

// Unity is left-handed: mirror X for glTF space.
function applyUnityLocal(o, { p, r, s }) {
  o.position.set(-p[0], p[1], p[2]);
  o.quaternion.set(r[0], -r[1], -r[2], r[3]);
  o.scale.set(s[0], s[1], s[2]);
}

export async function loadUnityModel(manifestUrl, { houseLook = true } = {}) {
  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
  const manifest = await (await fetch(manifestUrl)).json();
  const root = new THREE.Group();
  const clips = [];
  const cache = new Map();
  const load = async (file) => {
    if (!cache.has(file)) cache.set(file, await loader.loadAsync(base + file));
    return cache.get(file);
  };
  const byName = new Map(manifest.renderers.map((r) => [clean(r.name), r]));
  const style = (obj, fallback, file) => {
    const remap = manifest.modelMaterials?.[file] ?? {};
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (!houseLook) return;
      // glTF splits multi-material meshes into child primitives of the node.
      const node = byName.has(o.name) ? o : o.parent;
      const r = byName.get(node?.name);
      const slot = node === o ? 0 : node.children.filter((c) => c.isMesh).indexOf(o);
      const m = r?.materials[slot] ?? r?.materials[0] ?? fallback?.[Math.max(0, slot)] ?? fallback?.[0] ?? remap[o.material?.name];
      if (m) o.material = houseMaterial(m, base);
    });
  };

  // Main model(s): the ones the prefab's own renderers use.
  const main = new Set(manifest.renderers.map((r) => r.model).filter(Boolean));
  if (!main.size) Object.values(manifest.models).forEach((f) => main.add(f));
  for (const file of main) {
    const gltf = await load(file);
    clips.push(...gltf.animations);
    style(gltf.scene, null, file);
    root.add(gltf.scene);
  }
  // Nested parts (hats, weapons…) hang off a named bone/node.
  for (const a of manifest.attachments ?? []) {
    for (const file of a.models.filter(Boolean)) {
      const part = (await load(file)).scene.clone(true);
      style(part, a.materials.length ? a.materials : null, file);
      const holder = new THREE.Group();
      applyUnityLocal(holder, a.local);
      holder.add(part);
      (root.getObjectByName(clean(a.parent)) ?? root).add(holder);
    }
  }
  // Unity-native .anim clips converted by unity.mjs (bone names sanitized like GLTFLoader does).
  if (manifest.clips) {
    for (const c of await (await fetch(base + manifest.clips)).json()) {
      c.tracks = c.tracks.map((t) => {
        const i = t.name.lastIndexOf('.');
        return { ...t, name: `${clean(t.name.slice(0, i))}${t.name.slice(i)}` };
      });
      clips.push(THREE.AnimationClip.parse(c));
    }
  }
  return { scene: root, clips, manifest };
}
