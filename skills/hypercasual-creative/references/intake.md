# Intake: from what the user gives you to BRIEF.md

## A. Text description of a mechanic
Ask only what changes the video, in one message:
1. Core verb (swipe to steer, tap to stack, drag to merge…) and what success looks like on screen.
2. Fail state, and whether we tease it (fail bait) or never show it.
3. Progression signal: score, %, size, rank, level bar.
4. The single most satisfying moment of the game.
5. Hero and enemies (or "use placeholders"), game name, icon, CTA copy.
6. Length (15 / 30 s) and any reference ad.
Then write `BRIEF.md` and a beat table (`beats.md`).

## B. Reference video
```bash
bun <skill>/scripts/ref-breakdown.mjs path/to/ref.mp4      # -> ref/<name>/
```
Output: `cuts.txt` (scene-change timestamps), `cut_###.jpg` (first frame of every shot), `sec_###.jpg` (1 frame per second), `sheet.jpg` (contact sheet). Read the sheet first, then individual frames where something happens.
If a video-capable model is available (e.g. Gemini with `GEMINI_API_KEY`), also ask it for a timed description of motion, camera and sound, because stills miss timing and easing.
Write down: mechanic, camera (angle, follow, zooms), HUD elements, beat timings, the hook, the packshot, the music energy. Build our version of the structure; don't clone the hook.

## C. Unity project
Goal: real hero/props/colors/fonts/icon/animations in the creative. The agent digs through the project itself with `scripts/unity/unity.mjs` (read-only, no Unity install needed). Full guide: `unity-assets.md`.
1. `scan`: name, icon, fonts, hero/enemy/collectible candidates.
2. `find` / `deps`: pick the right prefab (variants and old copies are common), check colors and what's hidden in the game.
3. `export` → GLB + `.unity.json` manifest + converted `.anim` clips into `assets/models/`, then `loadUnityModel()` in the view.
4. Copy the icon and the game's font into `assets/` for the packshot/HUD.
5. Gameplay code is a reference only. Read it for speeds, sizes and rules, then fake (`fake-it.md`).

## BRIEF.md template
```md
# <Game> — <creative name>
Game / store name:
Mechanic (one sentence):
Hero:            Enemies:
Length: 30 s     Format: 1080x1920
Hook:
Payoff:
Clutch moments:
Packshot: icon, logo, tagline "…", CTA "PLAY NOW"
Assets: (Unity path / placeholders)
References:
```
