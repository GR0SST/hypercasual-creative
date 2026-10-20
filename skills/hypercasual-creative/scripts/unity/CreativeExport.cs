// Batch-mode GLB exporter for creative assets. Requires glTFast
// (com.unity.cloud.gltfast). Copy into Assets/Editor/ and run:
//   Unity -batchmode -nographics -projectPath <proj> -executeMethod CreativeExport.Run \
//     -exportPrefabs "Assets/A.prefab,Assets/B.prefab" -exportOut /abs/out/dir -logFile -
// UNTESTED starting point: verify on the first project and fix.
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GLTFast;
using GLTFast.Export;
using UnityEditor;
using UnityEngine;

public static class CreativeExport
{
    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        string Arg(string name)
        {
            var i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }

        var prefabs = (Arg("-exportPrefabs") ?? "").Split(',').Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();
        var outDir = Arg("-exportOut") ?? Path.Combine(Directory.GetCurrentDirectory(), "CreativeExport");
        Directory.CreateDirectory(outDir);
        // Keep the editor alive until every async export finishes, then exit.
        ExportAll(prefabs, outDir).ContinueWith(t =>
        {
            if (t.Exception != null) Debug.LogException(t.Exception);
            EditorApplication.delayCall += () => EditorApplication.Exit(t.Exception == null ? 0 : 1);
        });
    }

    static async Task ExportAll(string[] prefabs, string outDir)
    {
        foreach (var path in prefabs)
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null)
            {
                Debug.LogError($"[CreativeExport] not found: {path}");
                continue;
            }
            var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            go.transform.position = Vector3.zero;
            var export = new GameObjectExport(
                new ExportSettings { Format = GltfFormat.Binary, FileConflictResolution = FileConflictResolution.Overwrite },
                new GameObjectExportSettings { OnlyActiveInHierarchy = false, DisabledComponents = true });
            export.AddScene(new[] { go }, prefab.name);
            var file = Path.Combine(outDir, prefab.name + ".glb");
            var ok = await export.SaveToFileAndDispose(file);
            Debug.Log($"[CreativeExport] {(ok ? "ok" : "FAILED")} {path} -> {file}");
            UnityEngine.Object.DestroyImmediate(go);
        }
    }
}
