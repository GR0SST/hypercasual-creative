// Frame-exact parallel render:
//   bun run render [-o renders/<name>.mp4] [--workers 4] [--fps 60] [--no-sound]
// Splits the frames into chunks, one headless Chrome per chunk (its own
// browser, so the page is always the foreground tab; it replays the sim to its chunk start), encodes each chunk with ffmpeg,
// concatenates, then mixes sound (src/sound.mjs) onto the video.
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { serve, launch, openCreative, shutdown } from './lib/browser.mjs';
import { ff as resolveFfmpeg } from './lib/ffmpeg.mjs';

// System ffmpeg if present, else a one-time download per machine.
const { ffmpeg: FFMPEG, ffprobe: FFPROBE } = await resolveFfmpeg();

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

// The glitch shows the page background (#0d1b26, body in style.css) as a flat
// block where the canvas should be. Count frames whose bottom corners are
// flat and that dark.
function brokenFrames(file) {
  const out = execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-vf', "split[a][b];[a]crop=200:200:0:1700,signalstats,metadata=print:file=-[x];[b]crop=200:200:880:1700,signalstats,metadata=print:file=-[y];[x][y]hstack", '-f', 'null', '-'], { maxBuffer: 1 << 28 }).toString();
  let bad = 0;
  const vals = {};
  for (const line of out.split('\n')) {
    const m = line.match(/lavfi\.signalstats\.(YMIN|YMAX)=(\d+)/);
    if (m) vals[m[1]] = +m[2];
    if (line.includes('YMAX') && vals.YMAX - vals.YMIN <= 3 && vals.YMAX < 45) bad++;
  }
  return bad;
}

const srv = serve();
const browser = await launch();
const browsers = [browser];
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

  // Capture one chunk into its own mp4 with its own browser.
  async function renderChunk([a, b], i, own) {
    const c = await openCreative(own, srv.url);
    const ff = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), `${TMP}/chunk${i}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise((r) => ff.on('close', r));
    for (let f = a; f < b; f++) {
      const buf = await c.frame(f / FPS);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      done++;
    }
    ff.stdin.end();
    await closed;
    await c.page.close();
  }

  await Promise.all(
    chunks.map(async (range, i) => {
      // One browser per worker: several pages in one browser sometimes capture
      // frames with a stale canvas layer (canvas drawn into a corner only).
      const own = i === 0 ? browser : await launch();
      if (i > 0) browsers.push(own);
      await renderChunk(range, i, own);
      // Safety net for that glitch: re-render the chunk in a fresh browser.
      for (let attempt = 1; attempt <= 2 && brokenFrames(`${TMP}/chunk${i}.mp4`) > 0; attempt++) {
        console.log(`\nchunk ${i}: broken frames detected, re-rendering (attempt ${attempt})`);
        const fresh = await launch();
        browsers.push(fresh);
        done -= range[1] - range[0];
        await renderChunk(range, i, fresh);
      }
    }),
  );
  clearInterval(tick);

  writeFileSync(`${TMP}/list.txt`, chunks.map((_, i) => `file 'chunk${i}.mp4'`).join('\n'));
  const silent = `${TMP}/silent.mp4`;
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`, '-c', 'copy', '-movflags', '+faststart', silent]);
  console.log(`\nvideo: ${TOTAL} frames @ ${FPS} fps, ${chunks.length} workers, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (!args.includes('--no-sound') && existsSync('src/sound.mjs')) {
    execFileSync(process.execPath, ['src/sound.mjs', silent, OUT], { stdio: 'inherit' });
  } else {
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', silent, '-c', 'copy', OUT]);
  }
  console.log(`done: ${OUT}  (${((Date.now() - t0) / 1000).toFixed(1)}s total)`);
} finally {
  await Promise.all(browsers.map((b) => shutdown(b)));
  srv.stop();
}
process.exit(0);
