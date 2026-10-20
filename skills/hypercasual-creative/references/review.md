# Review loop

`scripts/review/review.mjs` (copied into every project) is a small local SyncSketch: frame-accurate player (an all-keyframe scrub proxy makes every seek ≈ 6 ms), timeline with director cues and events, comments pinned to frames, a brush to draw over the frame, and **versions**.

## Versions
The server watches the video path it was started with. Each time that file changes (the agent re-rendered after fixes), it waits until the file stops growing, archives it as the next version (`review/<name>/v2.mp4`, with its own proxy and `events.json` snapshot), and every open browser on the latest version switches to it with a toast ("New render v2 loaded"). Notes belong to the version they were made on, so the new render starts with a clean sheet. Older versions and their notes stay one click away in the version menu.

## User side
```bash
bun scripts/review/review.mjs renders/<name>.mp4
```
- Space play/pause · ←/→ one frame (Shift = 10) · `[` `]` jump between notes · D toggles the brush · ⌘Z undo stroke · ⌘↵ adds the note.
- Pause on a frame, type what's wrong, optionally circle/arrow it with the brush, Add note.
- Notes show as dots on the timeline (red open, green done); yellow lines are director beats.
- Tell the agent "notes are in" when done.

## Agent side
```bash
bun scripts/review/review.mjs renders/<name>.mp4 --list
```
For each note: id, version, frame, time, active beat (last director cue at that time), text, and `review/<name>/<id>.annotated.png`, the exact frame (selected by index with ffmpeg) with the strokes composited. **Read the PNG**: the drawing is often the actual note ("this", an arrow, a circle).

Then:
1. Map the note to code: beat label → cue in `scenario.js`; frame → `vt` in `events.json`; on-screen thing → view/overlay.
2. Fix, `bun run bake`, snapshot the affected times (`bunx hyperframes snapshot --at <time>`), look at them.
3. Re-render to the **same** output path. Keep the review server running: it picks the render up as the next version by itself, so no manual backups are needed.
4. `--done <id> --reply "what changed"` for each fixed note. Leave notes you couldn't fix open and say why.

Notes are stored in `review/<video-name>/notes.json` (+ PNGs, `versions.json`, `vN.mp4`). Commit them with the project if the team wants history.
