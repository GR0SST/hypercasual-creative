import { mulberry32, clamp, damp, wrapAngle } from './rng.js';
import { Director } from './director.js';

// Example mechanic: a blob rolls along a scripted route, eats gems and grows.
// Replace this file with the game's own (fake) rules. Contract:
//   - plain data only (runs in node for `bun run bake`, replayed on seek)
//   - step(dt) where dt is VIDEO time; gameplay runs at dt * timeScale
//   - everything FX-only draws from fxRng, never from the gameplay rng
export function createWorld(seed = 7) {
  const rng = mulberry32(seed);
  const fxRng = mulberry32(seed * 7919 + 1);

  const w = {
    clock: 0, // video seconds
    time: 0, // gameplay seconds (slows down under slow-mo)
    timeScale: 1,
    timeScaleGoal: 1,
    rng,
    fxRng,
    director: new Director(),
    events: [],
    score: 0,
    player: { x: 0, z: 0, heading: -Math.PI / 2, speed: 9, turnRate: 3.4, size: 1, sizeGoal: 1, squash: 0, route: [], wp: 0 },
    rivals: [],
    gems: [],
    particles: [],
    popups: [],
    cam: { x: 0, z: 0, dist: 30, distGoal: 30, fov: 38, punch: 0, kick: 0, trauma: 0, focus: 0, focusGoal: 0, t: 0 },
    flags: { hud: true, packshot: false },
  };

  w.emit = (type, data = {}) => w.events.push({ vt: +w.clock.toFixed(4), t: +w.time.toFixed(4), type, ...data });

  w.burst = (x, y, z, color, n = 14, power = 7) => {
    for (let i = 0; i < n; i++) {
      const a = fxRng() * Math.PI * 2;
      const s = power * (0.4 + fxRng() * 0.6);
      w.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: 4 + fxRng() * power, vz: Math.sin(a) * s, age: 0, life: 0.6 + fxRng() * 0.5, size: 0.18 + fxRng() * 0.2, color, spin: fxRng() * 6 });
    }
  };

  w.popup = (text, x, z, kind = 'small') => w.popups.push({ text, x, y: 2, z, age: 0, life: kind === 'big' ? 1.4 : 0.8, kind });

  w.step = (dt) => {
    w.clock += dt;
    w.director.update(w, w.clock);
    w.timeScale += (w.timeScaleGoal - w.timeScale) * damp(10, dt);
    const sdt = dt * w.timeScale;
    w.time += sdt;
    stepPlayer(w, sdt);
    stepRivals(w, sdt);
    stepGems(w, sdt);
    stepFx(w, sdt);
    stepCam(w, dt);
  };

  return w;
}

function stepPlayer(w, dt) {
  const p = w.player;
  const goal = p.route[p.wp];
  if (goal) {
    const dx = goal[0] - p.x;
    const dz = goal[1] - p.z;
    if (Math.hypot(dx, dz) < 1.4) p.wp++;
    const want = Math.atan2(dz, dx);
    const d = wrapAngle(want - p.heading);
    p.heading += clamp(d, -p.turnRate * dt, p.turnRate * dt);
  }
  p.x += Math.cos(p.heading) * p.speed * dt;
  p.z += Math.sin(p.heading) * p.speed * dt;
  p.size += (p.sizeGoal - p.size) * damp(6, dt);
  p.squash *= Math.exp(-8 * dt);
}

// Rivals are not AI: each one is a keyframed path (fake it, it's a video).
function stepRivals(w, dt) {
  for (const r of w.rivals) {
    if (w.time < r.t0 || w.time > r.t1) {
      r.visible = false;
      continue;
    }
    r.visible = true;
    const u = (w.time - r.t0) / (r.t1 - r.t0);
    const nx = r.from[0] + (r.to[0] - r.from[0]) * u;
    const nz = r.from[1] + (r.to[1] - r.from[1]) * u;
    r.heading = Math.atan2(nz - r.z, nx - r.x) || r.heading;
    r.x = nx;
    r.z = nz;
  }
}

function stepGems(w, dt) {
  const p = w.player;
  const reach = 1.1 * p.size + 0.5;
  for (const g of w.gems) {
    g.spin += dt * 2.5;
    if (g.taken) {
      g.age += dt;
      continue;
    }
    if (Math.hypot(g.x - p.x, g.z - p.z) < reach) {
      g.taken = true;
      g.age = 0;
      w.score += g.value;
      p.sizeGoal += g.value * 0.012;
      p.squash = Math.min(1, p.squash + 0.35);
      w.cam.punch = Math.min(1, w.cam.punch + (g.big ? 1 : 0.12));
      w.burst(g.x, 0.8, g.z, g.color, g.big ? 40 : 8, g.big ? 12 : 6);
      w.popup(`+${g.value}`, g.x, g.z, g.big ? 'big' : 'small');
      w.emit(g.big ? 'bigGem' : 'gem', { value: g.value, score: w.score });
      if (!g.big && w.score % 10 === 0) {
        w.popup(`x${w.score} COMBO!`, p.x, p.z, 'big');
        w.cam.kick = Math.min(1.4, w.cam.kick + 0.6);
        w.emit('combo', { n: w.score / 10 });
      }
    }
  }
}

function stepFx(w, dt) {
  for (const q of w.particles) {
    q.age += dt;
    q.vy -= 22 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.z += q.vz * dt;
    if (q.y < q.size) {
      q.y = q.size;
      q.vy *= -0.35;
      q.vx *= 0.7;
      q.vz *= 0.7;
    }
  }
  w.particles = w.particles.filter((q) => q.age < q.life);
  for (const u of w.popups) u.age += dt;
  w.popups = w.popups.filter((u) => u.age < u.life);
}

// Camera is sim state too (it is stateful: damping, kicks). View only applies it.
function stepCam(w, dt) {
  const c = w.cam;
  const p = w.player;
  c.t += dt;
  const look = 2.2;
  const gx = p.x + Math.cos(p.heading) * look;
  const gz = p.z + Math.sin(p.heading) * look;
  const k = damp(3.5, dt);
  c.x += (gx - c.x) * k;
  c.z += (gz - c.z) * k;
  c.distGoal = 26 + p.size * 4;
  c.dist += (c.distGoal - c.dist) * damp(2.5, dt);
  c.focus += (c.focusGoal - c.focus) * damp(4, dt);
  c.punch *= Math.exp(-6 * dt);
  c.kick *= Math.exp(-2.6 * dt);
  c.trauma = Math.max(0, c.trauma - dt * 1.4);
  c.fov = 38 + c.kick * 9 - c.focus * 8;
}
