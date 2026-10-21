# hypercasual-creative

An agent skill for making **video ad creatives for hypercasual mobile games**: a scripted three.js gameplay scene in a soft toy-like look, rendered frame-exact by the project itself (parallel headless Chrome + ffmpeg), plus a frame-accurate review tool where you can comment and draw on any frame.

## What you get
- **Template project** (1080×1920, 60 fps), a working 14 s demo: hero eats gems, combo, slow-mo near miss, big payoff, packshot with CTA. Replace the mechanic and keep the pipeline.
- **House look**: bright soft daylight, wide soft shadows, GTAO contact shadows, light bloom, clearcoat toy materials, stroked toy typography.
- **Director layer**: gameplay is faked where faking is cheaper. Cues land beats exactly, override rules, and drive slow-mo and camera.
- **Seekable sim + parallel render**: a stateful sim replayed on seek, so frames render in parallel chunks (14 s at 60 fps ≈ 18 s).
- **Sound from events**: a sample-accurate mixer lays sounds on the sim's event log, layers hits, ducks and muffles music under slow-mo, normalizes to −14 LUFS. Sounds come from Pixabay: every role has a search query that worked on past creatives.
- **Review tool**: comments + brush on exact frames, instant scrubbing, and **versions**: a re-render shows up as v2 with a clean sheet. The agent gets version, frame, time, beat and an annotated PNG per note.
- **Unity intake**: the agent explores the project itself (`scan` / `find` / `deps` / `export`). It finds hero, enemies, icon and fonts, and converts prefabs to GLB with Unity material colors, nested parts on their bones, and Unity `.anim` clips as three.js animations. Read-only, no Unity install needed (uses Blender).
- **Other helpers**: reference-video breakdown (shots, per-second frames, contact sheet), Pixabay SFX grabber.

## Install
```bash
bunx skills add GR0SST/hypercasual-creative
```
Manual: clone and link `skills/hypercasual-creative` into `~/.claude/skills/` (Claude Code) or `~/.agents/skills/`.

Requirements (macOS or Windows): [bun](https://bun.sh), ffmpeg/ffprobe on PATH, Google Chrome (Edge/Chromium also work), Blender (only for Unity export).

macOS:
```bash
curl -fsSL https://bun.sh/install | bash
brew install ffmpeg
```
Windows (PowerShell):
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
winget install Gyan.FFmpeg
```
Chrome and Blender are found in their default install locations; otherwise set `CHROME=` / `BLENDER=` to the executable.

## Use
Ask your agent, e.g.:
- "Make a 30 s creative for our game: you swipe to steer a snake that eats fruit and grows; payoff is eating a giant watermelon."
- "Here is a reference ad (ref.mp4), do the same structure for our game, assets are in ~/Projects/MyGame (Unity)."

Manual loop:
```bash
bun skills/hypercasual-creative/scripts/new-project.mjs my-creative
cd my-creative
bun run bake                         # headless sim: beat log + events.json
bun run map 2,5.6,9.5                # top-down debug map of the sim
bun run shot 1,5.4,9.5,12.5          # stills for sign-off
bun run render -o renders/v1.mp4     # parallel render + sound mix
bun run review renders/v1.mp4        # comment + draw on frames
```

## License
MIT. Bundled fonts: SIL OFL 1.1.
