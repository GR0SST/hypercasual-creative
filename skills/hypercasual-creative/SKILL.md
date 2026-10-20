---
name: hypercasual-creative
description: Build video ad creatives (UA creatives) for hypercasual / casual mobile games as scripted three.js scenes rendered with HyperFrames, in a soft toy-like look (bright daylight, soft shadows, AO, light bloom, clearcoat materials). Use when someone wants a gameplay ad, playable-style video, UA creative, or "a video for our game" from a mechanic description, a reference video, or a Unity project with assets. Covers intake, beat sheet, faked gameplay via a director layer, stills-first sign-off, SFX synced to events, packshot/end card, rendering, and a frame-accurate review tool with comments and drawings.
license: MIT
compatibility: Needs bun, ffmpeg/ffprobe, Google Chrome (macOS path assumed by helper scripts) and the HyperFrames CLI (`bunx hyperframes`). Works best with the HyperFrames skills installed (hyperframes, hyperframes-core, hyperframes-animation).
metadata:
  version: "0.1.0"
---

# Hypercasual creative

Make a 9:16 gameplay ad for a mobile game that looks like the game (or better) without rebuilding the game. The output is a HyperFrames project: three.js gameplay scene + DOM/GSAP overlays + SFX, rendered to MP4 and reviewed frame by frame in the browser.

## Core rules

1. **It is a video, not a game. Fake it.** Re-implement only the rules that are cheaper to run than to fake. Everything that has to land on a beat (a kill, a near miss, a big capture, a growth burst) is a director cue that can override any rule: teleport, pre-stamp land, force an event, slow-mo, hide a swap under an FX burst. If faking reads the same on video, fake it. Read `references/fake-it.md`.
2. **House look is fixed**: soft bright daylight, wide soft shadows, GTAO contact shadows, a *little* bloom (people asked for less every time), saturated pastel palette, clearcoat toy materials, thick stroked toy typography. The template already has it; don't redesign the renderer per project. Read `references/look.md` before touching lights or materials.
3. **Stills in chat, then video in OUR review tool.** Show key-frame snapshots in chat for layout sign-off. After that, the user reviews video only in `scripts/review` (frame comments + drawing), **never in HyperFrames Studio/preview**. Renders are cheap (≈1.2 s per second of video), so don't ask permission to render a draft: render it, start the review server, post its link. This overrides the HyperFrames skills' "open Studio preview, then ask before render" step.
4. **Deterministic and seekable.** Sim = plain data stepped at fixed dt, replayed on backward seeks; views are stateless; FX randomness uses its own RNG so FX tweaks never change gameplay. Read `references/seek-sim.md`.
5. **60 fps by default.** Root `data-fps="60"` + `FPS = 60` in `timing.js`; the sim steps at 1/60, so each output frame is exactly one sim step. Drop to 30 only when a network demands it.
6. **Once the hero's route/timing is approved, don't change it.** Reshape the world around it (move enemies, stamp land, retime pickups) instead.

## Workflow

### 1. Intake → brief
Inputs come in three shapes; mix freely. Details: `references/intake.md`.
- **Text description of the mechanic**: ask only what changes the video (core verb, fail state, progression, the satisfying moment, hero look, game name/icon, length).
- **Reference video** (existing ad or gameplay capture): run `scripts/ref-breakdown.sh <video>` for scene cuts + contact sheet + per-second frames; watch them, then write down mechanics, camera, HUD, pacing. If the user says "like this but…", copy the structure, not the hook.
- **Unity project**: explore it yourself with `scripts/unity/unity.mjs` (`scan` → `find`/`deps` → `export`): prefabs → GLB + material colors + converted `.anim` clips, loaded with `loadUnityModel()` from `template/src/view/unity.js`. Also take the icon and fonts. See `references/unity-assets.md`. Use real assets whenever they exist; placeholders only until then.

Write `BRIEF.md` in the project: game, mechanic, hero, rivals, length (15/30 s), hook idea, payoff, packshot copy, CTA.

### 2. Beat sheet
Write the beats with video times into the header of `src/sim/scenario.js` and show them as a table in chat. Pattern library and timing norms: `references/beats.md`. Get approval before building.

### 3. Scaffold
```bash
bun <this-skill>/scripts/new-project.mjs <project-dir>
cd <project-dir> && bun run bake          # headless sim -> events.json + beat log
```
The template is a working 14 s demo (blob eats gems, combo, slow-mo near miss, big gem, packshot). Replace the mechanic in place:
- `src/sim/world.js`: game state and (fake) rules. Plain data only.
- `src/sim/scenario.js`: the script: hero route, pre-rolled path, dressing (pickups/threats placed where the hero WILL be), director cues.
- `src/view/*`: three.js meshes that pose from sim state (`actors.js` for the hero/props, `environment.js` for the world).
- `src/overlay/*`: HUD + popups (from sim state) and packshot (GSAP on the root timeline).
- `src/timing.js`: FPS, packshot time, duration. Keep `data-duration` in `index.html` equal to `DURATION`.

### 4. Iterate on timing headless, then stills
- `bun run bake` prints positions/score per 0.5 s and every cue/event. Fix beat timing here first; it's instant.
- `bunx hyperframes snapshot --at 1,2.2,5.4,9.5,12.5 --no-end` → look at the contact sheet, then show the user the frames in chat for sign-off.
- `bunx hyperframes preview` (Studio) is for **your own** debugging only. Don't send its link to the user; the user's review surface is step 7.

### 5. Sound
The template ships **no sounds**. Every role in `sfx.json` has a Pixabay search `query` that worked before. Grab candidates with `scripts/pixabay-grab.mjs`, pick by listening (Gemini if available), and save the winners under the `src` names. Then `bun run bake && bun run sfx` turns `events.json` + `sfx.json` into `<audio>` clips in `index.html` (event type or `cue:<label>` → sound). Missing files are skipped with the grab command printed. Details: `references/audio.md`.

### 6. Render
```bash
bunx hyperframes lint && bunx hyperframes render -o renders/<name>.mp4
```
Keep one output path per creative. The review server versions every render of that path (`review/<name>/vN.mp4`), so nothing approved is lost. Draft renders need no approval: as soon as the stills are signed off, render and go to step 7.

### 7. Review loop
**You start the review server, not the user.** After the first render:
1. Check whether one is already up for this video: `curl -s localhost:5199/api/versions`. If it answers with this video's `name`, reuse it; it picks up new renders by itself.
2. Otherwise start it **in the background** (it must outlive your command) and leave it running for the whole iteration:
   ```bash
   bun run review renders/<name>.mp4 --no-open      # add --port 5300 if 5199 is taken by another video
   ```
3. **Post the link in chat**: `http://localhost:<port>/`, plus one line on how to use it: pause on a frame, type and/or draw, Add note, then tell me "notes are in". If you're on a remote machine or sandbox, say where it runs, since localhost may not reach the user.

When the user says the notes are in:
```bash
bun run review renders/<name>.mp4 --list                                   # open notes + annotated frame PNGs
bun run review renders/<name>.mp4 --done <id> --reply "moved rival 0.6 s behind"
```
Read every `*.annotated.png` (exact frame + strokes) before fixing. Each note carries version, frame, time, and the active director beat. After fixes, **re-render to the same output path**: the running server archives it as the next version (v2, v3…) and the user's browser switches to it with a clean sheet (old notes stay on their version). Close the fixed notes with `--done … --reply`, then post the link again with what changed. Don't restart the server between versions. Details: `references/review.md`.

## Gotchas

- HyperFrames lint only sees inline scripts: the root timeline is registered inline in `index.html`, the module appends to it. Keep it that way.
- Never put a CSS `transform` on an element GSAP animates (lint `gsap_css_transform_conflict`). Center with `left/right/margin:auto`.
- No `Math.random`, `Date.now`, `performance.now` or rAF loops in render-critical code. Use `sim/rng.js`.
- Views must not accumulate state across frames (trails, particles, popups all come from sim state).
- Render workers seek to chunk starts in parallel; sim replay from 0 must be cheap (keep sim < ~5 ms per simulated second; add checkpoints if heavier).
- `bunx` works where `npx` may not (root-owned npm cache on some machines).
- `hyperframes check` contrast audit ignores `-webkit-text-stroke`, so stroked toy text always "fails"; use `bun run check` (`--no-contrast`) and judge readability on stills. Intentional overlaps (popups, hand over CTA) carry `data-layout-allow-*` attributes.
- Fonts: ship local `@font-face` files (lint `font_family_without_font_face`).

## Files

- `template/`: the project scaffold (copied by `scripts/new-project.mjs`)
- `scripts/new-project.mjs`, `scripts/ref-breakdown.sh`, `scripts/pixabay-grab.mjs`, `scripts/unity/unity.mjs` (+ `fbx2glb.py`, fallback `CreativeExport.cs`)
- `references/`: `fake-it.md`, `look.md`, `seek-sim.md`, `beats.md`, `intake.md`, `unity-assets.md`, `audio.md`, `review.md`, `case-paperio.md` (the creative this skill was distilled from)
