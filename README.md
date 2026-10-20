# hypercasual-creative

An agent skill for making **video ad creatives for hypercasual mobile games**: a scripted three.js gameplay scene in a soft toy-like look, rendered with [HyperFrames](https://hyperframes.heygen.com), plus a frame-accurate review tool where you can comment and draw on any frame.

## What you get
- **Template project** (1080×1920, 60 fps), a working 14 s demo: hero eats gems, combo, slow-mo near miss, big payoff, packshot with CTA. Replace the mechanic and keep the pipeline.
- **House look**: bright soft daylight, wide soft shadows, GTAO contact shadows, light bloom, clearcoat toy materials, stroked toy typography.
- **Director layer**: gameplay is faked where faking is cheaper. Cues land beats exactly, override rules, and drive slow-mo and camera.
- **Seekable sim**: a stateful sim replayed on seek, so it works with HyperFrames Studio scrubbing and parallel render workers.
- **SFX from events**: the sim's event log becomes audio clips automatically. Sounds come from Pixabay: every role has a search query that worked on past creatives.
- **Review tool**: comments + brush on exact frames, instant scrubbing, and **versions**: a re-render shows up as v2 with a clean sheet. The agent gets version, frame, time, beat and an annotated PNG per note.
- **Unity intake**: the agent explores the project itself (`scan` / `find` / `deps` / `export`). It finds hero, enemies, icon and fonts, and converts prefabs to GLB with Unity material colors, nested parts on their bones, and Unity `.anim` clips as three.js animations. Read-only, no Unity install needed (uses Blender).
- **Other helpers**: reference-video breakdown (shots, per-second frames, contact sheet), Pixabay SFX grabber.

## Install
```bash
npx skills add GR0SST/hypercasual-creative      # or: bunx skills add GR0SST/hypercasual-creative
```
Manual: clone and link `skills/hypercasual-creative` into `~/.claude/skills/` (Claude Code) or `~/.agents/skills/`.

Also recommended: the HyperFrames skills (`npx skills add heygen-com/hyperframes`).

Requirements: [bun](https://bun.sh), ffmpeg/ffprobe, Google Chrome, HyperFrames CLI (`bunx hyperframes`, fetched on demand), Blender (only for Unity export).

## Use
Ask your agent, e.g.:
- "Make a 30 s creative for our game: you swipe to steer a snake that eats fruit and grows; payoff is eating a giant watermelon."
- "Here is a reference ad (ref.mp4), do the same structure for our game, assets are in ~/Projects/MyGame (Unity)."

Manual loop:
```bash
bun skills/hypercasual-creative/scripts/new-project.mjs my-creative
cd my-creative
bun run bake                                     # headless sim: beat log + events.json
bunx hyperframes snapshot --at 1,5.4,9.5,12.5    # stills for sign-off
bun run sfx                                      # events -> audio clips (after grabbing sounds)
bunx hyperframes render -o renders/v1.mp4
bun run review renders/v1.mp4                    # comment + draw on frames
```

## License
MIT. Bundled fonts: SIL OFL 1.1.
