import * as THREE from 'three';
import { VIEW_W, VIEW_H } from '../timing.js';

// DOM HUD driven purely by sim state (score, world-anchored popups). Popups
// are pooled divs re-posed every frame from popup.age, so any seek order works.
export function createHud(root) {
  root.innerHTML = `<div class="hud-score"><i></i><span>0</span></div><div class="hud-pops"></div>`;
  const score = root.querySelector('.hud-score span');
  const pill = root.querySelector('.hud-score');
  const pops = root.querySelector('.hud-pops');
  const pool = [];
  const v = new THREE.Vector3();
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const back = (t, s = 2.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

  return {
    sync(w, camera) {
      root.style.opacity = w.flags.hud ? 1 : 0;
      score.textContent = w.score;
      // Pill bumps on every pickup (squash from the hero's latest pickup).
      pill.style.transform = `translateX(-50%) scale(${1 + w.player.squash * 0.18})`;
      w.popups.forEach((p, i) => {
        let el = pool[i];
        if (!el) {
          el = pool[i] = document.createElement('div');
          pops.appendChild(el);
        }
        const t = p.age / p.life;
        v.set(p.x, p.y + ease(t / 0.7) * 2.2, p.z).project(camera);
        const x = (v.x * 0.5 + 0.5) * VIEW_W;
        const y = (-v.y * 0.5 + 0.5) * VIEW_H;
        const s = back(Math.min(1, p.age / 0.22)) * (p.kind === 'big' ? 1.25 : 1);
        el.className = `pop pop-${p.kind}`;
        el.textContent = p.text;
        el.style.display = 'block';
        el.style.opacity = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
      });
      for (let i = w.popups.length; i < pool.length; i++) pool[i].style.display = 'none';
    },
  };
}
