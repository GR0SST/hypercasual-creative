// Top-down debug map of the sim, no browser: check WHERE things are at each
// beat (paths crossing, pickups on the route, threats missing) before any render.
//   bun src/sim/map.mjs 1,4.75,5.6,9.5     [video times, default: every 2 s]
//   -> renders/map.png (one tile per time, labelled), renders/map/t<time>.ppm
// Generic layers: arena, planned hero path, travelled path, hero, gems,
// rivals + their runs, particles. Add the game's own layers (territory,
// trails, enemy land…) in GAME LAYERS below.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildScenario } from './scenario.js';
import { DURATION, SIM_DT } from '../timing.js';

const times = (process.argv[2] ?? Array.from({ length: Math.floor(DURATION / 2) }, (_, i) => (i + 1) * 2).join(',')).split(',').map(Number);
const R = 36; // world half-size shown (arena radius 34 + margin)
const W = 480; // tile pixels
const px = (x) => Math.round(((x + R) / (2 * R)) * W);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (c, k, to = [255, 255, 255]) => c.map((v, i) => Math.round(v * (1 - k) + to[i] * k));

function canvas() {
  const img = Buffer.alloc(W * W * 3, 0);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    const o = (y * W + x) * 3;
    img[o] = c[0];
    img[o + 1] = c[1];
    img[o + 2] = c[2];
  };
  const g = {
    img,
    fill: (c) => {
      for (let i = 0; i < W * W; i++) img.set(c, i * 3);
    },
    // World-space helpers (x right, z down = screen-down in the default camera).
    disc: (x, z, r, c) => {
      const cx = px(x), cz = px(z), rr = Math.max(1, Math.round((r / (2 * R)) * W));
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr) put(cx + dx, cz + dy, c);
    },
    dot: (x, z, c, size = 2) => {
      for (let dy = -size; dy <= size; dy++) for (let dx = -size; dx <= size; dx++) put(px(x) + dx, px(z) + dy, c);
    },
    line: (x0, z0, x1, z1, c, dash = 0) => {
      const n = Math.max(1, Math.ceil(Math.hypot(px(x1) - px(x0), px(z1) - px(z0))));
      for (let i = 0; i <= n; i++) if (!dash || Math.floor(i / dash) % 2 === 0) put(Math.round(px(x0) + ((px(x1) - px(x0)) * i) / n), Math.round(px(z0) + ((px(z1) - px(z0)) * i) / n), c);
    },
    put,
  };
  return g;
}

// 3x5 pixel font for the tile label ("5.60s").
const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111', '.': '000000000000010', s: '000011110001110', ' ': '000000000000000' };
function label(g, text, x0 = 8, y0 = 8, scale = 4) {
  [...text].forEach((ch, k) => {
    const bits = FONT[ch] ?? FONT[' '];
    for (let i = 0; i < 15; i++) {
      if (bits[i] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) g.put(x0 + k * 4 * scale + (i % 3) * scale + dx, y0 + Math.floor(i / 3) * scale + dy, [20, 20, 30]);
    }
  });
}

const w = buildScenario();
const travelled = [];
mkdirSync('renders/map', { recursive: true });
const files = [];
let lastEvent = 0;
for (const T of times.sort((a, b) => a - b)) {
  while (w.clock + SIM_DT / 2 < T) {
    w.step(SIM_DT);
    travelled.push([w.player.x, w.player.z]);
  }
  const g = canvas();
  g.fill([60, 150, 210]); // water
  g.disc(0, 0, 34, [240, 244, 250]); // arena

  // ---------- GAME LAYERS (edit per game: territory, trails, zones…) ----------

  // ---------- generic layers ----------
  for (const [i, p] of (w.debug?.path ?? []).entries()) if (i % 3 === 0) g.dot(p.x, p.z, [150, 150, 165], 0); // planned hero path
  for (let i = 1; i < travelled.length; i++) g.line(travelled[i - 1][0], travelled[i - 1][1], travelled[i][0], travelled[i][1], [30, 30, 40]); // travelled
  for (const gem of w.gems) g.dot(gem.x, gem.z, gem.taken ? mix(hex(gem.color), 0.75) : hex(gem.color), gem.big ? 5 : 2);
  for (const r of w.rivals) {
    g.line(r.from[0], r.from[1], r.to[0], r.to[1], mix([39, 198, 220], 0.4), 4); // its whole keyframed run
    if (r.visible) g.dot(r.x, r.z, [20, 140, 170], 5);
  }
  for (const q of w.particles) g.dot(q.x, q.z, [255, 170, 40], 0);
  g.dot(w.player.x, w.player.z, [255, 74, 141], 5); // hero
  label(g, `${T.toFixed(2)}s`);

  const f = `renders/map/t${T}.ppm`;
  writeFileSync(f, Buffer.concat([Buffer.from(`P6 ${W} ${W} 255\n`), g.img]));
  files.push(f);
  const evs = w.events.slice(lastEvent).filter((e) => e.type !== 'gem');
  lastEvent = w.events.length;
  console.log(`${T.toFixed(2)}s  hero ${w.player.x.toFixed(1)},${w.player.z.toFixed(1)}  score ${w.score}  timeScale ${w.timeScale.toFixed(2)}${evs.length ? '  | ' + evs.map((e) => `${e.vt.toFixed(2)} ${e.label ?? e.type}`).join(', ') : ''}`);
}

// Tile into one PNG, 4 per row.
const cols = Math.min(4, files.length);
const inputs = files.flatMap((f) => ['-i', f]);
const layout = files.map((_, k) => `${(k % cols) * (W + 6)}_${Math.floor(k / cols) * (W + 6)}`).join('|');
const filter = files.length > 1 ? `${files.map((_, k) => `[${k}:v]pad=iw+6:ih+6:3:3:white[v${k}]`).join(';')};${files.map((_, k) => `[v${k}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=white` : 'null';
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, 'renders/map.png']);
console.log('renders/map.png');
