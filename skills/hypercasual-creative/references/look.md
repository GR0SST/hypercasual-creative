# House look: soft toy daylight

The target: bright, clean, soft-lit toy world, like Paper.io 2 / Voodoo-style 3D hypercasual. Everything below is already in `template/src/view/`. Change values only for a reason.

## Renderer (`renderer.js`)
- `NeutralToneMapping`, exposure 1.0, pixel ratio pinned to 1, 1080×1920.
- Shadows: `PCFShadowMap`, `shadow.radius = 6`, `blurSamples = 16`, 2048² map, bias −0.0004 / normalBias 0.03. The shadow frustum (±20) **follows the camera focus**, so shadows stay sharp-soft everywhere.
- GTAO pass (radius 1.4, blend 0.85): soft contact darkening where objects touch the floor. This sells the "toy on a table" feel more than the shadows do.
- Bloom: `UnrealBloomPass(strength 0.22, radius 0.3, threshold 2.4)`. **Keep it low.** Only true highlights may glow; users repeatedly asked for less bloom.
- Grade pass: saturation 1.2, a tiny warm-shadow/cool-highlight split, vignette 0.12.
- 4× MSAA on a half-float target.

## Lights (`environment.js`)
- `HemisphereLight('#f2fbff', '#ffe3d6', 1.25)`: a strong, slightly warm sky fill. Shadows never go black.
- Key: `DirectionalLight('#fff3e2', 2.2)` from upper-left-front (offset −14, 30, 12).
- `RoomEnvironment` env map at 0.35 intensity, only to give clearcoat something to reflect.
- Fog into the sky color (60→140) so the far field dissolves into pastel.

## Materials
- Characters and props: `MeshPhysicalMaterial`, roughness 0.3–0.4, clearcoat 0.6–1, clearcoat roughness 0.1–0.25, optional sheen on soft things. Chunky shapes with bevels (`ExtrudeGeometry` with bevel, `RoundedBoxGeometry`), never razor edges.
- Ground: near-white or a pastel checker with a faint emissive lift (0.18–0.32) so it reads bright even in shadow.
- Water/backdrops: custom shader with soft caustic "noodles" + foam ring (see `createWater`).
- Palette: saturated mid-tones (pink #ff4a8d, teal #27c6dc, violet #7b5cff, lime #8bdc3f, orange #ffa232, sun #ffd23a), white highlights, no pure black (darkest ≈ #1b1530).

## Typography and UI
- Lilita One (display) + Fredoka (UI), both OFL, shipped in `assets/fonts`.
- Thick `-webkit-text-stroke` with `paint-order: stroke fill`, an offset drop shadow **without blur** (`drop-shadow(0 6px 0 rgba(...))`).
- Popups: back-out pop (0.22 s), float up, fade in the last 25 %. Big moments get bigger type and warmer colors.
- Packshot: game blurred (16 px) + slight desaturate underneath, rays, icon pop, logo slam (2.4→1 scale), CTA breathes, hand taps twice with ripple.

## Camera grammar
- Steep pitch (~58°), north-up, smooth follow with look-ahead.
- Tension widens FOV (trail length, danger); kills/combos **kick** (zoom out + FOV pop that eases back); pickups **punch** (tiny zoom-in thump); slow-mo **focuses** (dolly in, two-shot).
- Shake = trauma² (impacts), never constant idle wobble.

## Checks before showing stills
- Shadows soft and visible under every actor? Contact AO present?
- Nothing blown out by bloom? Text readable at phone size (look at a 360 px wide thumbnail)?
- Hero is the most saturated thing on screen?
