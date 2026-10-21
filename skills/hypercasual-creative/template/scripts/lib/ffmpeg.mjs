// ffmpeg + ffprobe without asking the user to install anything:
//   1. FFMPEG= / FFPROBE= env paths, if set;
//   2. the system ones on PATH, if both exist and ffmpeg has libx264;
//   3. otherwise a static build downloaded ONCE per machine into
//      ~/.cache/hypercasual-creative/ffmpeg/<version>/ (never into the project).
//   import { ff } from './lib/ffmpeg.mjs';
//   const { ffmpeg, ffprobe } = await ff();
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VERSION = 'b6.1.1';
const BASE = `https://github.com/eugeneware/ffmpeg-static/releases/download/${VERSION}`;
const EXE = process.platform === 'win32' ? '.exe' : '';
const SUPPORTED = { darwin: ['arm64', 'x64'], win32: ['x64'], linux: ['x64', 'arm64', 'arm', 'ia32'] };

const works = (bin, args = ['-version']) => {
  try {
    return execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }).toString();
  } catch {
    return null;
  }
};

let cached;
export async function ff() {
  if (cached) return cached;
  if (process.env.FFMPEG && process.env.FFPROBE) return (cached = { ffmpeg: process.env.FFMPEG, ffprobe: process.env.FFPROBE, source: 'env' });

  // System install: use it, download nothing.
  if (!process.env.FFMPEG_DOWNLOAD && works('ffprobe') && /libx264/.test(works('ffmpeg', ['-hide_banner', '-encoders']) ?? '')) {
    return (cached = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', source: 'system' });
  }

  const dir = join(homedir(), '.cache', 'hypercasual-creative', 'ffmpeg', VERSION);
  const paths = { ffmpeg: join(dir, `ffmpeg${EXE}`), ffprobe: join(dir, `ffprobe${EXE}`) };
  if (!(existsSync(paths.ffmpeg) && existsSync(paths.ffprobe))) {
    const { platform, arch } = process;
    if (!SUPPORTED[platform]?.includes(arch)) throw new Error(`no ffmpeg found and no static build for ${platform}-${arch}: install ffmpeg and put it on PATH`);
    mkdirSync(dir, { recursive: true });
    for (const tool of ['ffmpeg', 'ffprobe']) {
      if (existsSync(paths[tool])) continue;
      const url = `${BASE}/${tool}-${platform}-${arch}.gz`;
      console.log(`ffmpeg not found on this machine: downloading ${tool} once to ${dir} …`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`);
      writeFileSync(paths[tool], gunzipSync(Buffer.from(await res.arrayBuffer())));
      if (!EXE) chmodSync(paths[tool], 0o755);
    }
  }
  if (!works(paths.ffmpeg)) throw new Error(`downloaded ffmpeg at ${paths.ffmpeg} does not run; install ffmpeg and put it on PATH`);
  return (cached = { ...paths, source: 'download' });
}
