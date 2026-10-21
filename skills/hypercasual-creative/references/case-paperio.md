# Case study: Paper.io 2 "watermelon" creative (34 s)

The creative this skill was distilled from. Built in plain three.js + puppeteer frame capture + a numpy mixer; the template's render and sound scripts are direct descendants.

## Beats
- 0–3 s hook: sky drop. Space → re-entry fire → clouds → birds → impact; the camera lands exactly on the gameplay pose (no cut).
- Gameplay starts inside the hero's own zone, then fast captures right away.
- Kills: the killer inherits the victim's land (an instant swap hidden by the kill FX).
- Two slow-mo close calls with two-shot framing (camera centred between hero and attacker), "!" alert.
- An "INVADE" beat: riding through enemy land (4 hits) before a mega capture.
- Rank climbs #10 → #1. The hero never dies.
- Packshot at ~31 s: blurred live game (slowed) + real game icon, logo, PLAY NOW, hand taps.

## What made it work
- **Director over rules**: real territory/trail rules, but enemy trails pre-drawn, teleports, land stamped along the hero's existing path ("INKY_RUN") instead of rerouting the approved hero route.
- **Camera reacts to the game**: FOV widens with trail length (tension), kicks out on kills, punches on captures, focuses in slow-mo.
- **Separate FX RNG** so FX iterations never moved gameplay.
- **Map debug tool** (top-down render of the board at a time) to fix timing without rendering video.
- Smooth enemy trails, merged % popups, low bloom (the user asked for less), soft light.
- SFX placed from the event log; candidates downloaded from Pixabay via headed Chrome and picked by a Gemini listening pass.

## Feedback that came up (expect it again)
- "Less bloom." · "Trails look jittery, smooth them." · "Kill should feel instant." · "Show both of them in frame during the close call." · "Too many popups." · "Don't change my route, change the enemies."
