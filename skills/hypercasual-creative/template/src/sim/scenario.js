import { createWorld } from './world.js';
import { wrapAngle, clamp } from './rng.js';
import { PACKSHOT_AT, TAPS } from '../timing.js';

// The creative's script. Beats (video time):
//   0.0–4.6  roll out, gem lines, COMBO on the 10th gem
//   4.6–6.4  rival cuts across -> slow-mo near miss, camera focuses
//   6.4–9.8  second combo, big gem = growth burst
//   10.6–    packshot over the slowed-down game
const ROUTE = [
  [0, -4], [7, -11], [15, -8], [17, 1], [11, 9], [2, 11], [-7, 7], [-12, -2], [-9, -12], [0, -17], [10, -18],
];

export function buildScenario(seed = 7) {
  const w = createWorld(seed);
  const p = w.player;
  p.x = 0;
  p.z = 8;
  p.route = ROUTE;

  // Pre-roll the hero path (gameplay time -> position) and dress it, so
  // pickups and threats sit exactly where the hero will be on the beat.
  const path = preroll(p, 14);
  const at = (t) => path[Math.min(path.length - 1, Math.round(t * 60))];
  w.debug = { path }; // drawn by src/sim/map.mjs

  const line = (t0, t1, every = 0.2, side = 0) => {
    for (let t = t0; t <= t1; t += every) {
      const s = at(t);
      w.gems.push({ x: s.x - Math.sin(s.h) * side, z: s.z + Math.cos(s.h) * side, value: 1, color: '#7b5cff', spin: t * 3, taken: false, age: 0, big: false });
    }
  };
  line(0.5, 2.3);
  line(3.0, 4.7);
  line(5.9, 7.9, 0.21);
  const big = at(8.6);
  w.gems.push({ x: big.x, z: big.z, value: 25, color: '#ffbf1f', spin: 0, taken: false, age: 0, big: true });

  // Near miss: rival crosses the hero's path 0.6 s behind it (fake: a straight
  // keyframed run, aimed at where the hero WAS, so it always just misses).
  const T = 5.0;
  const behind = at(T - 0.6);
  const nx = -Math.sin(behind.h);
  const nz = Math.cos(behind.h);
  w.rivals.push({ skin: 'rival', x: 0, z: 0, heading: 0, visible: false, t0: T - 1.6, t1: T + 1.6, from: [behind.x - nx * 18, behind.z - nz * 18], to: [behind.x + nx * 18, behind.z + nz * 18] });

  w.director
    .at(4.75, (w) => {
      w.timeScaleGoal = 0.22;
      w.cam.focusGoal = 1;
      w.popup('!', w.player.x, w.player.z, 'alert');
    }, 'slowmo-in')
    .at(6.15, (w) => {
      w.timeScaleGoal = 1;
      w.cam.focusGoal = 0;
      w.cam.kick = 0.5;
    }, 'slowmo-out')
    .at(PACKSHOT_AT, (w) => {
      w.flags.packshot = true;
      w.flags.hud = false;
      w.timeScaleGoal = 0.25;
    }, 'packshot');
  // Overlay-only beats still go through the director so they land in
  // events.json (SFX sync reads one timeline).
  for (const tap of TAPS) w.director.at(PACKSHOT_AT + tap, () => {}, 'tap');

  return w;
}

// Same steering as stepPlayer, gameplay time only (slow-mo never moves the path).
function preroll(src, seconds, dt = 1 / 60) {
  const p = { x: src.x, z: src.z, h: src.heading, wp: 0 };
  const out = [];
  for (let i = 0; i <= seconds / dt; i++) {
    out.push({ x: p.x, z: p.z, h: p.h });
    const goal = src.route[p.wp];
    if (goal) {
      const dx = goal[0] - p.x;
      const dz = goal[1] - p.z;
      if (Math.hypot(dx, dz) < 1.4) p.wp++;
      const d = wrapAngle(Math.atan2(dz, dx) - p.h);
      p.h += clamp(d, -src.turnRate * dt, src.turnRate * dt);
    }
    p.x += Math.cos(p.h) * src.speed * dt;
    p.z += Math.sin(p.h) * src.speed * dt;
  }
  return out;
}
