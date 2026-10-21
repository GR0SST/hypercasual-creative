// Sound design for THIS creative: which event gets which sound, layering,
// music ducking under slow-mo, end-card stings. Edit per creative like the
// scenario. Run by `bun run render` (or: bun src/sound.mjs <silent.mp4> <out.mp4>).
// Roles (files, gains, Pixabay queries) live in sfx.json; events in events.json.
import { readFileSync } from 'node:fs';
import { Mixer } from '../scripts/lib/mixer.mjs';
import { DURATION, PACKSHOT_AT } from './timing.js';

const [video, out] = process.argv.slice(2);
const { roles } = JSON.parse(readFileSync('sfx.json', 'utf8'));
const events = JSON.parse(readFileSync('events.json', 'utf8'));
const m = new Mixer({ duration: DURATION, roles });
const fx = (...a) => m.fx(...a);

const slow = [];
for (const e of events) {
  const t = e.vt;
  const cue = e.type === 'cue' ? e.label : null;
  if (e.type === 'gem') fx('pop', t, { minGap: 0.07, maxLen: 0.4 });
  else if (e.type === 'combo') {
    fx('pop', t);
    fx('combo', t + 0.03, { maxLen: 1.2 });
  } else if (e.type === 'bigGem') {
    fx('impact', t);
    fx('payoff', t + 0.2, { gain: 0.8 });
  } else if (cue === 'slowmo-in') {
    slow.push([t, null]);
    fx('whoosh', t - 0.15, { maxLen: 1.2 });
    fx('slowmo', t, { maxLen: 2.2 });
  } else if (cue === 'slowmo-out') {
    if (slow.length && slow.at(-1)[1] === null) slow.at(-1)[1] = t;
    fx('whoosh', t, { maxLen: 0.9, gain: 0.7 });
  } else if (cue === 'packshot') {
    fx('whoosh', t, { maxLen: 0.6 });
    fx('logo', t + 0.3);
  } else if (cue === 'tap') fx('tap', t);
}

// Music: duck + muffle during slow-mo, settle under the packshot, fade at the end.
const gainPoints = [[0, 1]];
const cutoffPoints = [[0, 18000]];
for (const [a, b0] of slow) {
  const b = b0 ?? a + 1.5;
  gainPoints.push([a - 0.05, 1], [a + 0.25, 0.45], [b - 0.05, 0.45], [b + 0.2, 1]);
  cutoffPoints.push([a - 0.05, 18000], [a + 0.25, 700], [b - 0.05, 700], [b + 0.25, 18000]);
}
gainPoints.push([PACKSHOT_AT, 1], [PACKSHOT_AT + 0.3, 0.75], [DURATION - 0.5, 0.75], [DURATION, 0]);
cutoffPoints.push([DURATION, 18000]);
m.music('music', { gainPoints, cutoffPoints });

m.mux(video, out);
console.log(`sound: ${out}`);
