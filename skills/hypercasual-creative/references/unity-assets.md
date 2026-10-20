# Getting assets out of a Unity project

Status: the batch exporter script is a starting point and has **not been battle-tested yet**. Verify on the first real project and fix this doc.

## Option 1: batch-mode GLB export (preferred)
Requires the glTFast package (`com.unity.cloud.gltfast`, 6.x) in the Unity project. Add it to a copy of the project or a branch if the user doesn't want the manifest touched.

1. Copy `scripts/unity/CreativeExport.cs` into `<UnityProject>/Assets/Editor/`.
2. Run (path to the Unity version the project uses):
```bash
"/Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity" \
  -batchmode -nographics -projectPath <UnityProject> \
  -executeMethod CreativeExport.Run \
  -exportPrefabs "Assets/Prefabs/Player.prefab,Assets/Prefabs/Enemy.prefab" \
  -exportOut <creative>/assets/models \
  -logFile -
```
Each prefab becomes `<name>.glb` (meshes, materials, textures, skinning, animation clips where glTFast supports them).

## Option 2: no Unity install
- `*.fbx` → GLB with [FBX2glTF](https://github.com/godotengine/FBX2glTF) (`FBX2glTF -b -i in.fbx -o out`) or Blender CLI:
  `blender -b -P <skill>/scripts/unity/fbx2glb.py -- in.fbx out.glb`
- Textures: copy PNG/TGA/PSD straight from `Assets/` (convert PSD/TGA to PNG with ffmpeg or `sips`).
- Prefabs are YAML: they reference meshes by GUID. Resolve them via the `.meta` file next to each asset (`guid:` line) to find which FBX/material a prefab uses.

## Option 3: record in Unity
If the game's look depends on custom shaders/VFX that can't be rebuilt in three.js in reasonable time, record shots in Unity (Recorder package, Timeline, a scripted director) and use them as `<video>` clips in HyperFrames under our overlays/packshot. Last resort: we lose the house look and the frame-exact control.

## After export
- Check scale (Unity 1 unit = 1 m; the template's hero is ~2 units tall) and the forward axis (glTF +Z forward vs the template's +X heading; wrap in a group and rotate).
- Replace imported materials with house `toy()` materials using the original base color/texture, unless the original already looks right under our lights.
- Animation clips: drive `AnimationMixer.setTime()` from **sim time** in `view.sync`, never from a clock.
