# Beats for hypercasual UA videos

## Skeleton (30 s; scale down for 15 s)
| Time | Beat | Purpose |
|---|---|---|
| 0–3 s | **Hook** | Stop the scroll. Spectacle or a question: sky drop, impossible situation, fail bait, "only 1 % can…", huge number. Must flow into gameplay without a hard cut if possible. |
| 3–8 s | **Core loop, fast** | Show the one verb immediately and succeed at it 2–3 times. The viewer must understand the game with sound off. |
| 8–18 s | **Escalation** | Bigger risks, enemies, combos, kills; camera opens up as stakes rise. |
| 1–2 moments | **Clutch** | Slow-mo near miss / close call (1–1.5 s video time each), two-shot framing, "!" alert. |
| 18–26 s | **Payoff** | The most satisfying moment, bigger than anything before: mega capture, growth burst, rank #1. |
| last 2.5–3.5 s | **Packshot** | Blurred live game under icon, logo, tagline, CTA button, hand taps. |

15 s version: hook 0–2, loop 2–6, one clutch, payoff ~10–12, packshot 12–15.

## Pacing norms
- Something rewarding every 1–2 s (pickup pop, number up, capture). No dead air longer than ~1.5 s.
- Counters/progress always visible and only going up (score, %, rank #10 → #1).
- Alternate fast and slow: speed → slow-mo clutch → speed → payoff.
- End gameplay on the peak, then cut to the packshot while the game keeps moving, slowed, underneath.

## Juice checklist
pickup pop + particles · number popups (merge bursts) · camera punch on small wins, kick on big ones · squash on the hero · screen-space flash on payoff · confetti · stroked popup text with back-out ease · SFX on every visible event · music drops on the payoff.

## Hooks that worked / are common
- Sky drop into the arena (re-entry fire → clouds → impact → camera lands on the gameplay pose, no cut).
- Fail bait: the hero almost loses in the first 2 s, then wins.
- "Satisfying" macro: one huge capture/fill right away.
- Versus: tiny hero vs giant board; counter "1 %".
Don't copy a reference ad's hook one-to-one; reuse its structure.

## Formats
- Master: 1080×1920, **60 fps by default** (root `data-fps="60"`, `FPS` in `timing.js`), H.264. Use 30 fps only if a network requires it (`hyperframes render -f 30`). 1:1 and 16:9 variants are reframes (camera distance + HUD layout), not crops. Plan the HUD so it survives that.
- Keep key action and text out of the bottom ~20 % and top ~12 % (platform UI overlays). Check the current specs of the target ad network before delivery.
