using System.Collections.Generic;
using System.IO;
using System.Linq;
using MiniMart.Data;
using MiniMart.EditorTools;
using MiniMart.Simulation.Catalogue;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace MiniMart.Tests
{
    /// <summary>
    /// The prototype catalogue: checked on the source JSON (always) and on the imported
    /// ScriptableObjects (once MiniMart ▸ Import Prototype Catalogue has been run).
    /// </summary>
    public class CatalogueTests
    {
        private static PrototypeCatalogue Source()
        {
            Assert.IsTrue(File.Exists(CatalogueImporter.SourcePath), $"missing {CatalogueImporter.SourcePath}");
            return JsonUtility.FromJson<PrototypeCatalogue>(File.ReadAllText(CatalogueImporter.SourcePath));
        }

        [Test]
        public void SourceHas36ProductsIn7Licences()
        {
            var c = Source();
            Assert.AreEqual(36, c.products.Length);
            Assert.AreEqual(7, c.licences.Length);
            Assert.AreEqual(4, c.storeLevels.Length);
            Assert.AreEqual(9, c.upgrades.Length);
        }

        [Test]
        public void EveryProductIsInExactlyOneLicence()
        {
            var c = Source();
            var count = new Dictionary<int, int>();
            foreach (var l in c.licences)
                foreach (var id in l.productIds)
                    count[id] = (count.TryGetValue(id, out var n) ? n : 0) + 1;
            foreach (var p in c.products)
            {
                Assert.IsTrue(count.ContainsKey(p.id), $"{p.name} is in no licence");
                Assert.AreEqual(1, count[p.id], $"{p.name} is in more than one licence");
                Assert.IsNotEmpty(p.licence, $"{p.name} has no licence key");
            }
        }

        [Test]
        public void SupplierCostIsBelowPriceForEveryProduct()
        {
            foreach (var p in Source().products)
            {
                Assert.Greater(p.basePrice, p.cost, p.name);
                Assert.Greater(p.unitsPerBox, 0, p.name);
                Assert.DoesNotThrow(() => PrototypeCatalogue.ParseKind(p.kind), p.name);
            }
        }

        [TestCase("milk-packet", 30, 26, 16, 3)]
        [TestCase("bread-loaf", 45, 37, 10, 2)]
        [TestCase("atta-5kg", 355, 300, 4, 0)]
        [TestCase("cola-can", 40, 32, 24, 0)]
        public void SpotCheckPrototypeValues(string key, int price, int cost, int perBox, int life)
        {
            var p = Source().products.Single(x => x.key == key);
            Assert.AreEqual(price, p.basePrice);
            Assert.AreEqual(cost, p.cost);
            Assert.AreEqual(perBox, p.unitsPerBox);
            Assert.AreEqual(life, p.shelfLifeDays);
        }

        [Test]
        public void StoreLevelsMatchThePrototype()
        {
            var lv = Source().storeLevels;
            CollectionAssert.AreEqual(new[] { "Corner Shop", "Mini Market", "Supermarket", "Superstore" }, lv.Select(l => l.name).ToArray());
            CollectionAssert.AreEqual(new[] { 0, 7500, 20000, 45000 }, lv.Select(l => l.cost).ToArray());
            CollectionAssert.AreEqual(new[] { 0, 50, 180, 450 }, lv.Select(l => l.served).ToArray());
            CollectionAssert.AreEqual(new[] { 0, 0, 55, 65 }, lv.Select(l => l.rep).ToArray());
            CollectionAssert.AreEqual(new[] { 300, 700, 1400, 2400 }, lv.Select(l => l.rent).ToArray());
        }

        // ---- imported assets

        private static ProductCatalogue Imported()
        {
            var cat = CatalogueImporter.LoadCatalogue();
            if (cat == null) Assert.Ignore("Run MiniMart ▸ Import Prototype Catalogue first.");
            return cat;
        }

        [Test]
        public void ImportedCatalogueIsValid()
        {
            var cat = Imported();
            Assert.AreEqual(36, cat.Products.Count);
            var problems = CatalogueValidator.Validate(cat.Products.Cast<IProduct>());
            Assert.IsEmpty(problems, string.Join("\n", problems));
        }

        [Test]
        public void ImportedFixturesHavePrototypeCapacities()
        {
            var cat = Imported();
            foreach (FixtureKind kind in System.Enum.GetValues(typeof(FixtureKind)))
            {
                var f = cat.FindFixture(kind);
                Assert.IsNotNull(f, $"no fixture asset for {kind}");
                Assert.AreEqual(KindRules.PrototypeBaseCapacity(kind), f.BaseCapacity, kind.ToString());
            }
        }

        [Test]
        public void ImportedProductsMatchTheSource()
        {
            var cat = Imported();
            foreach (var row in Source().products)
            {
                var p = cat.Find(row.key);
                Assert.IsNotNull(p, row.key);
                Assert.AreEqual(row.name, p.DisplayName);
                Assert.AreEqual(row.basePrice, p.BasePrice, row.key);
                Assert.AreEqual(row.cost, p.SupplierCost, row.key);
                Assert.AreEqual(row.unitsPerBox, p.UnitsPerBox, row.key);
                Assert.AreEqual(row.shelfLifeDays, p.ShelfLifeDays, row.key);
                Assert.AreEqual(PrototypeCatalogue.ParseKind(row.kind), p.Kind, row.key);
            }
        }

        [Test]
        public void ValidatorCatchesBadData()
        {
            var bad = new[]
            {
                new TestProduct { ProductId = "x", DisplayName = "X", Kind = ProductKind.Dry, UnitsPerBox = 0, SupplierCost = 50, BasePrice = 40 },
                new TestProduct { ProductId = "x", DisplayName = "Y", Kind = ProductKind.Dry, UnitsPerBox = 1, SupplierCost = 1, BasePrice = 2 },
            };
            var problems = CatalogueValidator.Validate(bad);
            Assert.That(problems.Any(p => p.Contains("units per box")));
            Assert.That(problems.Any(p => p.Contains("not below price")));
            Assert.That(problems.Any(p => p.Contains("duplicate")));
        }
    }
}
