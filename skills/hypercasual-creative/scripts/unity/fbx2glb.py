# Blender CLI: FBX -> GLB.  blender -b -P fbx2glb.py -- in.fbx out.glb
import sys
import bpy

src, dst = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_apply=True)
print(f"exported {dst}")
