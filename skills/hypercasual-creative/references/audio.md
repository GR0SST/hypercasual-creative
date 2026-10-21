# Sound

## Pipeline
1. `bun run bake` writes `events.json`: every gameplay event plus every director cue (`{type:'cue', label}`), in video time (`vt`). `bun run render` bakes it again itself, so sound always matches the rendered sim.
2. `sfx.json` → `roles`: one entry per sound role `{src, gain, query}`; `music` also takes `offset` (seconds into the track, to land on its drop).
3. `src/sound.mjs` is the **sound design for this creative** (edit it like the scenario). It walks the events and calls the mixer (`scripts/lib/mixer.mjs`, a JS port of the Paper.io mixer):
   - `fx(role, t, { gain, maxLen, ramp: [from, to], minGap })` lays a sound exactly at `t` (leading silence trimmed, peak-normalized; `maxLen` trims with a short fade; `minGap` thins pickup bursts);
   - layer by calling several roles on one event (hit + splat, pop + shine);
   - `music(role, { gainPoints, cutoffPoints })` with `[[t, v], …]` envelopes: duck to ~0.45 and low-pass to ~700 Hz under slow-mo, settle under the packshot, fade at the end;
   - `mux(video, out)`: sum, tanh soft clip, `loudnorm` −14 LUFS + limiter, AAC 192k onto the video.
4. It runs at the end of `bun run render`, or alone: `bun src/sound.mjs renders/.tmp/silent.mp4 renders/<name>.mp4` (fast; re-mix without re-rendering).

Overlay-only beats (packshot taps, logo slam) should also be director cues, so they land in `events.json` and get sound from the same script.

## Sourcing (Pixabay)
The template ships no audio files. Real Pixabay picks sound far better than anything synthetic, and raw files can't go into a public repo anyway. Pixabay's CDN returns 403 to plain curl, so use a real (headed) Chrome:
```bash
bun scripts/pixabay-grab.mjs "https://pixabay.com/sound-effects/search/cartoon%20pop/" 6 assets/audio/raw
```
It presses each Play button, captures the preview MP3 URL, and downloads it through the browser session. Grab 5–8 candidates per role, pick, then copy the winner to the `src` path from `sfx.json` (e.g. `assets/audio/pop.mp3`). The render prints the grab command for every role that's still missing.

### Sound kit that worked (Paper.io creative)
| Role | Pixabay search | Notes |
|---|---|---|
| music bed | `music/search/energetic%20upbeat%20game` | started the track ~15 s in to land on its drop |
| pickup / capture pop | `sound-effects/search/cartoon%20pop` | short, round, no reverb tail |
| combo / shine | `sound-effects/search/coin%20collect` | layered on top of the pop for bigger wins |
| kill / impact | `sound-effects/search/cartoon%20explosion` + `splash%20juicy` | hit + juicy splat together |
| slow-mo in | `sound-effects/search/slow%20motion` | heartbeat/pitch-down types read best |
| whoosh / riser | `sound-effects/search/whoosh` | |
| payoff / logo | `sound-effects/search/level%20up` | |
| CTA tap | `sound-effects/search/combo%20game` | |
| hook (sky drop) | `wind%20rush%20falling`, `fire%20whoosh`, `meteor%20fire`, `heavy%20impact%20boom`, `ground%20impact`, `birds%20flock%20flying` | |

## Picking
Listen if you can: if any tool or MCP that takes audio input is available (e.g. Gemini), give it the candidates per role with the role description ("short juicy pop for a gem pickup, under 0.2 s") and ask for a ranking. If nothing can listen, that's fine: pick by the signal (short length, sharp attack, loudness via ffmpeg `astats`/`silencedetect`), trim leading silence, keep the alternatives in `assets/audio/raw/<role>/`, and say in the summary that sounds were picked unheard. Don't block on the user for this.

Roles every creative needs: pickup pop, combo/streak, big payoff, whoosh (slow-mo in/out), impact/kill, UI pop (packshot elements), CTA tap, music bed (energetic, starts strong; pick the drop for the payoff).

## Mix rules of thumb
- Music bed around −14 to −12 dB below SFX peaks; duck 6–9 dB plus a low-pass during slow-mo.
- Thin out repeated pops with `minGap` (≈0.07 s) and alternate 2–3 variants (separate roles) so it doesn't machine-gun.
- The payoff gets the loudest hit plus a music drop; leave ~0.3 s of space before it.
- Check the license of every track before delivery (Pixabay Content License allows use in ads; don't redistribute raw files in public repos).
