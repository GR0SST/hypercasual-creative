// Break a reference video into shots + per-second frames + a contact sheet.
//   bun ref-breakdown.mjs path/to/ref.mp4 [out_dir=ref/<name>] [scene_threshold=0.3]
// -> info.txt, cuts.txt (shot start times), cut_###.jpg (first frame of each shot),
//    sec_###.jpg (1 frame per second), sheet.jpg (contact sheet of the seconds)
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ff as resolveFfmpeg } from '../template/scripts/lib/ffmpeg.mjs';

// System ffmpeg if present, else a one-time download per machine.
const { ffmpeg: FFMPEG, ffprobe: FFPROBE } = await resolveFfmpeg();

const [input, outArg, thArg] = process.argv.slice(2);
if (!input) {
  console.error('usage: bun ref-breakdown.mjs <video> [out_dir] [scene_threshold=0.3]');
  process.exit(1);
}
const OUT = outArg ?? join('ref', basename(input, extname(input)));
const TH = thArg ?? '0.3';
mkdirSync(OUT, { recursive: true });
const ff = (args, quiet = false) => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args], { stdio: quiet ? 'ignore' : ['ignore', 'pipe', 'inherit'] });
const JPG = ['-q:v', '3', '-pix_fmt', 'yuvj420p'];

writeFileSync(join(OUT, 'info.txt'), execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'compact', input]));

// Scene cuts: timestamps + the first frame of every shot. (Filter args go
// straight to ffmpeg, no shell, so the same code runs on Windows.)
const log = join(OUT, 'scenes.log');
try {
  ff(['-i', input, '-vf', `select='gt(scene,${TH})',metadata=print:file=${log.replace(/\\/g, '/').replace(/:/g, '\\:')}`, '-fps_mode', 'vfr', ...JPG, join(OUT, 'cut_%03d.jpg')], true);
} catch {
  // no cuts found is fine
}
ff(['-i', input, '-frames:v', '1', ...JPG, join(OUT, 'cut_000.jpg')]);
const cuts = ['0.000', ...(existsSync(log) ? [...readFileSync(log, 'utf8').matchAll(/pts_time:([\d.]+)/g)].map((m) => m[1]) : [])];
writeFileSync(join(OUT, 'cuts.txt'), cuts.join('\n') + '\n');

// One frame per second (labelled with its time when ffmpeg has drawtext).
const sec = join(OUT, 'sec_%03d.jpg');
try {
  ff(['-i', input, '-vf', "fps=1,scale=360:-2,drawtext=text='%{pts\\:hms}':x=10:y=10:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6", ...JPG, sec], true);
} catch {
  ff(['-i', input, '-vf', 'fps=1,scale=360:-2', ...JPG, sec]);
}

// Contact sheet, 6 columns.
const n = readdirSync(OUT).filter((f) => /^sec_\d+\.jpg$/.test(f)).length;
ff(['-framerate', '1', '-i', sec, '-vf', `tile=6x${Math.ceil(n / 6)}:padding=4:color=black`, '-frames:v', '1', ...JPG, join(OUT, 'sheet.jpg')]);

console.log(`shots: ${cuts.length}  seconds: ${n}`);
console.log(`${join(OUT, 'sheet.jpg')}  ${join(OUT, 'cuts.txt')}  cut_*.jpg  sec_*.jpg`);
