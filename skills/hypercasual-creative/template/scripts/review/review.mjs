// Frame-accurate review tool (SyncSketch-style) for rendered creatives.
//
//   bun scripts/review/review.mjs renders/demo.mp4        open review UI
//   bun scripts/review/review.mjs renders/demo.mp4 --list print open notes (for the agent)
//   bun scripts/review/review.mjs renders/demo.mp4 --done <id> [--reply "text"]
//
// Versions: every time the render at that path changes (agent re-rendered
// after fixes), the server archives it as the next version (review/<name>/vN.mp4)
// and the UI switches to it. Notes belong to the version they were left on,
// so a fresh render starts with a clean sheet; older versions stay browsable.
// Every note also gets <id>.annotated.png = exact frame + strokes, which is
// what the agent reads.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openUrl } from '../lib/platform.mjs';

const args = process.argv.slice(2);
const videoArg = args.find((a) => !a.startsWith('--') && /\.(mp4|mov|webm)$/i.test(a));
if (!videoArg) {
  console.error('usage: bun scripts/review/review.mjs <video.mp4> [--list | --done <id> [--reply text]] [--port 5199] [--no-open]');
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
const VERSIONS = join(DIR, 'versions.json');
mkdirSync(DIR, { recursive: true });

const readJson = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const loadNotes = () => readJson(NOTES, []).map((n) => ({ version: 1, ...n }));
const saveNotes = (notes) => writeFileSync(NOTES, JSON.stringify(notes, null, 1));
const loadVersions = () => readJson(VERSIONS, []);
const relative = (p) => (p.startsWith(process.cwd()) ? p.slice(process.cwd().length + 1) : p);
const vFile = (v, suffix = '.mp4') => join(DIR, `v${v}${suffix}`);

function probe(file) {
  const out = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', file]).toString(),
  );
  const s = out.streams[0];
  const [a, b] = s.r_frame_rate.split('/').map(Number);
  const fps = a / (b || 1);
  const duration = parseFloat(out.format.duration);
  return { width: s.width, height: s.height, fps, duration, frames: parseInt(s.nb_frames, 10) || Math.round(duration * fps) };
}

// Archive the render as a new version when it changed since the last one.
// Called only when the file looks finished (size stable between two polls).
function ensureVersion() {
  if (!existsSync(VIDEO)) return null;
  const st = statSync(VIDEO);
  const fp = `${st.size}-${Math.round(st.mtimeMs)}`;
  const versions = loadVersions();
  const last = versions[versions.length - 1];
  if (last?.fp === fp) return null;
  const v = (last?.v ?? 0) + 1;
  copyFileSync(VIDEO, vFile(v));
  console.log(`v${v}: building scrub proxy…`);
  // Scrub proxy: every frame a keyframe, so seeks are instant (renders have
  // keyframes seconds apart). Annotations always use the archived original.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', vFile(v), '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'fastdecode', '-crf', '20', '-g', '1', '-bf', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', vFile(v, '.proxy.mp4')]);
  // Beat markers belong to the render they came from.
  if (existsSync('events.json')) copyFileSync('events.json', vFile(v, '.events.json'));
  versions.push({ v, fp, created: new Date().toISOString(), ...probe(vFile(v)) });
  writeFileSync(VERSIONS, JSON.stringify(versions, null, 1));
  console.log(`v${v} ready`);
  return v;
}

const versionMeta = (v) => loadVersions().find((x) => x.v === v);
const eventsOf = (v) => readJson(vFile(v, '.events.json'), []);
const beatAt = (v, frame) => {
  const t = frame / versionMeta(v).fps;
  const cues = eventsOf(v).filter((e) => e.type === 'cue' && e.vt <= t + 1e-6);
  return cues.length ? cues[cues.length - 1].label : '';
};

// Exact frame (select by index, not by timestamp) + optional strokes on top.
function annotate(note) {
  const meta = versionMeta(note.version);
  const out = join(DIR, `${note.id}.annotated.png`);
  const draw = join(DIR, `${note.id}.png`);
  const src = vFile(note.version);
  const sel = `select=eq(n\\,${note.frame})`;
  const argv = existsSync(draw)
    ? ['-v', 'error', '-y', '-i', src, '-i', draw, '-filter_complex', `[0:v]${sel}[f];[1:v]scale=${meta.width}:${meta.height}[d];[f][d]overlay=0:0`, '-frames:v', '1', out]
    : ['-v', 'error', '-y', '-i', src, '-vf', sel, '-frames:v', '1', out];
  execFileSync('ffmpeg', argv);
}

if (flag('--list')) {
  const versions = loadVersions();
  const latest = versions[versions.length - 1]?.v ?? 0;
  const open = loadNotes().filter((n) => n.status !== 'done');
  console.log(`${NAME}: latest version v${latest}${existsSync(VIDEO) && versions.length && statSync(VIDEO).mtimeMs > Date.parse(versions[versions.length - 1].created) ? ' (render on disk is newer, will become the next version)' : ''}`);
  if (!open.length) console.log('no open notes');
  for (const n of open.sort((a, b) => a.version - b.version || a.frame - b.frame)) {
    const fps = versionMeta(n.version)?.fps ?? 30;
    console.log(`[${n.id}] v${n.version} frame ${n.frame} (${(n.frame / fps).toFixed(2)}s)${n.beat ? ` beat: ${n.beat}` : ''}\n  ${n.text || '(drawing only)'}\n  image: ${relative(join(DIR, `${n.id}.annotated.png`))}`);
  }
  process.exit(0);
}
if (flag('--done')) {
  const id = flag('--done');
  const notes = loadNotes();
  const n = notes.find((x) => x.id === id);
  if (!n) throw new Error(`no note ${id}`);
  n.status = 'done';
  if (typeof flag('--reply') === 'string') n.reply = flag('--reply');
  saveNotes(notes);
  console.log(`done: ${id}`);
  process.exit(0);
}

ensureVersion();
// Watch for re-renders: archive once the file stops growing.
let lastSize = -1;
setInterval(() => {
  if (!existsSync(VIDEO)) return;
  const size = statSync(VIDEO).size;
  if (size === lastSize) ensureVersion();
  lastSize = size;
}, 1500);

const UI = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');
const port = parseInt(flag('--port') ?? '5199', 10);

function videoResponse(req, v) {
  const file = Bun.file(vFile(v, '.proxy.mp4'));
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
    const v = parseInt(url.searchParams.get('v') ?? '0', 10);
    if (p === '/') return new Response(UI, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (p === '/video') return versionMeta(v) ? videoResponse(req, v) : new Response('no such version', { status: 404 });
    if (p === '/api/versions') {
      const notes = loadNotes();
      return json({ name: NAME, versions: loadVersions().map((x) => ({ ...x, notes: notes.filter((n) => n.version === x.v).length, open: notes.filter((n) => n.version === x.v && n.status !== 'done').length })) });
    }
    if (p === '/api/meta') return versionMeta(v) ? json({ name: NAME, ...versionMeta(v), events: eventsOf(v) }) : json({ error: 'no such version' }, 404);
    if (p === '/api/notes' && req.method === 'GET') return json(loadNotes());
    if (p === '/api/notes' && req.method === 'POST') {
      const body = await req.json();
      const version = body.version;
      if (!versionMeta(version)) return json({ error: 'no such version' }, 400);
      const notes = loadNotes();
      const id = `n${Date.now().toString(36)}`;
      const note = { id, version, frame: body.frame, time: +(body.frame / versionMeta(version).fps).toFixed(3), beat: beatAt(version, body.frame), text: body.text ?? '', author: body.author ?? '', status: 'open', created: new Date().toISOString(), drawing: !!body.png };
      if (body.png) writeFileSync(join(DIR, `${id}.png`), Buffer.from(body.png.split(',')[1], 'base64'));
      annotate(note);
      notes.push(note);
      saveNotes(notes);
      return json(note);
    }
    const m = p.match(/^\/api\/notes\/([\w-]+)(\/png)?$/);
    if (m) {
      const notes = loadNotes();
      const n = notes.find((x) => x.id === m[1]);
      if (!n) return json({ error: 'not found' }, 404);
      if (m[2]) {
        const f = join(DIR, `${n.id}.png`);
        return existsSync(f) ? new Response(Bun.file(f)) : new Response('', { status: 404 });
      }
      if (req.method === 'PATCH') {
        const { status, text } = await req.json();
        if (status) n.status = status;
        if (typeof text === 'string') n.text = text;
        saveNotes(notes);
        return json(n);
      }
      if (req.method === 'DELETE') {
        for (const f of [`${n.id}.png`, `${n.id}.annotated.png`]) if (existsSync(join(DIR, f))) unlinkSync(join(DIR, f));
        saveNotes(notes.filter((x) => x !== n));
        return json({ ok: true });
      }
    }
    return new Response('not found', { status: 404 });
  },
});

const link = `http://localhost:${port}/`;
const versions = loadVersions();
console.log(`review: ${link}  (${NAME}, v${versions[versions.length - 1]?.v ?? '?'}; watching ${relative(VIDEO)} for new renders)\nnotes:  ${relative(NOTES)}`);
if (!flag('--no-open')) openUrl(link);
