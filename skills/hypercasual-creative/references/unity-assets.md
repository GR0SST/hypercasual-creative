# Getting assets out of a Unity project

The agent explores the project itself with `scripts/unity/unity.mjs`. It never writes to the Unity project and doesn't need Unity installed. Blender (CLI) does the FBX → GLB step. Tested on a real Unity 2022.3 hypercasual project (2k prefabs, 1k materials): scan < 1 s, prefab export ≈ 2 s.

## Workflow
```bash
U=/path/to/UnityProject
S=<skill>/scripts/unity
bun $S/unity.mjs scan $U                       # 1. overview
bun $S/unity.mjs find $U boss --kind prefab    # 2. narrow down
bun $S/unity.mjs deps $U "Assets/…/Player.prefab"   # 3. what it's made of
bun $S/unity.mjs export $U "Assets/…/Player.prefab" --out assets/models   # 4. convert
```

1. **scan**: product/company name, Unity version, whether YAML is parsable (Force Text), app icon from Player Settings, icon/logo-looking textures, fonts, scenes, the biggest game-content folders, and name-matched **hero / enemy / collectible / obstacle / level / skin** candidates. Third-party folders (Plugins, SDKs, ExternalAssets, demos) are ranked down.
2. **find** `<words…>` [`--kind prefab,model,material,texture,font,audio,animation`]: path search, game content first.
3. **deps** `<prefab>` [`--json`]: renderers with hierarchy path, source model, **material colors** (`_BaseColor`/`_Color`…, plus toon shadow color `_SColor`), textures and shader; animator controller and its clips; nested prefabs/models with the **bone they hang off**. Parts that are hidden in the game (`m_IsActive: 0`, disabled renderer) are marked `(hidden in game)` and skipped on export. Pick the right prefab here before exporting: variants and old/"Trash" copies are common.
4. **export** `<prefab|model>` `--out <dir>`:
   - every visible model → `<name>.glb` (Blender, with FBX-embedded animations);
   - textures → PNG (`sips` converts PSD/TGA);
   - Unity `.anim` clips from the animator → `<name>.anims.json` (three.js AnimationClip JSON; root node skipped unless `--keep-root`);
   - `<name>.unity.json` manifest: renderers → materials (by node name and slot), `attachments` (nested parts: parent bone + local TRS), `modelMaterials` (FBX material name → Unity material, from the FBX `.meta` remaps), clips file.

## In the creative
```js
import { loadUnityModel } from './unity.js';           // template/src/view/unity.js
const hero = await loadUnityModel('assets/models/Player.unity.json');
actor.body.add(hero.scene);                             // fit scale/height yourself
const mixer = new THREE.AnimationMixer(hero.scene);
mixer.clipAction(hero.clips.find((c) => c.name === 'Running')).play();
// view.sync(w): mixer.setTime(w.time)   (sim time, deterministic)
```
- Load before the first render-critical seek: register the promise in `window.__hf.buildReady.<key>`.
- `houseLook` (default) swaps every material for a house `toy()` material in the Unity color/texture, so Unity toon/custom shaders come out in our soft look. Pass `{ houseLook: false }` to keep the GLB materials.
- Fit the size with a bounding box (Unity units vary per project), then rotate so the model faces the sim heading (template heading 0 = +X).

## Gotchas
- Unity 2019.3+ doesn't store mesh names in `.meta`; meshes are matched by GameObject name (= FBX node = GLB node). GLTFLoader strips `:` `.` etc. from names (`mixamorig:Head` → `mixamorigHead`); the loader sanitizes the same way.
- Unity space is left-handed. Converted with a mirror on X: position (−x, y, z), quaternion (x, −y, −z, w). Check bone attachments (hats, weapons) on a still. If one sits mirrored, flip that attachment's local X.
- Binary-serialized projects (`scan` reports a serialization mode other than Force Text) can't be parsed. Use the batch exporter below, or ask for a Force Text copy.
- Prefab variants keep overrides as modifications; colors from material overrides are reported under `override`.
- `.anim` keys are sampled per frame (usually 30 Hz) and played linearly. Hermite tangents are ignored, which is fine at that density.

## Fallback: Unity batch exporter (untested)
`scripts/unity/CreativeExport.cs` exports prefabs to GLB from inside Unity with glTFast (`com.unity.cloud.gltfast`). Copy it to `Assets/Editor/` and run Unity with `-batchmode -executeMethod CreativeExport.Run -exportPrefabs "…" -exportOut <dir>`. It needs the project's exact Unity version and modifies the project (package + script), so do it on a copy.

## Last resort: record in Unity
If the look depends on shaders/VFX we can't rebuild, record shots in Unity (Recorder + Timeline) and use them as `<video>` clips under our overlays and packshot.
