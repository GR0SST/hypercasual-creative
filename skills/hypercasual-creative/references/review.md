# Review loop

`scripts/review/review.mjs` (copied into every project) is a small local SyncSketch: frame-accurate player, timeline with director cues and events, comments pinned to frames, and a brush to draw over the frame.

## User side
```bash
bun scripts/review/review.mjs renders/<name>.mp4
```
- Space play/pause · ←/→ one frame (Shift = 10) · `[` `]` jump between notes · D toggles the brush · ⌘↵ adds the note.
- Pause on a frame, type what's wrong, optionally circle/arrow it with the brush, Add note.
- Notes show as dots on the timeline (red open, green done); yellow lines are director beats.
- Tell the agent "notes are in" when done.

## Agent side
```bash
bun scripts/review/review.mjs renders/<name>.mp4 --list
```
For each note: id, frame, time, active beat (last director cue at that time), text, and `review/<name>/<id>.annotated.png`, the exact frame (selected by index with ffmpeg) with the strokes composited. **Read the PNG**: the drawing is often the actual note ("this", an arrow, a circle).

Then:
1. Map the note to code: beat label → cue in `scenario.js`; frame → `vt` in `events.json`; on-screen thing → view/overlay.
2. Fix, `bun run bake`, snapshot the affected times (`bunx hyperframes snapshot --at <time>`), look at them.
3. Re-render to the **same** output name (back up the previous version as `_vN` first) so notes stay attached.
4. `--done <id> --reply "what changed"` for each fixed note. Leave notes you couldn't fix open and say why.

Notes are stored in `review/<video-name>/notes.json` (+ PNGs). Commit them with the project if the team wants history.
