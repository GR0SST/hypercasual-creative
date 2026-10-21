// Runs the sim headless (no browser) and writes the event timeline:
//   bun src/sim/bake.mjs            -> events.json (video time `vt` per event)
// Use it to check beat timing before rendering anything, and as the source
// for sound placement (src/sound.mjs).
import { writeFileSync } from 'node:fs';
import { buildScenario } from './scenario.js';
import { DURATION, SIM_DT } from '../timing.js';

const w = buildScenario();
const track = [];
for (let i = 0; i * SIM_DT < DURATION; i++) {
  w.step(SIM_DT);
  if (i % 30 === 0) track.push(`${w.clock.toFixed(2)}s  pos ${w.player.x.toFixed(1)},${w.player.z.toFixed(1)}  score ${w.score}  ts ${w.timeScale.toFixed(2)}`);
}
writeFileSync('events.json', JSON.stringify(w.events, null, 1));
console.log(track.join('\n'));
const counts = {};
for (const e of w.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
console.log('\nevents:', counts);
for (const e of w.events) if (e.type !== 'gem') console.log(`  ${e.vt.toFixed(2)}s ${e.type} ${e.label ?? e.n ?? e.value ?? ''}`);
