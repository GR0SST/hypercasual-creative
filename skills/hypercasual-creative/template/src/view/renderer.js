import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { VIEW_W, VIEW_H } from '../timing.js';

// House look (see references/look.md): Neutral tone mapping, soft PCF shadows,
// GTAO contact occlusion, a whisper of bloom, gentle saturation + vignette.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.2 }, uVig: { value: 0.12 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSat, uVig;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb += vec3(0.012, 0.0, -0.01) * (1.0 - l);
      vec2 d = (vUv - 0.5) * vec2(1.0, 1.25);
      c.rgb *= 1.0 - uVig * smoothstep(0.35, 0.95, length(d) * 1.4);
      gl_FragColor = c;
    }`,
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(VIEW_W, VIEW_H, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const rt = new THREE.WebGLRenderTarget(VIEW_W, VIEW_H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(VIEW_W, VIEW_H);
  const renderPass = new RenderPass(null, null);
  composer.addPass(renderPass);
  let ao = null;
  const aoIndex = composer.passes.length;
  // Keep bloom low: the look is soft daylight, not glow.
  const bloom = new UnrealBloomPass(new THREE.Vector2(VIEW_W / 2, VIEW_H / 2), 0.22, 0.3, 2.4);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  return {
    renderer,
    bloom,
    grade,
    render(scene, camera) {
      renderPass.scene = scene;
      renderPass.camera = camera;
      if (!ao) {
        ao = new GTAOPass(scene, camera, VIEW_W, VIEW_H);
        ao.output = GTAOPass.OUTPUT.Default;
        ao.blendIntensity = 0.85;
        ao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.4, thickness: 2, scale: 1, samples: 16 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
        composer.insertPass(ao, aoIndex);
      }
      composer.render();
    },
  };
}
