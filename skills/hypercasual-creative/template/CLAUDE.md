# Creative project (hypercasual-creative skill)

Built from the `hypercasual-creative` skill template. Load that skill before working here.

- Sim (plain data, seek-replayed): `src/sim/` — rules in `world.js`, script/cues in `scenario.js`
- three.js views (stateless): `src/view/` — house look in `renderer.js` / `environment.js`
- HUD + packshot: `src/overlay/` — packshot on the root GSAP timeline
- Timing: `src/timing.js` (keep `data-duration` in `index.html` equal to `DURATION`)

Loop: `bun run bake` → `bunx hyperframes snapshot --at …` → `bun run sfx` → `bunx hyperframes render -o renders/<name>.mp4` → `bun run review renders/<name>.mp4`.
