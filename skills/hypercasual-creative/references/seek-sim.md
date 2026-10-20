# Stateful sim inside a seekable HyperFrames composition

HyperFrames renders by seeking: Studio scrubs in any order, and `render` splits the video into chunks captured by parallel workers, each starting mid-video. A three.js layer gets `hf-seek` events with `detail.time` and must draw exactly that time.

Our gameplay is a stepped simulation (damped camera, accumulating score, particles), so it can't be written as a pure `f(t)`. The bridge:

```
hf-seek(t) → Seekable.seek(t) → view.sync(world) → hud.sync(world) → render
```

- `Seekable.seek(t)`: steps forward at fixed `SIM_DT` (1/60) until `t`. If `t` is behind the current time, it **rebuilds the world and replays from 0**.
- Replay is cheap because the world is plain data: no three.js objects, no DOM. The same code runs in node (`bun run bake`).
- `view.sync(world)` poses persistent three.js objects from state. Instanced meshes for gems/particles are refilled every frame.
- The HUD is pooled DOM, re-posed from state (popup `age` drives its animation).
- GSAP is only for time-pure overlays (packshot, title cards). They live on the root timeline `window.__timelines.main`, which is registered inline in `index.html` (lint requirement); `main.js` appends tweens to it.

## Rules
1. Gameplay state lives in `src/sim/**` only. A view that remembers anything between frames (a trail it extends, a particle it spawned) breaks seeking. Store it in the sim.
2. Fixed dt everywhere. `dt` passed to `step` is video time; gameplay uses `dt * timeScale`.
3. All randomness comes from seeded RNGs (`mulberry32`), split into gameplay and FX streams.
4. Load all assets before the first render-critical seek. GLTF via `DefaultLoadingManager` is waited on; for heavy custom setup, register `window.__hf.buildReady[key] = promise`.
5. Keep replay fast: a 30 s creative = 1800 steps per backward seek. If a step costs > ~2 ms, add checkpoints (serialize the world every N seconds; `structuredClone` works for plain data) and restore the nearest one.

## Verify
- `bunx hyperframes snapshot --at a,b,c --no-end` with out-of-order times should look identical to a sequential render at those times.
- Render, then compare frames on both sides of a worker boundary (14 s × 60 fps = 840 frames / 4 workers → frames 209/210). They must be continuous.
