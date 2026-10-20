# Fake it: the director layer

The viewer sees 15–30 s of video from one camera. They can't tell real rules from scripted ones, so the game logic only needs to be convincing in frame.

## Decide: real or faked?

| Run it for real when… | Fake it when… |
|---|---|
| it's continuous and cheap (movement, steering, pickups by distance, growth) | it must land on a beat (kills, near misses, the big payoff) |
| faking would need hundreds of keyframes | the real rule would need AI, physics tuning or balance |
| the rule creates natural variety (particles, wobble) | the real outcome is wrong for the ad (hero must never die) |

## Patterns that worked

- **Pre-roll the hero path, then dress it.** Simulate the hero's steering alone (gameplay time → position), then place pickups, threats and enemy land where the hero *will be* at the beat. See `preroll()` in `template/src/sim/scenario.js`.
- **Threats aim where the hero WAS.** A near miss is a straight keyframed run through the hero's position ~0.5 s earlier. It always just misses, whatever the timing tweaks.
- **Rivals are paths, not AI.** Keyframe them in gameplay time so slow-mo slows them too.
- **Cues override rules.** `director.at(t, fn, label)` for one-shots and `director.during(a, b, fn)` for spans. Cue labels land in `events.json`: the SFX track and the review timeline read them.
- **Reshape the world, never the approved hero route.** In Paper.io, when the finale needed the hero to ride through enemy turf, we stamped a band of enemy land along the hero's existing path instead of rerouting.
- **Instant swaps hidden by FX.** Land changing owner, a model swap, a teleport: do it on the frame of a burst, flash or camera kick.
- **Slow-mo for clutch moments.** `timeScaleGoal` (eased), camera `focusGoal`, and a two-shot framing (centre between hero and threat) so both read in frame. Video time keeps running at 1×; only gameplay slows.
- **Merge popups.** Several small gains within a few frames become one bigger "+%" popup, so the screen doesn't turn to noise.
- **Hero never dies, rank only climbs**, the score only goes up, and the payoff is always bigger than anything before it.

## Two RNGs

`rng` for anything that changes gameplay (positions, spawns), `fxRng` for particles/confetti/shake. Then adding 10 more confetti pieces can't move an enemy by a pixel and break an approved beat.

## Keep an override handle on everything

Every rule should be switchable by a flag or cue (`w.flags`, `timeScaleGoal`, per-agent overrides). Feedback like "make him not die here" or "hold the capture 3 frames longer" should be a one-line cue, not a refactor.
