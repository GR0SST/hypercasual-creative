import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mulberry32 } from '../sim/rng.js';

export const PALETTE = {
  sky: '#8fe3ff',
  fog: '#7fd9f7',
  ground: '#ffffff',
  groundRim: '#dff1f2',
  waterDeep: '#17a9e6',
  waterLight: '#55d4f7',
  waterLine: '#a9f0ff',
};

const ARENA_R = 34;

// Bright toy daylight: strong sky fill + warm key with wide soft shadows,
// a dim room env map for clearcoat highlights, fog into a pastel sky.
export function createEnvironment(scene, renderer) {
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 60, 140);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  scene.add(new THREE.HemisphereLight('#f2fbff', '#ffe3d6', 1.25));

  const sun = new THREE.DirectionalLight('#fff3e2', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 });
  scene.add(sun, sun.target);
  const sunOffset = new THREE.Vector3(-14, 30, 12);

  scene.add(createArena(renderer));
  const water = createWater();
  scene.add(water.mesh);

  return {
    // Shadow frustum follows the camera focus so shadows stay crisp-soft.
    update(time, focus) {
      sun.position.copy(focus).add(sunOffset);
      sun.target.position.copy(focus);
      water.uniforms.uTime.value = time;
    },
  };
}

function arenaTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  // Pastel checker: big soft tiles read as scale/speed under a moving camera.
  ctx.fillStyle = '#f3f6ff';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#e6ecff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillRect(256, 256, 256, 256);
  const rng = mulberry32(99);
  const step = 512 / 6;
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5 + (j % 2) * 0.5 + (rng() - 0.5) * 0.9) * step;
      const y = (j + 0.5 + (rng() - 0.5) * 0.9) * step;
      for (const ox of [-512, 0, 512]) {
        for (const oy of [-512, 0, 512]) {
          ctx.fillStyle = 'rgba(150,200,210,0.16)';
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// Round toy platform: flat top, plump rounded lip, skirt into the water.
function createArena(renderer) {
  const g = new THREE.Group();
  const R = ARENA_R;
  const lip = 0.7;
  const pts = [new THREE.Vector2(0, -0.001)];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - lip + Math.sin(a) * lip, -lip + Math.cos(a) * lip));
  }
  pts.push(new THREE.Vector2(R, -1.6), new THREE.Vector2(R - 0.6, -3.5), new THREE.Vector2(0, -3.5));
  const rim = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 160),
    new THREE.MeshStandardMaterial({ color: PALETTE.groundRim, roughness: 0.55, side: THREE.DoubleSide }),
  );
  rim.receiveShadow = true;
  g.add(rim);

  const tex = arenaTexture(renderer);
  tex.repeat.set(R / 4, R / 4);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(R - lip + 0.02, 160),
    new THREE.MeshStandardMaterial({ color: PALETTE.ground, map: tex, roughness: 0.85, emissive: '#eef3ff', emissiveIntensity: 0.18 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.001;
  top.receiveShadow = true;
  g.add(top);
  return g;
}

function createWater() {
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(PALETTE.waterDeep) },
    uLight: { value: new THREE.Color(PALETTE.waterLight) },
    uLine: { value: new THREE.Color(PALETTE.waterLine) },
    uFog: { value: new THREE.Color(PALETTE.fog) },
    uArenaR: { value: ARENA_R },
    uFogNear: { value: 55 },
    uFogFar: { value: 140 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uArenaR, uFogNear, uFogFar;
      uniform vec3 uDeep, uLight, uLine, uFog;
      varying vec3 vW;
      varying float vDepth;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
        return s;
      }
      void main() {
        vec2 p = vW.xz;
        float t = uTime;
        float r = length(p);
        vec2 q = p * 0.42 + vec2(fbm(p * 0.12 + t * 0.05), fbm(p * 0.12 - t * 0.04)) * 3.0;
        float band = abs(fract(fbm(q + t * 0.12) * 4.0) - 0.5);
        float squig = smoothstep(0.09, 0.04, band);
        vec3 col = mix(uDeep, uLight, 0.35 + fbm(p * 0.05 + t * 0.02) * 0.5);
        col = mix(col, uLine, squig * 0.75);
        float edge = r - uArenaR;
        col *= mix(0.72, 1.0, smoothstep(0.0, 6.0, edge));
        float foamN = fbm(vec2(atan(p.y, p.x) * 18.0, r * 0.6 - t * 0.6));
        float foam = (1.0 - smoothstep(0.3, 1.6 + foamN * 1.6, edge)) * step(0.0, edge);
        col = mix(col, vec3(1.0), foam * 0.85);
        col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 8, 8), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.3;
  return { mesh, uniforms };
}
