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
bash <skill>/scripts/ref-breakdown.sh path/to/ref.mp4      # -> ref/<name>/
```
Output: `cuts.txt` (scene-change timestamps), `cut_###.jpg` (first frame of every shot), `sec_###.jpg` (1 frame per second), `sheet.jpg` (contact sheet). Read the sheet first, then individual frames where something happens.
If a video-capable model is available (e.g. Gemini with `GEMINI_API_KEY`), also ask it for a timed description of motion, camera and sound, because stills miss timing and easing.
Write down: mechanic, camera (angle, follow, zooms), HUD elements, beat timings, the hook, the packshot, the music energy. Build our version of the structure; don't clone the hook.

## C. Unity project
Goal: real hero/props/textures/colors/fonts/icon in the creative. See `unity-assets.md`.
1. Find the hero, enemies and props: `Assets/**/Prefabs`, `Assets/**/Models`, `*.fbx`, `*.prefab`. Grep scene/prefab YAML for names the user mentions.
2. Colors: read materials (`*.mat` YAML, `_BaseColor` / `_Color`), and gameplay configs (ScriptableObjects `*.asset`) for skins/palettes.
3. UI: fonts (`*.ttf/*.otf`), app icon (`ProjectSettings` → icons, or `Assets/**/Icon*`), logo sprites.
4. Export models to GLB (batch-mode script or FBX2glTF). Put them in `assets/models/`, load with `GLTFLoader` before the first seek, and keep the root/body split from `view/actors.js`.
5. Custom shaders don't survive export: rebuild the look with `MeshPhysicalMaterial` using the material's colors/textures (house look wins over the exact shader).
6. Gameplay code is a reference only. Read it for speeds, sizes and rules, then fake (`fake-it.md`).

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
