// events.json + sfx.json -> <audio> elements inside #audio-track of index.html,
// so Studio preview plays the SFX and `hyperframes render` mixes them.
//   bun run bake && bun scripts/sfx-sync.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const lengths = {};
const lengthOf = (src) =>
  (lengths[src] ??= parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString()));
// Greedy lanes: a clip goes on the first track that is free at its start.
const lanes = [];
const laneFor = (start, end) => {
  let i = lanes.findIndex((busyUntil) => busyUntil <= start);
  if (i < 0) i = lanes.push(0) - 1;
  lanes[i] = end;
  return 10 + i;
};

const events = JSON.parse(readFileSync('events.json', 'utf8'));
const cfg = JSON.parse(readFileSync('sfx.json', 'utf8'));
const lastAt = {};
const tags = [];
let n = 0;
if (cfg.music) {
  tags.push(`<audio id="sfx-music" src="${cfg.music.src}" data-start="0" data-duration="${cfg.music.duration ?? lengthOf(cfg.music.src).toFixed(3)}" data-track-index="9" data-volume="${cfg.music.volume ?? 0.4}"></audio>`);
}
for (const e of events) {
  const key = e.type === 'cue' ? `cue:${e.label}` : e.type;
  const s = cfg.sounds[key];
  if (!s) continue;
  if (s.minGap && lastAt[key] !== undefined && e.vt - lastAt[key] < s.minGap) continue;
  lastAt[key] = e.vt;
  const len = lengthOf(s.src);
  const track = laneFor(e.vt, e.vt + len);
  tags.push(`<audio id="sfx-${n++}" src="${s.src}" data-start="${e.vt.toFixed(3)}" data-duration="${len.toFixed(3)}" data-track-index="${track}" data-volume="${s.volume ?? 1}"></audio>`);
}
const html = readFileSync('index.html', 'utf8');
const out = html.replace(/<div id="audio-track">[\s\S]*?<\/div>/, `<div id="audio-track">\n        ${tags.join('\n        ')}\n      </div>`);
writeFileSync('index.html', out);
console.log(`${tags.length} audio clips written to index.html`);
