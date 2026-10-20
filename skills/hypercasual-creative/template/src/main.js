import { Seekable } from './sim/seekable.js';
import { buildScenario } from './sim/scenario.js';
import { createView } from './view/view.js';
import { createHud } from './overlay/hud.js';
import { buildPackshot } from './overlay/packshot.js';
import { PACKSHOT_AT, SIM_DT } from './timing.js';

// Bridge between HyperFrames time and our stepped sim:
//   hf-seek(t) -> replay sim to t -> pose three.js + DOM from state -> render.
// GSAP owns only time-pure overlays (packshot); gameplay never lives in GSAP.
const seekable = new Seekable(() => buildScenario(), SIM_DT);
const view = createView(document.getElementById('gl'));
const hud = createHud(document.getElementById('hud'));

function renderAt(t) {
  const w = seekable.seek(t);
  view.sync(w);
  hud.sync(w, view.camera);
  view.render();
}

buildPackshot(window.__timelines['main'], PACKSHOT_AT);

window.addEventListener('hf-seek', (e) => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
// Debug handle for snapshots / console poking.
window.__creative = { seekable, view, renderAt };
