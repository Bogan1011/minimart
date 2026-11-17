using System.Collections.Generic;
using MiniMart.Core;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace MiniMart.EditorTools
{
    /// <summary>
    /// MiniMart ▸ Set Up Project. One-off project settings that can't live in Assets/:
    /// the blueprint's collision layers, WebGL player settings for a LAN web build, and URP settings
    /// sized for Intel Iris Xe at 60 fps (see Docs/WebAndLAN.md). Safe to run again.
    /// </summary>
    public static class ProjectSetup
    {
        public const string WebBuildFolder = "Builds/Web";

        [MenuItem("MiniMart/Set Up Project (layers, web, graphics)", priority = 0)]
        public static void SetUpMenu()
        {
            var report = new List<string>();
            report.AddRange(EnsureLayers());
            report.AddRange(ApplyWebPlayerSettings());
            report.AddRange(ApplyIgpuGraphics());
            AssetDatabase.SaveAssets();
            string text = string.Join("\n", report);
            Debug.Log("MiniMart project setup:\n" + text);
            EditorUtility.DisplayDialog("MiniMart", text, "OK");
        }

        // ------------------------------------------------------------------ layers

        /// <summary>Adds any missing <see cref="GameLayers"/> to the first free user layers (8-31).</summary>
        public static List<string> EnsureLayers()
        {
            var report = new List<string>();
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset");
            if (assets == null || assets.Length == 0) { report.Add("Could not open TagManager.asset."); return report; }
            var tagManager = new SerializedObject(assets[0]);
            var layers = tagManager.FindProperty("layers");

            var present = new HashSet<string>();
            for (int i = 0; i < layers.arraySize; i++) present.Add(layers.GetArrayElementAtIndex(i).stringValue);

            int next = 8;
            foreach (var name in GameLayers.All)
            {
                if (present.Contains(name)) continue;
                while (next < layers.arraySize && !string.IsNullOrEmpty(layers.GetArrayElementAtIndex(next).stringValue)) next++;
                if (next >= layers.arraySize) { report.Add($"No free layer for {name}."); continue; }
                layers.GetArrayElementAtIndex(next).stringValue = name;
                report.Add($"Layer {next}: {name}");
                next++;
            }
            tagManager.ApplyModifiedPropertiesWithoutUndo();
            if (report.Count == 0) report.Add("Layers already set up.");
            return report;
        }

        // ------------------------------------------------------------------ web player

        public static List<string> ApplyWebPlayerSettings()
        {
            var web = NamedBuildTarget.WebGL;
            PlayerSettings.runInBackground = true;   // a co-op game must keep simulating in a background tab
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.OpenGLES3 });   // WebGL 2
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;   // our LAN server needn't send Content-Encoding headers
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            PlayerSettings.WebGL.nameFilesAsHashes = true;
            PlayerSettings.SetManagedStrippingLevel(web, ManagedStrippingLevel.Low);
            return new List<string>
            {
                "Web: WebGL 2, linear colour, gzip with decompression fallback, data caching, run in background.",
            };
        }

        // ------------------------------------------------------------------ graphics for Iris Xe

        /// <summary>
        /// Points the WebGL default quality level at the lightest URP asset (the template's "Mobile"
        /// level if there is one) and trims it: no MSAA, no HDR, one shadow cascade over 25 m, no depth or
        /// opaque textures, at most 4 extra lights.
        /// </summary>
        public static List<string> ApplyIgpuGraphics()
        {
            var report = new List<string>();
            string[] names = QualitySettings.names;
            int webLevel = System.Array.FindIndex(names, n => n.ToLowerInvariant().Contains("mobile"));
            if (webLevel < 0) webLevel = 0;
            SetDefaultQualityFor("WebGL", webLevel, report);

            var urp = QualitySettings.GetRenderPipelineAssetAt(webLevel) as UniversalRenderPipelineAsset
                      ?? GraphicsSettings.defaultRenderPipeline as UniversalRenderPipelineAsset;
            if (urp == null)
            {
                report.Add("No URP asset found - create the project from the Universal 3D template.");
                return report;
            }

            urp.renderScale = 1f;
            urp.msaaSampleCount = 1;
            urp.supportsHDR = false;
            urp.shadowDistance = 25f;
            urp.shadowCascadeCount = 1;
            urp.maxAdditionalLightsCount = 4;
            urp.supportsCameraDepthTexture = false;
            urp.supportsCameraOpaqueTexture = false;
            EditorUtility.SetDirty(urp);
            report.Add($"Graphics: '{names[webLevel]}' quality for web, URP asset '{urp.name}' trimmed for Iris Xe (MSAA off, HDR off, 1 cascade, 25 m shadows).");
            return report;
        }

        private static void SetDefaultQualityFor(string platform, int level, List<string> report)
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset");
            if (assets == null || assets.Length == 0) { report.Add("Could not open QualitySettings.asset."); return; }
            var so = new SerializedObject(assets[0]);
            var map = so.FindProperty("m_PerPlatformDefaultQuality");
            if (map == null || !map.isArray) { report.Add("Set the WebGL default quality by hand (Project Settings ▸ Quality)."); return; }

            for (int i = 0; i < map.arraySize; i++)
            {
                var pair = map.GetArrayElementAtIndex(i);
                if (pair.FindPropertyRelative("first").stringValue != platform) continue;
                pair.FindPropertyRelative("second").intValue = level;
                so.ApplyModifiedPropertiesWithoutUndo();
                return;
            }
            map.InsertArrayElementAtIndex(map.arraySize);
            var added = map.GetArrayElementAtIndex(map.arraySize - 1);
            added.FindPropertyRelative("first").stringValue = platform;
            added.FindPropertyRelative("second").intValue = level;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        // ------------------------------------------------------------------ build

        /// <summary>
        /// Builds the web player into Builds/Web. Until the networked server exists (Week 4 PoC), serve
        /// that folder with any static file server on the LAN PC; see README.
        /// </summary>
        [MenuItem("MiniMart/Build Web Player", priority = 20)]
        public static void BuildWebPlayer()
        {
            var scenes = new List<string>();
            foreach (var name in SceneNames.BuildOrder) scenes.Add(SceneBuilder.ScenePath(name));
            var options = new BuildPlayerOptions
            {
                scenes = scenes.ToArray(),
                locationPathName = WebBuildFolder,
                target = BuildTarget.WebGL,
                options = BuildOptions.None,
            };
            var result = BuildPipeline.BuildPlayer(options);
            Debug.Log($"MiniMart web build: {result.summary.result}, {result.summary.totalSize / (1024 * 1024)} MB, {result.summary.totalTime}.");
        }
    }
}
