using System.Collections.Generic;
using MiniMart.Core;
using MiniMart.Data;
using MiniMart.Player;
using MiniMart.Simulation.Catalogue;
using MiniMart.UI;
using MiniMart.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace MiniMart.EditorTools
{
    /// <summary>
    /// MiniMart ▸ Build Sprint 1 Scenes. Generates the grey-box prefabs and the four Sprint 1 scenes
    /// (Bootstrap, MainMenu, Supermarket, TestMaps/TestMap) and puts them in Build Settings.
    /// Generated scenes are a starting point: once someone hand-edits a scene, stop regenerating it.
    /// </summary>
    public static class SceneBuilder
    {
        private const string P = "Assets/_Project";
        private const string ScenesDir = P + "/Scenes";
        private const string MaterialPath = P + "/Art/Materials/ProtoLit.mat";

        private static readonly Color Wall = new Color(0.93f, 0.91f, 0.86f);
        private static readonly Color FloorShop = new Color(0.82f, 0.84f, 0.86f);
        private static readonly Color FloorStore = new Color(0.62f, 0.62f, 0.6f);
        private static readonly Color Yellow = new Color(1f, 0.82f, 0.15f);

        [MenuItem("MiniMart/Build Sprint 1 Scenes", priority = 2)]
        public static void BuildAllMenu()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            if (!EditorUtility.DisplayDialog("MiniMart",
                    "This regenerates the Sprint 1 prefabs and the Bootstrap, MainMenu, Supermarket and TestMap scenes, replacing any edits to them. Continue?",
                    "Build", "Cancel")) return;
            BuildAll();
            EditorSceneManager.OpenScene($"{ScenesDir}/Supermarket.unity");
            EditorUtility.DisplayDialog("MiniMart", "Scenes built. Supermarket.unity is open: press Play, or open Bootstrap to start from the menu.", "OK");
        }

        public static void BuildAll()
        {
            var catalogue = CatalogueImporter.LoadCatalogue() ?? CatalogueImporter.Import();
            if (catalogue == null) { Debug.LogError("No catalogue - cannot build scenes."); return; }

            CatalogueImporter.EnsureFolder($"{P}/Art/Materials");
            CatalogueImporter.EnsureFolder($"{ScenesDir}/TestMaps");
            ProtoBuilder.SharedMaterial = SharedMaterialAsset();
            ProtoBuilder.MaterialForColor = ColourMaterial;
            try
            {
                Build(catalogue);
            }
            finally
            {
                ProtoBuilder.MaterialForColor = null;
                ProtoBuilder.SharedMaterial = null;
            }
        }

        private static void Build(ProductCatalogue catalogue)
        {
            NewScene();   // build prefabs in a throwaway scene, not whatever was open
            var prefabs = BuildPrefabs(catalogue);

            BuildBootstrap();
            BuildMainMenu();
            BuildSupermarket(catalogue, prefabs);
            BuildTestMap(catalogue, prefabs);

            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene($"{ScenesDir}/{SceneNames.Bootstrap}.unity", true),
                new EditorBuildSettingsScene($"{ScenesDir}/{SceneNames.MainMenu}.unity", true),
                new EditorBuildSettingsScene($"{ScenesDir}/{SceneNames.Supermarket}.unity", true),
                new EditorBuildSettingsScene($"{ScenesDir}/TestMaps/{SceneNames.TestMap}.unity", true),
            };
            AssetDatabase.SaveAssets();
            Debug.Log("MiniMart: Sprint 1 scenes built and added to Build Settings.");
        }

        // ------------------------------------------------------------------ prefabs

        private sealed class Prefabs
        {
            public GameObject Player;
            public ProductBox Box;
            public readonly Dictionary<FixtureKind, ShelfFixture> Fixtures = new Dictionary<FixtureKind, ShelfFixture>();
        }

        private static Material SharedMaterialAsset()
        {
            var mat = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (mat != null) return mat;
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            mat = new Material(shader) { name = "ProtoLit" };
            AssetDatabase.CreateAsset(mat, MaterialPath);
            return mat;
        }

        private static readonly Dictionary<string, Material> ColourCache = new Dictionary<string, Material>();

        /// <summary>One saved material per grey-box colour (Art/Materials/Proto_RRGGBB.mat).</summary>
        private static Material ColourMaterial(Color c)
        {
            string hex = ColorUtility.ToHtmlStringRGB(c);
            if (ColourCache.TryGetValue(hex, out var cached) && cached != null) return cached;
            string path = $"{P}/Art/Materials/Proto_{hex}.mat";
            var mat = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (mat == null)
            {
                mat = new Material(ProtoBuilder.SharedMaterial) { name = $"Proto_{hex}" };
                if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);
                if (mat.HasProperty("_Color")) mat.SetColor("_Color", c);
                AssetDatabase.CreateAsset(mat, path);
            }
            ColourCache[hex] = mat;
            return mat;
        }

        private static Prefabs BuildPrefabs(ProductCatalogue catalogue)
        {
            var result = new Prefabs();
            CatalogueImporter.EnsureFolder($"{P}/Prefabs/Players");
            CatalogueImporter.EnsureFolder($"{P}/Prefabs/Products");
            CatalogueImporter.EnsureFolder($"{P}/Prefabs/Fixtures");

            var player = PlayerRigBuilder.Build(Vector3.zero);
            result.Player = Save(player, $"{P}/Prefabs/Players/Player.prefab");

            var box = ProductBox.BuildPrimitive(Vector3.zero, Quaternion.identity);
            result.Box = Save(box.gameObject, $"{P}/Prefabs/Products/ProductBox.prefab").GetComponent<ProductBox>();

            foreach (var def in catalogue.Fixtures)
            {
                var f = FixtureBuilder.Build(def, Vector3.zero, Quaternion.identity);
                result.Fixtures[def.Kind] = Save(f.gameObject, $"{P}/Prefabs/Fixtures/{def.Kind}.prefab").GetComponent<ShelfFixture>();
            }
            return result;
        }

        private static GameObject Save(GameObject go, string path)
        {
            var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
            Object.DestroyImmediate(go);
            return prefab;
        }

        private static T Place<T>(T prefab, Vector3 pos, float yaw, Transform parent = null) where T : Component
        {
            var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab.gameObject, parent);
            go.transform.SetPositionAndRotation(pos, Quaternion.Euler(0, yaw, 0));
            return go.GetComponent<T>();
        }

        // ------------------------------------------------------------------ scenes

        private static Scene NewScene() => EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        private static void SaveScene(Scene scene, string path)
        {
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, path);
        }

        private static void BuildBootstrap()
        {
            var s = NewScene();
            new GameObject("GameBootstrap").AddComponent<GameBootstrap>();
            SaveScene(s, $"{ScenesDir}/{SceneNames.Bootstrap}.unity");
        }

        private static void BuildMainMenu()
        {
            var s = NewScene();
            var cam = new GameObject("Main Camera").AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.12f, 0.16f, 0.22f);
            cam.gameObject.tag = "MainCamera";
            new GameObject("MainMenu").AddComponent<MainMenuController>();
            SaveScene(s, $"{ScenesDir}/{SceneNames.MainMenu}.unity");
        }

        private static void AddLighting()
        {
            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.1f;
            sun.shadows = LightShadows.Soft;
            sun.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.56f, 0.6f);
        }

        private static GameObject Solid(string name, Transform parent, Vector3 centre, Vector3 size, Color c) =>
            ProtoBuilder.Block(name, parent, centre, size, c, solid: true);

        /// <summary>
        /// A small corner shop, in metres. Storage room on the west (delivery pad, waste bin), shop floor
        /// on the east with 8 shelves, 2 fridges and 2 produce crates like the prototype's level 1.
        /// Tills are placeholders until checkout arrives in Phase 2.
        /// </summary>
        private static void BuildSupermarket(ProductCatalogue cat, Prefabs prefabs)
        {
            var s = NewScene();
            AddLighting();
            var world = new GameObject("World").transform;
            var fixturesRoot = new GameObject("Fixtures").transform;
            var floorsRoot = new GameObject("Floor").transform; floorsRoot.SetParent(world, false);
            var walls = new GameObject("Walls").transform; walls.SetParent(world, false);

            const float H = 3.2f;     // wall height
            // ground outside, then floors
            Solid("CarPark", floorsRoot, new Vector3(0, -0.06f, -14f), new Vector3(40f, 0.1f, 12f), new Color(0.3f, 0.31f, 0.33f));
            Solid("StorageFloor", floorsRoot, new Vector3(-8f, -0.1f, 0f), new Vector3(8f, 0.2f, 16f), FloorStore);
            Solid("ShopFloor", floorsRoot, new Vector3(4f, -0.1f, 0f), new Vector3(16f, 0.2f, 16f), FloorShop);

            // outer walls (x -12..12, z -8..8); front wall has the entrance at x 3..6
            Solid("WallBack", walls, new Vector3(0, H / 2, 8.1f), new Vector3(24.4f, H, 0.2f), Wall);
            Solid("WallWest", walls, new Vector3(-12.1f, H / 2, 0), new Vector3(0.2f, H, 16.4f), Wall);
            Solid("WallEast", walls, new Vector3(12.1f, H / 2, 0), new Vector3(0.2f, H, 16.4f), Wall);
            Solid("WallFrontL", walls, new Vector3(-4.5f, H / 2, -8.1f), new Vector3(15f, H, 0.2f), Wall);
            Solid("WallFrontR", walls, new Vector3(9f, H / 2, -8.1f), new Vector3(6f, H, 0.2f), Wall);
            Solid("Lintel", walls, new Vector3(4.5f, H - 0.3f, -8.1f), new Vector3(3f, 0.6f, 0.2f), Wall);
            // storage divider with a 2 m doorway (z -0.2 to 1.8)
            Solid("DividerN", walls, new Vector3(-4f, H / 2, 4.9f), new Vector3(0.2f, H, 6.2f), Wall);
            Solid("DividerS", walls, new Vector3(-4f, H / 2, -4.1f), new Vector3(0.2f, H, 7.8f), Wall);
            var sign = ProtoBuilder.Label("StorageSign", walls, new Vector3(-3.85f, 2.6f, 0.8f), "STORAGE", 0.06f, Color.black);
            sign.transform.rotation = Quaternion.Euler(0, -90, 0);

            // storage: delivery pad and waste bin
            var pad = Solid("DeliveryPad", world, new Vector3(-8f, 0.005f, 4f), new Vector3(4f, 0.01f, 4f), Yellow);
            ProtoBuilder.DestroyCollider(pad);
            var padLabel = ProtoBuilder.Label("PadLabel", pad.transform.parent, new Vector3(-8f, 0.02f, 6.3f), "DELIVERIES", 0.08f, Color.black);
            padLabel.transform.rotation = Quaternion.Euler(90, 0, 0);
            var deliveries = pad.AddComponent<DeliveryPad>();
            deliveries.SetDeliveries(new List<DeliveryPad.Delivery>
            {
                D(cat, "bread-loaf", 2), D(cat, "cola-can", 2), D(cat, "chips-pack", 1), D(cat, "rice-1kg", 1),
                D(cat, "milk-packet", 2), D(cat, "egg-tray", 1), D(cat, "tomatoes", 1), D(cat, "onions", 1),
            });
            Bin(world, new Vector3(-10.8f, 0, -6.8f));

            // shop floor: back wall chillers and produce face into the store (-Z)
            Place(prefabs.Fixtures[FixtureKind.Fridge], new Vector3(-1.5f, 0, 7.5f), 180f, fixturesRoot);
            Place(prefabs.Fixtures[FixtureKind.Fridge], new Vector3(0.6f, 0, 7.5f), 180f, fixturesRoot);
            Place(prefabs.Fixtures[FixtureKind.ProduceCrate], new Vector3(5f, 0, 7.2f), 180f, fixturesRoot);
            Place(prefabs.Fixtures[FixtureKind.ProduceCrate], new Vector3(7.2f, 0, 7.2f), 180f, fixturesRoot);
            // two aisles of shelves, back to back pairs facing the front
            foreach (float z in new[] { 3.5f, -0.5f })
                foreach (float x in new[] { -1.5f, 0.6f, 5f, 7.2f })
                    Place(prefabs.Fixtures[FixtureKind.Shelf], new Vector3(x, 0, z), 180f, fixturesRoot);

            // till placeholders by the door
            foreach (var x in new[] { 0f, 8.5f })
            {
                Solid($"TillCounter{(x == 0f ? 1 : 2)}", world, new Vector3(x, 0.45f, -5.2f), new Vector3(2.2f, 0.9f, 0.8f), new Color(0.35f, 0.38f, 0.45f));
                var l = ProtoBuilder.Label("TillLabel", world, new Vector3(x, 1.1f, -4.78f), "Till - coming in Phase 2", 0.025f, Color.white);
                l.transform.rotation = Quaternion.Euler(0, 180, 0);   // readable from inside the shop
            }

            new GameObject("ProductBoxFactory").AddComponent<ProductBoxFactory>().SetPrefab(prefabs.Box);

            var player = (GameObject)PrefabUtility.InstantiatePrefab(prefabs.Player);
            player.transform.SetPositionAndRotation(new Vector3(-8f, 0.05f, -2f), Quaternion.Euler(0, 0, 0));

            SaveScene(s, $"{ScenesDir}/{SceneNames.Supermarket}.unity");
        }

        /// <summary>A bare room for testing interactions: one of each fixture, an expired fridge, a few boxes.</summary>
        private static void BuildTestMap(ProductCatalogue cat, Prefabs prefabs)
        {
            var s = NewScene();
            AddLighting();
            var world = new GameObject("World").transform;
            Solid("Floor", world, new Vector3(0, -0.1f, 0), new Vector3(16f, 0.2f, 16f), FloorShop);

            Place(prefabs.Fixtures[FixtureKind.Shelf], new Vector3(-3f, 0, 4f), 180f);
            var fridge = Place(prefabs.Fixtures[FixtureKind.Fridge], new Vector3(0f, 0, 4f), 180f);
            var milk = cat.Find("milk-packet");
            if (milk != null)
            {
                var so = new SerializedObject(fridge);
                so.FindProperty("startProduct").objectReferenceValue = milk;
                so.FindProperty("startQuantity").intValue = 6;
                so.FindProperty("startExpired").boolValue = true;
                so.ApplyModifiedPropertiesWithoutUndo();
            }
            Place(prefabs.Fixtures[FixtureKind.Freezer], new Vector3(3f, 0, 4f), 180f);
            Place(prefabs.Fixtures[FixtureKind.ProduceCrate], new Vector3(6f, 0, 4f), 180f);

            var pad = Solid("DeliveryPad", world, new Vector3(-4f, 0.005f, -3f), new Vector3(3f, 0.01f, 3f), Yellow);
            ProtoBuilder.DestroyCollider(pad);
            var deliveries = pad.AddComponent<DeliveryPad>();
            deliveries.SetDeliveries(new List<DeliveryPad.Delivery> { D(cat, "cola-can", 1), D(cat, "milk-packet", 1), D(cat, "tomatoes", 1), D(cat, "ice-cream-tub", 1) });
            Bin(world, new Vector3(4f, 0, -4f));

            new GameObject("ProductBoxFactory").AddComponent<ProductBoxFactory>().SetPrefab(prefabs.Box);
            var player = (GameObject)PrefabUtility.InstantiatePrefab(prefabs.Player);
            player.transform.SetPositionAndRotation(new Vector3(0f, 0.05f, -1f), Quaternion.identity);

            SaveScene(s, $"{ScenesDir}/TestMaps/{SceneNames.TestMap}.unity");
        }

        private static DeliveryPad.Delivery D(ProductCatalogue cat, string id, int boxes)
        {
            var p = cat.Find(id);
            if (p == null) Debug.LogWarning($"Catalogue has no product '{id}'");
            return new DeliveryPad.Delivery { product = p, boxes = boxes };
        }

        private static void Bin(Transform parent, Vector3 pos)
        {
            var bin = Solid("WasteBin", parent, pos + new Vector3(0, 0.5f, 0), new Vector3(0.8f, 1.0f, 0.8f), new Color(0.2f, 0.45f, 0.25f));
            bin.AddComponent<WasteBin>();
            bin.AddComponent<MiniMart.Interaction.InteractableHighlight>();
            var l = ProtoBuilder.Label("BinLabel", bin.transform.parent, pos + new Vector3(0, 1.25f, 0), "WASTE", 0.05f, Color.black);
            l.transform.rotation = Quaternion.Euler(0, 180, 0);
        }
    }
}
