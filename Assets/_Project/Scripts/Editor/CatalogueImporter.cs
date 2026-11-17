using System.Collections.Generic;
using System.IO;
using MiniMart.Data;
using MiniMart.Simulation.Catalogue;
using MiniMart.World;
using UnityEditor;
using UnityEngine;

namespace MiniMart.EditorTools
{
    /// <summary>
    /// MiniMart ▸ Import Prototype Catalogue. Turns the prototype's data (JSON) into ScriptableObjects.
    /// Safe to run again: existing assets are updated in place, so references and GUIDs survive.
    /// Note: re-running overwrites hand edits to imported fields. Once you start rebalancing in the
    /// Inspector, stop re-importing (or edit the JSON instead).
    /// </summary>
    public static class CatalogueImporter
    {
        public const string Root = "Assets/_Project/ScriptableObjects";
        public const string SourcePath = Root + "/_Source/prototype-catalogue.json";
        public const string CataloguePath = Root + "/ProductCatalogue.asset";

        [MenuItem("MiniMart/Import Prototype Catalogue", priority = 1)]
        public static void ImportMenu()
        {
            var cat = Import();
            if (cat != null)
                EditorUtility.DisplayDialog("MiniMart", $"Imported {cat.Products.Count} products and {cat.Fixtures.Count} fixture types.", "OK");
        }

        public static ProductCatalogue Import()
        {
            if (!File.Exists(SourcePath))
            {
                Debug.LogError($"Catalogue source not found at {SourcePath}");
                return null;
            }
            var data = JsonUtility.FromJson<PrototypeCatalogue>(File.ReadAllText(SourcePath));
            if (data == null || data.products == null || data.products.Length == 0)
            {
                Debug.LogError("Catalogue JSON has no products.");
                return null;
            }

            foreach (var folder in new[] { "Products", "Fixtures", "Licences", "Upgrades", "Progression" })
                EnsureFolder($"{Root}/{folder}");

            // products
            var products = new List<ProductDefinition>();
            var byIndex = new Dictionary<int, ProductDefinition>();
            foreach (var row in data.products)
            {
                var p = LoadOrCreate<ProductDefinition>($"{Root}/Products/{row.id:00}_{row.key}.asset");
                p.EditorSet(row.key, row.id, row.name, row.brand, row.size, row.desc ?? "",
                    PrototypeCatalogue.ParseKind(row.kind), row.unitsPerBox, row.shelfLifeDays, row.cost, row.basePrice,
                    row.licence, ProtoBuilder.Hex(row.color, Color.white), ProtoBuilder.Hex(row.color2, Color.white), row.shape);
                EditorUtility.SetDirty(p);
                products.Add(p);
                byIndex[row.id] = p;
            }

            // fixtures (base capacities are not in the JSON: they're BASE_CAP in game.js, mirrored in KindRules)
            var fixtures = new List<FixtureDefinition>();
            foreach (FixtureKind kind in System.Enum.GetValues(typeof(FixtureKind)))
            {
                var f = LoadOrCreate<FixtureDefinition>($"{Root}/Fixtures/{kind}.asset");
                string display = KindRules.DisplayName(kind);
                f.Configure(kind, char.ToUpperInvariant(display[0]) + display.Substring(1), KindRules.PrototypeBaseCapacity(kind));
                EditorUtility.SetDirty(f);
                fixtures.Add(f);
            }

            // licences
            if (data.licences != null)
                foreach (var row in data.licences)
                {
                    var l = LoadOrCreate<LicenceDefinition>($"{Root}/Licences/{row.key}.asset");
                    l.key = row.key; l.displayName = row.name; l.storeLevel = row.level; l.cost = row.cost;
                    l.products = new List<ProductDefinition>();
                    foreach (int id in row.productIds) if (byIndex.TryGetValue(id, out var p)) l.products.Add(p);
                    EditorUtility.SetDirty(l);
                }

            // store levels
            if (data.storeLevels != null)
                foreach (var row in data.storeLevels)
                {
                    var s = LoadOrCreate<StoreLevelDefinition>($"{Root}/Progression/Level{row.level}_{row.name.Replace(" ", "")}.asset");
                    s.level = row.level; s.displayName = row.name; s.cost = row.cost; s.servedRequired = row.served;
                    s.reputationRequired = row.rep; s.rentPerDay = row.rent; s.dailyCustomerCap = row.cap; s.crowdCap = row.crowd;
                    s.description = row.desc;
                    EditorUtility.SetDirty(s);
                }

            // upgrades
            if (data.upgrades != null)
                foreach (var row in data.upgrades)
                {
                    var u = LoadOrCreate<UpgradeDefinition>($"{Root}/Upgrades/{row.key}.asset");
                    u.key = row.key; u.displayName = row.name; u.storeLevel = row.level; u.maxCount = Mathf.Max(1, row.max);
                    u.dailyWage = row.wage; u.description = row.desc; u.costs = new List<int>(row.cost ?? new int[0]);
                    EditorUtility.SetDirty(u);
                }

            var catalogue = LoadOrCreate<ProductCatalogue>(CataloguePath);
            catalogue.SetContents(products, fixtures);
            EditorUtility.SetDirty(catalogue);
            AssetDatabase.SaveAssets();

            var problems = CatalogueValidator.Validate(products);
            foreach (var problem in problems) Debug.LogWarning($"Catalogue: {problem}");
            Debug.Log($"MiniMart: imported {products.Count} products, {fixtures.Count} fixtures, " +
                      $"{data.licences?.Length ?? 0} licences, {data.storeLevels?.Length ?? 0} store levels, {data.upgrades?.Length ?? 0} upgrades.");
            return catalogue;
        }

        public static ProductCatalogue LoadCatalogue() => AssetDatabase.LoadAssetAtPath<ProductCatalogue>(CataloguePath);

        private static T LoadOrCreate<T>(string path) where T : ScriptableObject
        {
            var a = AssetDatabase.LoadAssetAtPath<T>(path);
            if (a != null) return a;
            a = ScriptableObject.CreateInstance<T>();
            AssetDatabase.CreateAsset(a, path);
            return a;
        }

        public static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            string parent = Path.GetDirectoryName(path)?.Replace('\\', '/');
            if (!string.IsNullOrEmpty(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
    }
}
