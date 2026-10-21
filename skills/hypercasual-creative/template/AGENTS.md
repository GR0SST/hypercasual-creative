# {{NAME}}: video ad creative

A 9:16 gameplay ad for a mobile game, built from the `hypercasual-creative` skill. Load that skill before working here (it has the references: fake-it, look, seek-sim, beats, audio, review, unity-assets). This file is enough to pick the work up in a new thread.

## What this project is

- A video, not a game. three.js gameplay scene + DOM/GSAP overlays, rendered to MP4 frame by frame in headless Chrome, sound mixed from the sim's event log.
- Gameplay is faked: a director layer (`src/sim/scenario.js`) scripts every beat (hero route, pickups and threats placed where the hero will be, slow-mo, forced events). Re-implement a rule only if it's cheaper than faking it.
- Brief: `BRIEF.md` (game, mechanic, hero, length, hook, payoff, packshot copy, CTA). Beats: header of `src/sim/scenario.js`.

## Rules

1. **Beat table before building.** No scenario code or renders until the user approves the beat table in chat (time · on screen · why). "Make a creative" is not approval.
2. **Fixed house look**: soft daylight, wide soft shadows, GTAO, a little bloom, pastel palette, clearcoat toy materials. Don't redesign `src/view/renderer.js` / `environment.js`.
3. **Stills in chat first** (`bun run shot …`), then video only in our review tool. Draft renders need no permission.
4. **Deterministic and seekable.** Sim is plain data at fixed dt, views are stateless. No `Math.random`, `Date.now`, `performance.now`, rAF loops in render code; use `src/sim/rng.js`. Async loads go through `waitFor()` (`src/ready.js`).
5. **60 fps** (`src/timing.js`). 30 only if a network demands it.
6. **Approved hero route/timing never changes.** Reshape the world around it.
7. No CSS `transform` on elements GSAP animates.
8. Game assets (models, textures, sounds) stay in this project, never in the skill repo.

## Where things are

- Sim (plain data, seek-replayed): `src/sim/`; rules in `world.js`, script/cues in `scenario.js`
- three.js views (stateless): `src/view/`; Unity models via `loadUnityModel()` in `unity.js`
- HUD + packshot: `src/overlay/`; packshot is a paused GSAP timeline seeked to video time
- Timing: `src/timing.js` · Sound design: `src/sound.mjs` (roles + Pixabay queries in `sfx.json`, files in `assets/audio/`)

## Loop

```bash
bun run bake                         # sim headless -> events.json + beat log (instant)
bun run map 2,4.75,9.5               # top-down map of the sim -> renders/map.png
bun run shot 1,5.4,9.5,12.5          # stills -> renders/shots/ + sheet.jpg (show in chat)
bun run render -o renders/<name>.mp4 # video + sound; keep one path per creative
```

## Review

- The agent starts it, not the user: `bun run review --no-open` **in the background**, then post `http://localhost:<port>/` in chat. It reuses a running server and picks the latest render. Tell the user they can reopen it any time with `bun run review`.
- User pauses on a frame, types and/or draws, adds a note, says "notes are in".
- `bun run review --list` gives the open notes (version, frame, time, beat, text) plus `review/<name>/<id>.annotated.png` (exact frame + drawing). Look at every PNG before fixing.
- Fix, re-render to the **same** path (it becomes v2, v3…, the browser switches to it), `bun run review --done <id> --reply "what changed"`, post the link again. Don't restart the server.

## State

Keep this short and current; it's how the next thread knows where we are.

- Beat table: not approved yet
- Current render: none
- Open notes: none
