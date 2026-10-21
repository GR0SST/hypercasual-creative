// Stills for sign-off, no video:
//   bun run shot 1,2.2,5.4,9.5,12.5      -> renders/shots/t<time>.png + renders/shots/sheet.jpg
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve, launch, openCreative, shutdown } from './lib/browser.mjs';

const times = (process.argv[2] ?? '1,3,5,7,9,11,13').split(',').map(Number);
const out = 'renders/shots';
mkdirSync(out, { recursive: true });
const srv = serve();
const browser = await launch();
try {
  const c = await openCreative(browser, srv.url);
  const files = [];
  for (const t of times) {
    const f = `${out}/t${t}.png`;
    writeFileSync(f, await c.frame(t, 'png'));
    files.push(f);
    console.log(f);
  }
  // Contact sheet: 4 per row, labelled with the time.
  const cols = Math.min(4, files.length);
  const rows = Math.ceil(files.length / cols);
  const tiles = files.map((f, i) => `[${i}:v]scale=360:-1,drawtext=text='${times[i]}s':x=12:y=12:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6[v${i}]`);
  const layout = files.map((_, i) => `${(i % cols) * 364}_${Math.floor(i / cols) * 644}`).join('|');
  const graph = files.length > 1 ? `${tiles.join(';')};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black` : tiles[0].replace('[v0]', '');
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-q:v', '3', '-pix_fmt', 'yuvj420p', `${out}/sheet.jpg`], { stdio: 'ignore' });
  } catch {
    // ffmpeg without drawtext (no freetype): sheet without labels.
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', graph.replace(/,drawtext=[^\[]*/g, ''), '-q:v', '3', '-pix_fmt', 'yuvj420p', `${out}/sheet.jpg`]);
  }
  console.log(`${out}/sheet.jpg  (${rows}x${cols})`);
} finally {
  await shutdown(browser, srv);
}
process.exit(0);
