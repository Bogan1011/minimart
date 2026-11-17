using System.Collections.Generic;
using MiniMart.Core;
using MiniMart.Fixtures;
using MiniMart.Interaction;
using MiniMart.Inventory;
using MiniMart.Player;
using MiniMart.Products;
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
    /// MiniMart ▸ Build Scenes. Generates the grey-box prefabs and the blueprint's seven scenes
    /// (00_Bootstrap … 06_TestNPC) and puts them in Build Settings in that order.
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

        public static string ScenePath(string sceneName) => $"{ScenesDir}/{sceneName}.unity";

        [MenuItem("MiniMart/Build Scenes", priority = 3)]
        public static void BuildAllMenu()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            if (!EditorUtility.DisplayDialog("MiniMart",
                    "This regenerates the grey-box prefabs and scenes 00_Bootstrap to 06_TestNPC, replacing any edits to them. Continue?",
                    "Build", "Cancel")) return;
            BuildAll();
            EditorSceneManager.OpenScene(ScenePath(SceneNames.StoreWorld));
            EditorUtility.DisplayDialog("MiniMart",
                "Scenes built. 03_StoreWorld is open: press Play, or open 00_Bootstrap to start from the menu.", "OK");
        }

        public static void BuildAll()
        {
            ProjectSetup.EnsureLayers();
            var catalogue = CatalogueImporter.LoadCatalogue() ?? CatalogueImporter.Import();
            if (catalogue == null) { Debug.LogError("No catalogue - cannot build scenes."); return; }

            CatalogueImporter.EnsureFolder($"{P}/Art/Materials");
            CatalogueImporter.EnsureFolder(ScenesDir);
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
            BuildMenuScene(SceneNames.MainMenu, go => go.AddComponent<MainMenuController>());
            BuildMenuScene(SceneNames.Lobby, go => go.AddComponent<LobbyController>());
            BuildStoreWorld(catalogue, prefabs);
            BuildMenuScene(SceneNames.Loading, go => go.AddComponent<LoadingScreen>());
            BuildTestPhysics(catalogue, prefabs);
            BuildTestNpc(prefabs);

            var scenes = new List<EditorBuildSettingsScene>();
            foreach (var name in SceneNames.BuildOrder) scenes.Add(new EditorBuildSettingsScene(ScenePath(name), true));
            EditorBuildSettings.scenes = scenes.ToArray();
            AssetDatabase.SaveAssets();
            Debug.Log("MiniMart: scenes 00-06 built and added to Build Settings.");
        }

        // ------------------------------------------------------------------ prefabs

        private sealed class Prefabs
        {
            public GameObject Player;
            public ProductBoxController Box;
            public GameObject StorageRack;
            public readonly Dictionary<FixtureKind, ShelfFixture> Fixtures = new Dictionary<FixtureKind, ShelfFixture>();
        }

        private static Material SharedMaterialAsset()
        {
            var mat = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (mat != null) return mat;
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            mat = new Material(shader) { name = "ProtoLit", enableInstancing = true };
            AssetDatabase.CreateAsset(mat, MaterialPath);
            return mat;
        }

        private static readonly Dictionary<string, Material> ColourCache = new Dictionary<string, Material>();

        /// <summary>One saved material per grey-box colour (Art/Materials/Proto_RRGGBB.mat), GPU instancing on.</summary>
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
            mat.enableInstancing = true;
            ColourCache[hex] = mat;
            return mat;
        }

        private static Prefabs BuildPrefabs(ProductCatalogue catalogue)
        {
            var result = new Prefabs();
            foreach (var dir in new[] { "Player", "Boxes", "Shelves", "Storage" })
                CatalogueImporter.EnsureFolder($"{P}/Prefabs/{dir}");

            result.Player = Save(PlayerRigBuilder.Build(Vector3.zero), $"{P}/Prefabs/Player/Player.prefab");

            var box = ProductBoxController.BuildPrimitive(Vector3.zero, Quaternion.identity);
            result.Box = Save(box.gameObject, $"{P}/Prefabs/Boxes/ProductBox.prefab").GetComponent<ProductBoxController>();

            result.StorageRack = Save(StorageRackBuilder.Build(Vector3.zero, Quaternion.identity), $"{P}/Prefabs/Storage/StorageRack.prefab");

            foreach (var def in catalogue.Fixtures)
            {
                var f = FixtureBuilder.Build(def, Vector3.zero, Quaternion.identity);
                result.Fixtures[def.Kind] = Save(f.gameObject, $"{P}/Prefabs/Shelves/{def.Kind}.prefab").GetComponent<ShelfFixture>();
            }
            return result;
        }

        private static GameObject Save(GameObject go, string path)
        {
            var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
            Object.DestroyImmediate(go);
            return prefab;
        }

        private static GameObject Place(GameObject prefab, Vector3 pos, float yaw, Transform parent = null)
        {
            var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab, parent);
            go.transform.SetPositionAndRotation(pos, Quaternion.Euler(0, yaw, 0));
            return go;
        }

        private static T Place<T>(T prefab, Vector3 pos, float yaw, Transform parent = null) where T : Component =>
            Place(prefab.gameObject, pos, yaw, parent).GetComponent<T>();

        // ------------------------------------------------------------------ scenes

        private static Scene NewScene() => EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        private static void SaveScene(Scene scene, string sceneName)
        {
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath(sceneName));
        }

        private static void BuildBootstrap()
        {
            var s = NewScene();
            new GameObject("GameBootstrap").AddComponent<GameBootstrap>();
            SaveScene(s, SceneNames.Bootstrap);
        }

        /// <summary>A camera and one UI controller: main menu, lobby and loading screen.</summary>
        private static void BuildMenuScene(string sceneName, System.Action<GameObject> addController)
        {
            var s = NewScene();
            var cam = new GameObject("Main Camera").AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.12f, 0.16f, 0.22f);
            cam.allowMSAA = false;
            cam.gameObject.tag = "MainCamera";
            var go = new GameObject(sceneName.Substring(3));
            addController(go);
            SaveScene(s, sceneName);
        }

        /// <summary>
        /// One directional light, flat ambient, no realtime extras. Fine for Iris Xe; bake lighting
        /// once the store layout stops changing (see Docs/WebAndLAN.md).
        /// </summary>
        private static void AddLighting()
        {
            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.1f;
            sun.shadows = LightShadows.Hard;
            sun.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.56f, 0.6f);
        }

        private static GameObject Solid(string name, Transform parent, Vector3 centre, Vector3 size, Color c, string layer = GameLayers.World)
        {
            var go = ProtoBuilder.Block(name, parent, centre, size, c, solid: true);
            GameLayers.Set(go, layer);
            return go;
        }

        private static void SpawnPlayer(Prefabs prefabs, Vector3 pos, float yaw = 0f) => Place(prefabs.Player, pos, yaw);

        private static void BoxFactory(Prefabs prefabs) =>
            new GameObject("ProductBoxFactory").AddComponent<ProductBoxFactory>().SetPrefab(prefabs.Box);

        /// <summary>
        /// 03_StoreWorld: a small corner shop, in metres. Storage room on the west (delivery pad, storage
        /// rack, waste bin), shop floor on the east with 8 shelves, 2 fridges and 2 produce crates like the
        /// prototype's level 1. Tills are placeholders until checkout (Target A).
        /// </summary>
        private static void BuildStoreWorld(ProductCatalogue cat, Prefabs prefabs)
        {
            var s = NewScene();
            AddLighting();
            var world = new GameObject("World").transform;
            var fixturesRoot = new GameObject("Fixtures").transform;
            var floorsRoot = new GameObject("Floor").transform; floorsRoot.SetParent(world, false);
            var walls = new GameObject("Walls").transform; walls.SetParent(world, false);

            const float H = 3.2f;     // wall height
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

            // storage room: delivery pad, rack against the west wall, waste bin
            DeliveryPadAt(world, new Vector3(-8f, 0, 4f), new Vector2(4f, 4f), new List<DeliveryPad.Delivery>
            {
                D(cat, "bread-loaf", 2), D(cat, "cola-can", 2), D(cat, "chips-pack", 1), D(cat, "rice-1kg", 1),
                D(cat, "milk-packet", 2), D(cat, "egg-tray", 1), D(cat, "tomatoes", 1), D(cat, "onions", 1),
            });
            Place(prefabs.StorageRack, new Vector3(-11.6f, 0, -3f), 90f, fixturesRoot);
            Bin(world, new Vector3(-10.8f, 0, -6.8f));

            // shop floor: back wall chillers and produce face into the store (-Z)
            Place(prefabs.Fixtures[FixtureKind.Fridge], new Vector3(-1.5f, 0, 7.5f), 180f, fixturesRoot);
            Place(prefabs.Fixtures[FixtureKind.Fridge], new Vector3(0.6f, 0, 7.5f), 180f, fixturesRoot);
            Place(prefabs.Fixtures[FixtureKind.ProduceCrate], new Vector3(5f, 0, 7.2f), 180f, fixturesRoot);
            Place(prefabs.Fixtures[FixtureKind.ProduceCrate], new Vector3(7.2f, 0, 7.2f), 180f, fixturesRoot);
            foreach (float z in new[] { 3.5f, -0.5f })
                foreach (float x in new[] { -1.5f, 0.6f, 5f, 7.2f })
                    Place(prefabs.Fixtures[FixtureKind.Shelf], new Vector3(x, 0, z), 180f, fixturesRoot);

            // till placeholders by the door
            foreach (var x in new[] { 0f, 8.5f })
            {
                Solid($"TillCounter{(x == 0f ? 1 : 2)}", world, new Vector3(x, 0.45f, -5.2f), new Vector3(2.2f, 0.9f, 0.8f),
                    new Color(0.35f, 0.38f, 0.45f), GameLayers.Checkout);
                var l = ProtoBuilder.Label("TillLabel", world, new Vector3(x, 1.1f, -4.78f), "Till - coming with checkout", 0.025f, Color.white);
                l.transform.rotation = Quaternion.Euler(0, 180, 0);   // readable from inside the shop
            }

            BoxFactory(prefabs);
            SpawnPlayer(prefabs, new Vector3(-8f, 0.05f, -2f));
            SaveScene(s, SceneNames.StoreWorld);
        }

        /// <summary>
        /// 05_TestPhysics: everything the blueprint's physics checks need in one room. Walls with a
        /// corner and a doorway (safe drop near walls), one of each fixture (stocking), an expired fridge
        /// (clear-out), a storage rack, a stack of boxes (pick-up from a stack), a delivery pad and a bin.
        /// </summary>
        private static void BuildTestPhysics(ProductCatalogue cat, Prefabs prefabs)
        {
            var s = NewScene();
            AddLighting();
            var world = new GameObject("World").transform;
            const float H = 2.6f;
            Solid("Floor", world, new Vector3(0, -0.1f, 0), new Vector3(16f, 0.2f, 16f), FloorShop);
            Solid("WallN", world, new Vector3(0, H / 2, 8.1f), new Vector3(16.4f, H, 0.2f), Wall);
            Solid("WallS", world, new Vector3(0, H / 2, -8.1f), new Vector3(16.4f, H, 0.2f), Wall);
            Solid("WallW", world, new Vector3(-8.1f, H / 2, 0), new Vector3(0.2f, H, 16.4f), Wall);
            Solid("WallE", world, new Vector3(8.1f, H / 2, 0), new Vector3(0.2f, H, 16.4f), Wall);
            // inner wall with a 1.2 m doorway at x 0..1.2, making a corner in the south-west room
            Solid("InnerWallL", world, new Vector3(-4f, H / 2, -2f), new Vector3(8f, H, 0.2f), Wall);
            Solid("InnerWallR", world, new Vector3(4.6f, H / 2, -2f), new Vector3(6.8f, H, 0.2f), Wall);
            // a low step and a ramp to check the floor-angle rule when dropping
            Solid("Step", world, new Vector3(5.5f, 0.1f, -5.5f), new Vector3(2f, 0.2f, 2f), FloorStore);
            var ramp = Solid("Ramp", world, new Vector3(5.5f, 0.35f, -3.6f), new Vector3(2f, 0.1f, 2.2f), FloorStore);
            ramp.transform.rotation = Quaternion.Euler(-40f, 0, 0);

            var fixtures = new GameObject("Fixtures").transform;
            Place(prefabs.Fixtures[FixtureKind.Shelf], new Vector3(-5f, 0, 7.4f), 180f, fixtures);
            var fridge = Place(prefabs.Fixtures[FixtureKind.Fridge], new Vector3(-2.5f, 0, 7.4f), 180f, fixtures);
            var milk = cat.Find("milk-packet");
            if (milk != null)
            {
                fridge.SetStartStock(milk, 6, expired: true);
                PrefabUtility.RecordPrefabInstancePropertyModifications(fridge);
            }
            Place(prefabs.Fixtures[FixtureKind.Freezer], new Vector3(0.5f, 0, 7.4f), 180f, fixtures);
            Place(prefabs.Fixtures[FixtureKind.ProduceCrate], new Vector3(3f, 0, 7.4f), 180f, fixtures);
            Place(prefabs.StorageRack, new Vector3(7.6f, 0, 3f), -90f, fixtures);

            DeliveryPadAt(world, new Vector3(-5f, 0, 2f), new Vector2(3f, 3f), new List<DeliveryPad.Delivery>
            {
                D(cat, "cola-can", 1), D(cat, "milk-packet", 1), D(cat, "tomatoes", 1), D(cat, "ice-cream-tub", 1),
            });
            Bin(world, new Vector3(-7.2f, 0, -7.2f));

            // a stack of three boxes in the south-west corner room
            var stackProduct = cat.Find("chips-pack");
            for (int i = 0; i < 3; i++)
            {
                var box = Place(prefabs.Box, new Vector3(-6.5f, (i + 0.5f) * ProductBoxController.DefaultSize.y, -6.8f), 0f);
                var so = new SerializedObject(box);
                so.FindProperty("startProduct").objectReferenceValue = stackProduct;
                so.ApplyModifiedPropertiesWithoutUndo();
            }

            var note = ProtoBuilder.Label("Notes", world, new Vector3(0, 2.2f, 7.95f),
                "05_TestPhysics: drop boxes by walls, in the corner, in the doorway and on the ramp", 0.03f, Color.black);
            note.transform.rotation = Quaternion.Euler(0, 180, 0);

            BoxFactory(prefabs);
            SpawnPlayer(prefabs, new Vector3(0f, 0.05f, 1f));
            SaveScene(s, SceneNames.TestPhysics);
        }

        /// <summary>06_TestNPC: placeholder room for customer navigation (NavMesh arrives with Target A).</summary>
        private static void BuildTestNpc(Prefabs prefabs)
        {
            var s = NewScene();
            AddLighting();
            var world = new GameObject("World").transform;
            Solid("Floor", world, new Vector3(0, -0.1f, 0), new Vector3(20f, 0.2f, 20f), FloorShop);
            Place(prefabs.Fixtures[FixtureKind.Shelf], new Vector3(-2f, 0, 3f), 180f);
            Place(prefabs.Fixtures[FixtureKind.Shelf], new Vector3(2f, 0, 3f), 180f);
            Solid("TillCounter", world, new Vector3(0, 0.45f, -4f), new Vector3(2.2f, 0.9f, 0.8f), new Color(0.35f, 0.38f, 0.45f), GameLayers.Checkout);
            var l = ProtoBuilder.Label("Todo", world, new Vector3(0, 1.6f, 6f),
                "06_TestNPC: customers, NavMesh and queueing arrive with Target A", 0.04f, Color.black);
            l.transform.rotation = Quaternion.Euler(0, 180, 0);
            BoxFactory(prefabs);
            SpawnPlayer(prefabs, new Vector3(0f, 0.05f, -7f));
            SaveScene(s, SceneNames.TestNPC);
        }

        private static void DeliveryPadAt(Transform parent, Vector3 centre, Vector2 size, List<DeliveryPad.Delivery> deliveries)
        {
            var pad = ProtoBuilder.Block("DeliveryPad", parent, centre + new Vector3(0, 0.005f, 0), new Vector3(size.x, 0.01f, size.y), Yellow);
            ProtoBuilder.DestroyCollider(pad);
            GameLayers.Set(pad, GameLayers.Decoration);
            var label = ProtoBuilder.Label("PadLabel", parent, centre + new Vector3(0, 0.02f, size.y / 2f + 0.3f), "DELIVERIES", 0.08f, Color.black);
            label.transform.rotation = Quaternion.Euler(90, 0, 0);
            pad.AddComponent<DeliveryPad>().SetDeliveries(deliveries);
        }

        private static DeliveryPad.Delivery D(ProductCatalogue cat, string id, int boxes)
        {
            var p = cat.Find(id);
            if (p == null) Debug.LogWarning($"Catalogue has no product '{id}'");
            return new DeliveryPad.Delivery { product = p, boxes = boxes };
        }

        private static void Bin(Transform parent, Vector3 pos)
        {
            var bin = Solid("WasteBin", parent, pos + new Vector3(0, 0.5f, 0), new Vector3(0.8f, 1.0f, 0.8f), new Color(0.2f, 0.45f, 0.25f), GameLayers.Fixture);
            bin.AddComponent<WasteBin>();
            bin.AddComponent<InteractableHighlight>();
            var l = ProtoBuilder.Label("BinLabel", bin.transform.parent, pos + new Vector3(0, 1.25f, 0), "WASTE", 0.05f, Color.black);
            l.transform.rotation = Quaternion.Euler(0, 180, 0);
        }
    }
}
