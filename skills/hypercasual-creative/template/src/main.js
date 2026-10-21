import { Seekable } from './sim/seekable.js';
import { buildScenario } from './sim/scenario.js';
import { createView } from './view/view.js';
import { createHud } from './overlay/hud.js';
import { buildPackshot } from './overlay/packshot.js';
import { pending } from './ready.js';
import { DURATION, FPS, PACKSHOT_AT, SIM_DT, VIEW_W, VIEW_H } from './timing.js';

// renderAt(t): replay the stepped sim to video time t, pose three.js + DOM
// from its state, seek the GSAP overlay timeline, draw. Any order of t works
// (backward = rebuild + replay), which is what parallel render workers need.
const seekable = new Seekable(() => buildScenario(), SIM_DT);
const view = createView(document.getElementById('gl'));
const hud = createHud(document.getElementById('hud'));
// GSAP owns only time-pure overlays (packshot); gameplay never lives in GSAP.
const tl = gsap.timeline({ paused: true });
buildPackshot(tl, PACKSHOT_AT);

function renderAt(t) {
  const w = seekable.seek(t);
  view.sync(w);
  hud.sync(w, view.camera);
  tl.seek(t, false);
  view.render();
}

const params = new URLSearchParams(location.search);
const root = document.getElementById('root');
const fit = () => {
  const s = params.has('capture') ? 1 : Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  root.style.transform = `scale(${s})`;
};
addEventListener('resize', fit);
fit();

await document.fonts.ready;
await Promise.all(pending);
renderAt(0);
window.__creative = { renderAt, seekable, view, duration: DURATION, fps: FPS, ready: true };

// Dev: ?t=5.4 holds a still; otherwise plays in real time and loops.
// Capture scripts (?capture) drive renderAt themselves.
if (params.has('t')) renderAt(parseFloat(params.get('t')));
else if (!params.has('capture')) {
  const t0 = performance.now();
  const loop = (now) => {
    renderAt((((now - t0) / 1000) % DURATION));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
