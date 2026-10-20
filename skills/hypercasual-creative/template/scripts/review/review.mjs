// Frame-accurate review tool (SyncSketch-style) for rendered creatives.
//
//   bun scripts/review/review.mjs renders/demo.mp4        open review UI
//   bun scripts/review/review.mjs renders/demo.mp4 --list print open notes (for the agent)
//   bun scripts/review/review.mjs renders/demo.mp4 --done <id> [--reply "text"]
//
// Notes live in review/<video-name>/notes.json next to the project, so a
// re-render with the same output name keeps its checklist. Every note with a
// drawing also gets <id>.annotated.png = exact video frame + strokes, which is
// what the agent reads.
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve, extname } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const args = process.argv.slice(2);
const videoArg = args.find((a) => !a.startsWith('--') && /\.(mp4|mov|webm)$/i.test(a));
if (!videoArg) {
  console.error('usage: bun scripts/review/review.mjs <video.mp4> [--list | --done <id> [--reply text]] [--port 5199]');
  process.exit(1);
}
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : (args[i + 1] ?? true);
};
const VIDEO = resolve(videoArg);
const NAME = basename(VIDEO, extname(VIDEO));
const DIR = resolve('review', NAME);
const NOTES = join(DIR, 'notes.json');
mkdirSync(DIR, { recursive: true });

const load = () => (existsSync(NOTES) ? JSON.parse(readFileSync(NOTES, 'utf8')) : []);
const save = (notes) => writeFileSync(NOTES, JSON.stringify(notes, null, 1));

function probe() {
  const out = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', VIDEO]).toString(),
  );
  const s = out.streams[0];
  const [a, b] = s.r_frame_rate.split('/').map(Number);
  const fps = a / (b || 1);
  const duration = parseFloat(out.format.duration);
  return { width: s.width, height: s.height, fps, duration, frames: parseInt(s.nb_frames, 10) || Math.round(duration * fps) };
}
const meta = probe();
const fmtTime = (f) => `${(f / meta.fps).toFixed(2)}s`;

// Exact frame (select by index, not by timestamp) + optional strokes on top.
function annotate(note) {
  const out = join(DIR, `${note.id}.annotated.png`);
  const draw = join(DIR, `${note.id}.png`);
  const sel = `select=eq(n\\,${note.frame})`;
  const argv = existsSync(draw)
    ? ['-v', 'error', '-y', '-i', VIDEO, '-i', draw, '-filter_complex', `[0:v]${sel}[f];[1:v]scale=${meta.width}:${meta.height}[d];[f][d]overlay=0:0`, '-frames:v', '1', out]
    : ['-v', 'error', '-y', '-i', VIDEO, '-vf', sel, '-frames:v', '1', out];
  execFileSync('ffmpeg', argv);
  return out;
}

if (flag('--list')) {
  const open = load().filter((n) => n.status !== 'done');
  if (!open.length) console.log(`no open notes for ${NAME}`);
  for (const n of open.sort((a, b) => a.frame - b.frame)) {
    console.log(`[${n.id}] frame ${n.frame} (${fmtTime(n.frame)})${n.beat ? ` beat: ${n.beat}` : ''}\n  ${n.text || '(drawing only)'}\n  image: ${relative(join(DIR, `${n.id}.annotated.png`))}`);
  }
  process.exit(0);
}
if (flag('--done')) {
  const id = flag('--done');
  const notes = load();
  const n = notes.find((x) => x.id === id);
  if (!n) throw new Error(`no note ${id}`);
  n.status = 'done';
  if (typeof flag('--reply') === 'string') n.reply = flag('--reply');
  save(notes);
  console.log(`done: ${id}`);
  process.exit(0);
}

function relative(p) {
  return p.startsWith(process.cwd()) ? p.slice(process.cwd().length + 1) : p;
}

// Beat markers: director cues + gameplay events from `bun run bake`.
const events = existsSync('events.json') ? JSON.parse(readFileSync('events.json', 'utf8')) : [];
const beatAt = (frame) => {
  const t = frame / meta.fps;
  const cues = events.filter((e) => e.type === 'cue' && e.vt <= t + 1e-6);
  return cues.length ? cues[cues.length - 1].label : '';
};

const UI = readFileSync(join(dirname(new URL(import.meta.url).pathname), 'index.html'), 'utf8');
const port = parseInt(flag('--port') ?? '5199', 10);

function videoResponse(req) {
  const file = Bun.file(VIDEO);
  const size = file.size;
  const range = req.headers.get('range');
  if (!range) return new Response(file, { headers: { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(size) } });
  const [, a, b] = range.match(/bytes=(\d*)-(\d*)/);
  const start = a ? parseInt(a, 10) : 0;
  const end = b ? parseInt(b, 10) : size - 1;
  return new Response(file.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
  });
}

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p === '/') return new Response(UI, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (p === '/video') return videoResponse(req);
    if (p === '/api/meta') return json({ name: NAME, ...meta, events });
    if (p === '/api/notes' && req.method === 'GET') return json(load());
    if (p === '/api/notes' && req.method === 'POST') {
      const body = await req.json();
      const notes = load();
      const id = `n${Date.now().toString(36)}`;
      const note = { id, frame: body.frame, time: +(body.frame / meta.fps).toFixed(3), beat: beatAt(body.frame), text: body.text ?? '', author: body.author ?? '', status: 'open', created: new Date().toISOString(), drawing: !!body.png };
      if (body.png) writeFileSync(join(DIR, `${id}.png`), Buffer.from(body.png.split(',')[1], 'base64'));
      annotate(note);
      notes.push(note);
      save(notes);
      return json(note);
    }
    const m = p.match(/^\/api\/notes\/([\w-]+)(\/png)?$/);
    if (m) {
      const notes = load();
      const n = notes.find((x) => x.id === m[1]);
      if (!n) return json({ error: 'not found' }, 404);
      if (m[2]) {
        const f = join(DIR, `${n.id}.png`);
        return existsSync(f) ? new Response(Bun.file(f)) : new Response('', { status: 404 });
      }
      if (req.method === 'PATCH') {
        Object.assign(n, await req.json());
        save(notes);
        return json(n);
      }
      if (req.method === 'DELETE') {
        for (const f of [`${n.id}.png`, `${n.id}.annotated.png`]) if (existsSync(join(DIR, f))) unlinkSync(join(DIR, f));
        save(notes.filter((x) => x !== n));
        return json({ ok: true });
      }
    }
    return new Response('not found', { status: 404 });
  },
});

const link = `http://localhost:${port}/`;
console.log(`review: ${link}  (${NAME}, ${meta.frames} frames @ ${meta.fps}fps)\nnotes:  ${relative(NOTES)}`);
if (!flag('--no-open')) spawn('open', [link], { stdio: 'ignore', detached: true }).unref();
