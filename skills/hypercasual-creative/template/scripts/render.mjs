// Frame-exact parallel render:
//   bun run render [-o renders/<name>.mp4] [--workers 4] [--fps 60] [--no-sound]
// Splits the frames into chunks, one headless Chrome page per chunk (each
// page replays the sim to its chunk start), encodes each chunk with ffmpeg,
// concatenates, then mixes sound (src/sound.mjs) onto the video.
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { serve, launch, openCreative, shutdown } from './lib/browser.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i < 0 ? dflt : args[i + 1];
};
const OUT = resolve(opt('-o', 'renders/creative.mp4'));
const WORKERS = parseInt(opt('--workers', String(Math.max(2, Math.min(6, Math.floor(availableParallelism() / 2))))), 10);
const TMP = resolve('renders/.tmp');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(dirname(OUT), { recursive: true });

// Events for the sound mix come from the same deterministic sim.
execFileSync(process.execPath, ['src/sim/bake.mjs'], { stdio: 'ignore' });

const srv = serve();
const browser = await launch();
const t0 = Date.now();
try {
  const probe = await openCreative(browser, srv.url);
  const FPS = parseInt(opt('--fps', String(probe.fps)), 10);
  const TOTAL = Math.round(probe.duration * FPS);
  await probe.page.close();

  const per = Math.ceil(TOTAL / WORKERS);
  const chunks = Array.from({ length: WORKERS }, (_, i) => [i * per, Math.min(TOTAL, (i + 1) * per)]).filter(([a, b]) => b > a);
  let done = 0;
  const tick = setInterval(() => process.stdout.write(`\rframes ${done}/${TOTAL}  ${((Date.now() - t0) / 1000).toFixed(0)}s   `), 1000);

  await Promise.all(
    chunks.map(async ([a, b], i) => {
      const c = await openCreative(browser, srv.url);
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), `${TMP}/chunk${i}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise((r) => ff.on('close', r));
      for (let f = a; f < b; f++) {
        const buf = await c.frame(f / FPS);
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        done++;
      }
      ff.stdin.end();
      await closed;
      await c.page.close();
    }),
  );
  clearInterval(tick);

  writeFileSync(`${TMP}/list.txt`, chunks.map((_, i) => `file 'chunk${i}.mp4'`).join('\n'));
  const silent = `${TMP}/silent.mp4`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`, '-c', 'copy', '-movflags', '+faststart', silent]);
  console.log(`\nvideo: ${TOTAL} frames @ ${FPS} fps, ${chunks.length} workers, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (!args.includes('--no-sound') && existsSync('src/sound.mjs')) {
    execFileSync(process.execPath, ['src/sound.mjs', silent, OUT], { stdio: 'inherit' });
  } else {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-c', 'copy', OUT]);
  }
  console.log(`done: ${OUT}  (${((Date.now() - t0) / 1000).toFixed(1)}s total)`);
} finally {
  await shutdown(browser, srv);
}
process.exit(0);
