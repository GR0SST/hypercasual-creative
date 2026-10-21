// Sample-accurate offline mixer (port of the Paper.io creative's mix_audio.py).
// Stereo float32 buses at 44.1 kHz; ffmpeg only decodes inputs and does the
// final loudness/limiter + mux. Used by src/sound.mjs (the per-creative
// sound design script).
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';

export const SR = 44100;

// Decode any audio file to interleaved stereo float32.
export function load(file, { offset = 0, duration } = {}) {
  const argv = ['-v', 'error', '-ss', String(offset)];
  if (duration) argv.push('-t', String(duration));
  argv.push('-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-');
  const buf = execFileSync('ffmpeg', argv, { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

// Drop leading silence so hits land exactly on their timestamps.
export function trimLead(x, thresh = 0.02) {
  for (let i = 0; i < x.length; i += 2) if (Math.abs(x[i]) > thresh || Math.abs(x[i + 1]) > thresh) return x.slice(i);
  return x;
}

export function peakNorm(x, peak = 0.9) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

// Piecewise-linear envelope over n frames from [[t, v], ...] (t in seconds).
export function envelope(points, frames) {
  const out = new Float32Array(frames);
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  let k = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / SR;
    while (k < pts.length - 2 && t > pts[k + 1][0]) k++;
    const [t0, v0] = pts[k];
    const [t1, v1] = pts[Math.min(k + 1, pts.length - 1)];
    out[i] = t <= t0 ? v0 : t >= t1 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return out;
}

// Time-varying one-pole low-pass; cutoff = per-frame Hz (Float32Array).
export function lowpass(x, cutoff) {
  let l = 0, r = 0;
  for (let i = 0, f = 0; i < x.length; i += 2, f++) {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff[f]) / SR);
    l += a * (x[i] - l);
    r += a * (x[i + 1] - r);
    x[i] = l;
    x[i + 1] = r;
  }
  return x;
}

export class Mixer {
  // roles: { name: { src, gain } } (from sfx.json). Missing files are skipped once, with a note.
  constructor({ duration, roles = {} }) {
    this.frames = Math.ceil(duration * SR);
    this.duration = duration;
    this.sfx = new Float32Array(this.frames * 2);
    this.roles = roles;
    this.cache = {};
    this.missing = new Set();
    this.lastAt = {};
  }

  clip(role) {
    if (role in this.cache) return this.cache[role];
    const r = this.roles[role];
    this.cache[role] = r && existsSync(r.src) ? peakNorm(trimLead(load(r.src))) : null;
    if (!this.cache[role]) this.missing.add(role);
    return this.cache[role];
  }

  // Lay a role at time t. maxLen trims (with an 80 ms fade), ramp = [startGain, endGain],
  // minGap skips repeats of the same role closer than that (bursts of pickups).
  fx(role, t, { gain = 1, maxLen, ramp, minGap } = {}) {
    if (minGap && this.lastAt[role] !== undefined && t - this.lastAt[role] < minGap) return;
    const src = this.clip(role);
    if (!src || t < 0) return;
    this.lastAt[role] = t;
    let c = src;
    if (maxLen) {
      c = c.slice(0, Math.floor(maxLen * SR) * 2);
      const fade = Math.min(c.length / 2, Math.floor(0.08 * SR));
      for (let i = 0; i < fade; i++) {
        const k = 1 - i / fade;
        c[c.length - 2 * (fade - i)] *= k;
        c[c.length - 2 * (fade - i) + 1] *= k;
      }
    }
    const g = gain * (this.roles[role]?.gain ?? 1);
    const at = Math.floor(t * SR) * 2;
    const n = Math.min(c.length, this.sfx.length - at);
    for (let i = 0; i < n; i++) {
      const rk = ramp ? ramp[0] + ((ramp[1] - ramp[0]) * i) / n : 1;
      this.sfx[at + i] += c[i] * g * rk;
    }
  }

  // Music bed from `start` (video time) using the track from `offset` s in.
  // gain/cutoff are [[t, v], ...] envelopes (duck + muffle under slow-mo, fade at the end).
  music(role, { start = 0, offset, gainPoints = [[0, 1]], cutoffPoints = [[0, 18000]] } = {}) {
    const r = this.roles[role];
    if (!r || !existsSync(r.src)) {
      this.missing.add(role);
      return;
    }
    const raw = load(r.src, { offset: offset ?? r.offset ?? 0, duration: this.duration - start });
    const m = new Float32Array(this.frames * 2);
    m.set(raw.subarray(0, Math.max(0, m.length - Math.floor(start * SR) * 2)), Math.floor(start * SR) * 2);
    lowpass(m, envelope(cutoffPoints, this.frames));
    const env = envelope(gainPoints, this.frames);
    const g = r.gain ?? 0.55;
    for (let f = 0; f < this.frames; f++) {
      m[2 * f] *= env[f] * g;
      m[2 * f + 1] *= env[f] * g;
    }
    this.musicBus = m;
  }

  // Sum, soft-clip (stacked hits stay punchy without crackle), loudness-normalize, mux.
  mux(video, out) {
    const mix = new Float32Array(this.frames * 2);
    const k = Math.tanh(1.1);
    for (let i = 0; i < mix.length; i++) mix[i] = Math.tanh(((this.musicBus?.[i] ?? 0) + this.sfx[i]) * 1.1) / k;
    const raw = `${out}.f32`;
    writeFileSync(raw, Buffer.from(mix.buffer));
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-i', video, '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw,
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.82:attack=2:release=50:level=disabled',
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out,
    ]);
    unlinkSync(raw);
    if (this.missing.size) {
      console.log(`sound: skipped roles without a file: ${[...this.missing].join(', ')}`);
      for (const role of this.missing) if (this.roles[role]?.query) console.log(`  ${role}: bun scripts/pixabay-grab.mjs "https://pixabay.com/${this.roles[role].query}/" 6 assets/audio/raw/${role}`);
    }
  }
}
