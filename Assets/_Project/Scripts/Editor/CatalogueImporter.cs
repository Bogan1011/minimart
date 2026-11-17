using System.Collections.Generic;
using System.IO;
using MiniMart.Fixtures;
using MiniMart.Products;
using MiniMart.Progression;
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

            foreach (var folder in new[] { "Products", "Categories", "Fixtures", "Upgrades", "StoreLevels" })
                EnsureFolder($"{Root}/{folder}");

            // products
            var products = new List<ProductDefinition>();
            var byIndex = new Dictionary<int, ProductDefinition>();
            foreach (var row in data.products)
            {
                var p = LoadOrCreate<ProductDefinition>($"{Root}/Products/{row.id:00}_{row.key}.asset");
                p.EditorSet(row.key, row.id, row.name, row.brand, row.size, row.desc ?? "",
                    PrototypeCatalogue.ParseKind(row.kind), row.unitsPerBox, row.shelfLifeDays, row.cost, row.basePrice,
                    row.licence, ProtoBuilder.Hex(row.color, Color.white), ProtoBuilder.Hex(row.color2, Color.white), row.shape,
                    Barcode(row.id), MassFor(row.shape, row.size));
                EditorUtility.SetDirty(p);
                products.Add(p);
                byIndex[row.id] = p;
            }

            // fixtures: slot layouts are not in the JSON. Totals match BASE_CAP in game.js (see KindRules).
            var fixtures = new List<FixtureDefinition>();
            foreach (FixtureKind kind in System.Enum.GetValues(typeof(FixtureKind)))
            {
                var f = LoadOrCreate<FixtureDefinition>($"{Root}/Fixtures/{kind}.asset");
                string display = KindRules.DisplayName(kind);
                FixtureDefinition.PrototypeShape(kind, out int levels, out int perLevel, out int perSlot);
                f.Configure(kind, char.ToUpperInvariant(display[0]) + display.Substring(1), levels, perLevel, perSlot);
                EditorUtility.SetDirty(f);
                fixtures.Add(f);
            }

            // categories (the prototype's licences)
            var categories = new List<ProductCategoryDefinition>();
            if (data.licences != null)
                foreach (var row in data.licences)
                {
                    var c = LoadOrCreate<ProductCategoryDefinition>($"{Root}/Categories/{row.key}.asset");
                    c.key = row.key; c.displayName = row.name; c.storeLevel = row.level; c.licenceCost = row.cost;
                    c.products = new List<ProductDefinition>();
                    foreach (int id in row.productIds) if (byIndex.TryGetValue(id, out var p)) c.products.Add(p);
                    EditorUtility.SetDirty(c);
                    categories.Add(c);
                }

            // store levels
            if (data.storeLevels != null)
                foreach (var row in data.storeLevels)
                {
                    var s = LoadOrCreate<StoreLevelDefinition>($"{Root}/StoreLevels/Level{row.level}_{row.name.Replace(" ", "")}.asset");
                    s.level = row.level; s.displayName = row.name; s.cost = row.cost; s.servedRequired = row.served;
                    s.reputationRequired = row.rep; s.rentPerDay = row.rent; s.dailyCustomerCap = row.cap; s.crowdCap = row.crowd;
                    s.description = row.desc;
                    s.availableCategories = categories.FindAll(c => c.storeLevel == row.level);
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
            catalogue.SetContents(products, categories, fixtures);
            EditorUtility.SetDirty(catalogue);
            AssetDatabase.SaveAssets();

            var problems = CatalogueValidator.Validate(products);
            foreach (var problem in problems) Debug.LogWarning($"Catalogue: {problem}");
            Debug.Log($"MiniMart: imported {products.Count} products, {fixtures.Count} fixtures, " +
                      $"{categories.Count} categories, {data.storeLevels?.Length ?? 0} store levels, {data.upgrades?.Length ?? 0} upgrades.");
            return catalogue;
        }

        /// <summary>
        /// Placeholder EAN-13 barcode: 890 (India) + 000 + 6-digit index + check digit. Real barcodes
        /// replace these when products get final names.
        /// </summary>
        public static string Barcode(int index)
        {
            string body = $"890000{index:000000}";
            int sum = 0;
            for (int i = 0; i < 12; i++) sum += (body[i] - '0') * (i % 2 == 0 ? 1 : 3);
            return body + ((10 - sum % 10) % 10);
        }

        /// <summary>Rough carry weight from pack shape and size. Only affects feel (blueprint §5.4).</summary>
        public static PackageMass MassFor(string shape, string size)
        {
            string s = (size ?? "").ToLowerInvariant();
            if (shape == "sack" || shape == "oil" || s.Contains("5 kg") || s.Contains("5kg")) return PackageMass.Heavy;
            if (s.Contains("kg") || s.EndsWith(" l") || s.Contains("1 l") || shape == "bottle" || shape == "tub" || shape == "icetub")
                return PackageMass.Medium;
            return PackageMass.Light;
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
