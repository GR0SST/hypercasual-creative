---
name: hypercasual-creative
description: Build video ad creatives (UA creatives) for hypercasual / casual mobile games as scripted three.js scenes rendered frame-exact in headless Chrome, in a soft toy-like look (bright daylight, soft shadows, AO, light bloom, clearcoat materials). Use when someone wants a gameplay ad, playable-style video, UA creative, or "a video for our game" from a mechanic description, a reference video, or a Unity project with assets. Covers intake, beat sheet, faked gameplay via a director layer, stills-first sign-off, SFX synced to events, packshot/end card, rendering, and a frame-accurate review tool with comments and drawings.
license: MIT
compatibility: macOS and Windows (Linux should work, untested). Needs bun and Google Chrome (or Edge/Chromium; auto-detected, override with CHROME=). ffmpeg/ffprobe: the system ones if installed, otherwise a static build is downloaded once per machine to ~/.cache/hypercasual-creative/ (override with FFMPEG=/FFPROBE=). Blender only for Unity export (auto-detected, override with BLENDER=). No video framework: the project renders itself.
metadata:
  version: "0.3.1"
---

# Hypercasual creative

Make a 9:16 gameplay ad for a mobile game that looks like the game (or better) without rebuilding the game. The output is a small web project: three.js gameplay scene + DOM/GSAP overlays, rendered to MP4 by its own parallel frame capture, with sound mixed sample-accurately from the sim's event log, and reviewed frame by frame in our review tool.

## Core rules

0. **Beat table first, then STOP.** Before building anything (no scenario code, no renders), post the beat table in chat and end your turn. Wait for the user's OK or edits. A request like "make a creative for X" is NOT approval of the beats. Skip this only if the user explicitly says to build without approval.
1. **It is a video, not a game. Fake it.** Re-implement only the rules that are cheaper to run than to fake. Everything that has to land on a beat (a kill, a near miss, a big capture, a growth burst) is a director cue that can override any rule: teleport, pre-stamp land, force an event, slow-mo, hide a swap under an FX burst. If faking reads the same on video, fake it. Read `references/fake-it.md`.
2. **House look is fixed**: soft bright daylight, wide soft shadows, GTAO contact shadows, a *little* bloom (people asked for less every time), saturated pastel palette, clearcoat toy materials, thick stroked toy typography. The template already has it; don't redesign the renderer per project. Read `references/look.md` before touching lights or materials.
3. **Stills in chat, then video in OUR review tool.** Show key-frame snapshots in chat for layout sign-off. After that, the user reviews video only in `scripts/review` (frame comments + drawing); `bun run dev` is for your own debugging. Renders are cheap (≈1.4 s per second of 60 fps video incl. sound), so don't ask permission to render a draft: render it, start the review server, post its link. (This doesn't replace rule 0: the beat table is still approved before building.)
4. **Deterministic and seekable.** Sim = plain data stepped at fixed dt, replayed on backward seeks; views are stateless; FX randomness uses its own RNG so FX tweaks never change gameplay. Read `references/seek-sim.md`.
5. **60 fps by default.** `FPS = 60` in `timing.js`; the sim steps at 1/60, so each output frame is exactly one sim step. Drop to 30 only when a network demands it.
6. **Once the hero's route/timing is approved, don't change it.** Reshape the world around it (move enemies, stamp land, retime pickups) instead.

## Workflow

### 1. Intake → brief
Inputs come in three shapes; mix freely. Details: `references/intake.md`.
- **Text description of the mechanic**: ask only what changes the video (core verb, fail state, progression, the satisfying moment, hero look, game name/icon, length).
- **Reference video** (existing ad or gameplay capture): run `scripts/ref-breakdown.mjs <video>` for scene cuts + contact sheet + per-second frames; watch them, then write down mechanics, camera, HUD, pacing. If the user says "like this but…", copy the structure, not the hook.
- **Unity project**: explore it yourself with `scripts/unity/unity.mjs` (`scan` → `find`/`deps` → `export`): prefabs → GLB + material colors + converted `.anim` clips, loaded with `loadUnityModel()` from `template/src/view/unity.js`. Also take the icon and fonts. See `references/unity-assets.md`. Use real assets whenever they exist; placeholders only until then.

Write `BRIEF.md` in the project: game, mechanic, hero, rivals, length (15/30 s), hook idea, payoff, packshot copy, CTA.

### 2. Beat sheet
**Hard gate.** Post the beats as a table in chat: time range · what happens on screen · why (hook / loop / escalation / clutch / payoff / packshot). Add the total length and what's placeholder (hero, enemies, icon, sound). Then **end your turn and wait**. Don't scaffold the scenario, write gameplay or render until the user approves or edits the table. Revise only the rows they name and re-post. Pattern library and timing norms: `references/beats.md`.

| Time | On screen | Why |
|---|---|---|
| 0–3 s | Sky drop onto the arena, camera lands on the hero | hook |
| 3–8 s | Three fast captures, % climbs | core loop |
| … | … | … |
| 22–26 s | Blurred game, icon, logo, PLAY NOW, hand taps | packshot |

After approval, write the same beats with video times into the header of `src/sim/scenario.js`.

### 3. Scaffold
```bash
bun <this-skill>/scripts/new-project.mjs <project-dir>
cd <project-dir> && bun run bake          # headless sim -> events.json + beat log
```
The scaffold writes `AGENTS.md` (what the project is, the rules, the loop, how review works) and `CLAUDE.md` → `AGENTS.md`, so a new thread opened in the project already knows the job. **Keep its `## State` section current** (beat table approved or not, current render path, review port, open notes, decisions the user made) every time one of these changes; add project-specific rules the user gives you to `## Rules`.

The template is a working 14 s demo (blob eats gems, combo, slow-mo near miss, big gem, packshot). Replace the mechanic in place:
- `src/sim/world.js`: game state and (fake) rules. Plain data only.
- `src/sim/scenario.js`: the script: hero route, pre-rolled path, dressing (pickups/threats placed where the hero WILL be), director cues.
- `src/view/*`: three.js meshes that pose from sim state (`actors.js` for the hero/props, `environment.js` for the world).
- `src/overlay/*`: HUD + popups (from sim state) and packshot (paused GSAP timeline, seeked to video time).
- `src/sound.mjs`: sound design (event → sound, layers, music ducking).
- `src/timing.js`: FPS, packshot time, duration (single source of truth).
- `src/main.js`: `renderAt(t)` = replay sim to t → pose views → seek GSAP → draw. Register async loads with `waitFor()` from `src/ready.js`.

### 4. Iterate on timing headless, then stills
- `bun run bake` prints positions/score per 0.5 s and every cue/event. Fix beat timing here first; it's instant.
- `bun run map 2,4.75,5.6,9.5` draws a top-down map of the sim at those times → `renders/map.png` (planned and travelled hero path, pickups, rivals and their runs, particles). Use it to check *where* things are on each beat (does the threat cross behind the hero, are pickups on the route) without rendering. Add the game's own layers (territory, trails…) in `src/sim/map.mjs` → GAME LAYERS.
- `bun run shot 1,2.2,5.4,9.5,12.5` → `renders/shots/t<time>.png` + `renders/shots/sheet.jpg`. Look at the sheet, then show the user the frames in chat for sign-off.
- `bun run dev` serves a live, looping preview (`?t=5.4` holds a still) for your own debugging. Don't send it to the user; the user's review surface is step 7.

### 5. Sound
The template ships **no sounds**. Every role in `sfx.json` has a Pixabay search `query` that worked before. Grab candidates with `scripts/pixabay-grab.mjs` (in the project), pick (listen if a tool can), and save the winners under the `src` names. `src/sound.mjs` is the sound design: it reads `events.json` (every gameplay event and director cue, in video time) and lays roles sample-accurately, layers hits, ducks + muffles the music under slow-mo, adds end-card stings, then soft-clips and loudness-normalizes (−14 LUFS). Edit it per creative like the scenario. It runs automatically at the end of `bun run render`; roles without a file are skipped with the grab command printed. Details: `references/audio.md`.

### 6. Render
```bash
bun run render -o renders/<name>.mp4        # [--workers 6] [--fps 30] [--no-sound]
```
Splits the frames across parallel headless Chrome pages (each replays the sim to its chunk start), encodes chunks with ffmpeg, concatenates, mixes sound.
Keep one output path per creative. The review server versions every render of that path (`review/<name>/vN.mp4`), so nothing approved is lost. Draft renders need no approval: as soon as the stills are signed off, render and go to step 7.

### 7. Review loop
**You start the review server, not the user.** After the first render, run in the **background** (it must outlive your command) and leave it running for the whole iteration:
```bash
bun run review --no-open      # latest video in renders/; reuses a running server; next free port if 5199 is another video's
```
**Post the link in chat** (`http://localhost:<port>/`, printed by the command) plus one line on how to use it: pause on a frame, type and/or draw, Add note, then tell me "notes are in". Also tell the user they can reopen it themselves any time with `bun run review` in the project folder. If you're on a remote machine or sandbox, say where it runs, since localhost may not reach the user.

When the user says the notes are in:
```bash
bun run review --list                                   # open notes + annotated frame PNGs
bun run review --done <id> --reply "moved rival 0.6 s behind"
```
Read every `*.annotated.png` (exact frame + strokes) before fixing. Each note carries version, frame, time, and the active director beat. After fixes, **re-render to the same output path**: the running server archives it as the next version (v2, v3…) and the user's browser switches to it with a clean sheet (old notes stay on their version). Close the fixed notes with `--done … --reply`, then post the link again with what changed. Don't restart the server between versions. Details: `references/review.md`.

## Gotchas

- Never put a CSS `transform` on an element GSAP animates (they fight). Center with `left/right/margin:auto`.
- No `Math.random`, `Date.now`, `performance.now` or rAF loops in render-critical code. Use `sim/rng.js`.
- Views must not accumulate state across frames (trails, particles, popups all come from sim state).
- Render workers seek to chunk starts in parallel; sim replay from 0 must be cheap (keep sim < ~5 ms per simulated second; add checkpoints if heavier).
- Anything async the first frame needs (GLB, textures, clip JSON) goes through `waitFor(promise)`; capture waits for fonts + all of it before frame 0.
- Check chunk seams after a render: with 6 workers on 840 frames, frames 139/140 and 279/280 must be continuous.
- Fonts: ship local `@font-face` files; use the game's own font when the Unity project has one.

## Files

- `template/`: the project scaffold (copied by `scripts/new-project.mjs`); its `scripts/` has `render`, `shot`, `dev`, `pixabay-grab`, `review/`, `lib/mixer`
- `scripts/new-project.mjs`, `scripts/ref-breakdown.mjs`, `scripts/unity/unity.mjs` (+ `fbx2glb.py`, fallback `CreativeExport.cs`)
- `references/`: `fake-it.md`, `look.md`, `seek-sim.md`, `beats.md`, `intake.md`, `unity-assets.md`, `audio.md`, `review.md`, `case-paperio.md` (the creative this skill was distilled from)
