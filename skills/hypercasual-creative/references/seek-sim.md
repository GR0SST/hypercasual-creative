# Stateful sim, seekable frames

Frames are requested at arbitrary times: `bun run render` splits the video into chunks captured by parallel headless Chrome pages, each starting mid-video, and `bun run shot` jumps straight to the times you ask for. Our gameplay is a stepped simulation (damped camera, accumulating score, particles), so it can't be written as a pure `f(t)`. The bridge in `src/main.js`:

```
renderAt(t) → Seekable.seek(t) → view.sync(world) → hud.sync(world) → gsapTimeline.seek(t) → draw
```

- `Seekable.seek(t)`: steps forward at fixed `SIM_DT` (1/60) until `t`. If `t` is behind the current time, it **rebuilds the world and replays from 0**.
- Replay is cheap because the world is plain data: no three.js objects, no DOM. The same code runs in node (`bun run bake`, `bun run map`).
- `view.sync(world)` poses persistent three.js objects from state. Instanced meshes for gems/particles are refilled every frame.
- The HUD is pooled DOM, re-posed from state (popup `age` drives its animation).
- GSAP is only for time-pure overlays (packshot, title cards): one paused timeline, `tl.seek(t)` each frame.

## Rules
1. Gameplay state lives in `src/sim/**` only. A view that remembers anything between frames (a trail it extends, a particle it spawned) breaks seeking. Store it in the sim.
2. Fixed dt everywhere. `dt` passed to `step` is video time; gameplay uses `dt * timeScale`.
3. All randomness comes from seeded RNGs (`mulberry32`), split into gameplay and FX streams.
4. Load all assets before frame 0: wrap every async load in `waitFor()` (`src/ready.js`); capture waits for fonts and all of them.
5. Keep replay fast: a 30 s creative = 1800 steps per backward seek. If a step costs > ~2 ms, add checkpoints (serialize the world every N seconds; `structuredClone` works for plain data) and restore the nearest one.

## Verify
- `bun run shot a,b,c` with out-of-order times should look identical to the same frames in a render.
- After a render, compare frames on both sides of a chunk seam (840 frames / 6 workers → frames 139/140, 279/280). They must be continuous.
