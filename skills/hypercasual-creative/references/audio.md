# Sound

## Pipeline
1. `bun run bake` writes `events.json`: every gameplay event plus every director cue (`{type:'cue', label}`), in video time (`vt`).
2. `sfx.json` maps an event type or `cue:<label>` to `{src, volume, minGap}`, plus an optional `music: {src, volume}` bed.
3. `bun scripts/sfx-sync.mjs` rewrites `<div id="audio-track">` in `index.html` with one `<audio>` per hit (exact duration via ffprobe, greedy track lanes so nothing overlaps on a track). `hyperframes render` mixes it, so the user hears it in the review tool.
4. For ducking the music under slow-mo, fades and EQ, use the HyperFrames audio features (`data-automation` volume lanes, `<hf-audio-group>`): see the `hyperframes-audio` skill.

Overlay-only beats (packshot taps, logo slam) should also be director cues, so they land in `events.json` and get sound from the same table.

## Sourcing (Pixabay)
The template ships no audio files. Real Pixabay picks sound far better than anything synthetic, and raw files can't go into a public repo anyway. Pixabay's CDN returns 403 to plain curl, so use a real (headed) Chrome:
```bash
bun <skill>/scripts/pixabay-grab.mjs "https://pixabay.com/sound-effects/search/cartoon%20pop/" 6 assets/audio/raw
```
It presses each Play button, captures the preview MP3 URL, and downloads it through the browser session. Grab 5–8 candidates per role, pick, then copy the winner to the `src` path from `sfx.json` (e.g. `assets/audio/pop.mp3`). `bun run sfx` prints the grab command for every role that's still missing.

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
Listen, don't guess from titles. If a model that can hear audio is available (Gemini), give it the candidates per role with the role description ("short juicy pop for a gem pickup, under 0.2 s") and ask for a ranking. Otherwise make a quick contact track (`ffmpeg concat` with 0.5 s gaps) and let the user pick.

Roles every creative needs: pickup pop, combo/streak, big payoff, whoosh (slow-mo in/out), impact/kill, UI pop (packshot elements), CTA tap, music bed (energetic, starts strong; pick the drop for the payoff).

## Mix rules of thumb
- Music bed around −14 to −12 dB below SFX peaks; duck 6–9 dB plus a low-pass during slow-mo.
- Thin out repeated pops with `minGap` (≈0.07 s) and alternate 2–3 variants so it doesn't machine-gun.
- The payoff gets the loudest hit plus a music drop; leave ~0.3 s of space before it.
- Check the license of every track before delivery (Pixabay Content License allows use in ads; don't redistribute raw files in public repos).
