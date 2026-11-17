using MiniMart.Simulation.Catalogue;
using MiniMart.Simulation.Inventory;
using NUnit.Framework;

namespace MiniMart.Tests
{
    /// <summary>Stocking rules from the prototype (game.js probe / stockInto / pull). See Docs/BehaviourSpec.md §4.</summary>
    public class StockRulesTests
    {
        private static FixtureStock Shelf(int cap = 24) => new FixtureStock(FixtureKind.Shelf, cap);
        private static FixtureStock Fridge(int cap = 18) => new FixtureStock(FixtureKind.Fridge, cap);

        [Test]
        public void KindsMapToTheRightFixture()
        {
            Assert.AreEqual(FixtureKind.Shelf, KindRules.FixtureFor(ProductKind.Dry));
            Assert.AreEqual(FixtureKind.Fridge, KindRules.FixtureFor(ProductKind.Chilled));
            Assert.AreEqual(FixtureKind.Freezer, KindRules.FixtureFor(ProductKind.Frozen));
            Assert.AreEqual(FixtureKind.ProduceCrate, KindRules.FixtureFor(ProductKind.Produce));
        }

        [Test]
        public void PrototypeBaseCapacities()
        {
            Assert.AreEqual(24, KindRules.PrototypeBaseCapacity(FixtureKind.Shelf));
            Assert.AreEqual(18, KindRules.PrototypeBaseCapacity(FixtureKind.Fridge));
            Assert.AreEqual(16, KindRules.PrototypeBaseCapacity(FixtureKind.Freezer));
            Assert.AreEqual(20, KindRules.PrototypeBaseCapacity(FixtureKind.ProduceCrate));
        }

        [Test]
        public void FreshBoxIsFullWithFullShelfLife()
        {
            var bread = BoxContents.FreshFromSupplier(TestProduct.Bread);
            Assert.AreEqual(10, bread.Units);
            Assert.AreEqual(2, bread.DaysLeft);

            var cola = BoxContents.FreshFromSupplier(TestProduct.Cola);
            Assert.AreEqual(24, cola.Units);
            Assert.IsNull(cola.DaysLeft, "non-perishables have no expiry");
        }

        [Test]
        public void EmptyShelfTakesTheBoxsProductAndLife()
        {
            var shelf = Shelf();
            var box = BoxContents.FreshFromSupplier(TestProduct.Bread);

            var check = StockRules.Check(shelf, box);
            Assert.AreEqual(StockVerdict.CanStock, check.Verdict);
            Assert.AreEqual("Stock Bread Loaf (0/24)", check.Prompt);

            int moved = StockRules.Stock(shelf, box);
            Assert.AreEqual(10, moved);
            Assert.AreEqual(10, shelf.Quantity);
            Assert.AreEqual(0, box.Units);
            Assert.IsTrue(box.IsEmpty);
            Assert.AreSame(TestProduct.Bread, shelf.Product);
            Assert.AreEqual(2, shelf.DaysLeft);
        }

        [Test]
        public void StockingStopsAtCapacityAndLeavesTheRestInTheBox()
        {
            var shelf = Shelf();
            StockRules.Stock(shelf, new BoxContents(TestProduct.Cola, 20, null));
            var box = BoxContents.FreshFromSupplier(TestProduct.Cola);   // 24 more

            int moved = StockRules.Stock(shelf, box);
            Assert.AreEqual(4, moved);
            Assert.AreEqual(24, shelf.Quantity);
            Assert.AreEqual(20, box.Units);
            Assert.IsTrue(shelf.IsFull);
        }

        [Test]
        public void FullShelfRefusesAndChangesNothing()
        {
            var shelf = Shelf();
            StockRules.Stock(shelf, BoxContents.FreshFromSupplier(TestProduct.Cola));
            var box = BoxContents.FreshFromSupplier(TestProduct.Cola);

            var check = StockRules.Check(shelf, box);
            Assert.AreEqual(StockVerdict.Full, check.Verdict);
            Assert.AreEqual("This one is full", check.Prompt);
            Assert.AreEqual(0, StockRules.Stock(shelf, box));
            Assert.AreEqual(24, shelf.Quantity);
            Assert.AreEqual(24, box.Units);
        }

        [Test]
        public void WrongFixtureIsRefusedWithTheRightHint()
        {
            var shelf = Shelf();
            var milk = BoxContents.FreshFromSupplier(TestProduct.Milk);
            var check = StockRules.Check(shelf, milk);
            Assert.AreEqual(StockVerdict.WrongFixture, check.Verdict);
            Assert.AreEqual("Milk Packet goes in a fridge", check.Prompt);
            Assert.AreEqual(0, StockRules.Stock(shelf, milk));
            Assert.AreEqual(16, milk.Units);

            Assert.AreEqual("Ice Cream Tub goes in a freezer", StockRules.Check(Fridge(), BoxContents.FreshFromSupplier(TestProduct.IceCream)).Prompt);
            Assert.AreEqual("Tomatoes goes in a produce crate", StockRules.Check(shelf, BoxContents.FreshFromSupplier(TestProduct.Tomatoes)).Prompt);
        }

        [Test]
        public void ShelfHoldingAnotherProductMustBeEmptiedFirst()
        {
            var shelf = Shelf();
            StockRules.Stock(shelf, new BoxContents(TestProduct.Cola, 5, null));
            var chips = BoxContents.FreshFromSupplier(TestProduct.Chips);

            var check = StockRules.Check(shelf, chips);
            Assert.AreEqual(StockVerdict.HoldsOtherProduct, check.Verdict);
            Assert.AreEqual(0, StockRules.Stock(shelf, chips));
            Assert.AreSame(TestProduct.Cola, shelf.Product);
        }

        [Test]
        public void LockedFixtureRefusesEvenTheRightProduct()
        {
            var shelf = new FixtureStock(FixtureKind.Shelf, 24, unlocked: false);
            var box = BoxContents.FreshFromSupplier(TestProduct.Cola);
            Assert.AreEqual(StockVerdict.Locked, StockRules.Check(shelf, box).Verdict);
            Assert.AreEqual(0, StockRules.Stock(shelf, box));
        }

        [Test]
        public void LockedIsCheckedBeforeWrongFixture()
        {
            var shelf = new FixtureStock(FixtureKind.Shelf, 24, unlocked: false);
            Assert.AreEqual(StockVerdict.Locked, StockRules.Check(shelf, BoxContents.FreshFromSupplier(TestProduct.Milk)).Verdict);
        }

        [Test]
        public void ExpiredBoxCannotBeStocked()
        {
            var fridge = Fridge();
            var old = new BoxContents(TestProduct.Milk, 16, 0);
            Assert.IsTrue(old.IsExpired);
            Assert.AreEqual(StockVerdict.BoxExpired, StockRules.Check(fridge, old).Verdict);
            Assert.AreEqual(0, StockRules.Stock(fridge, old));
        }

        [Test]
        public void ExpiredStockOnTheFixtureBlocksRestocking()
        {
            var fridge = Fridge();
            fridge.SetContents(TestProduct.Milk, 4, 0);
            var fresh = BoxContents.FreshFromSupplier(TestProduct.Milk);
            Assert.AreEqual(StockVerdict.FixtureExpired, StockRules.Check(fridge, fresh).Verdict);
            Assert.AreEqual(0, StockRules.Stock(fridge, fresh));
        }

        [Test]
        public void MixingStockKeepsTheOldestExpiry()
        {
            var fridge = Fridge();
            StockRules.Stock(fridge, new BoxContents(TestProduct.Milk, 5, 1));
            StockRules.Stock(fridge, new BoxContents(TestProduct.Milk, 5, 3));
            Assert.AreEqual(10, fridge.Quantity);
            Assert.AreEqual(1, fridge.DaysLeft);
        }

        [Test]
        public void EmptyingGoodStockGivesOneBoxWithEverything()
        {
            var fridge = Fridge();
            StockRules.Stock(fridge, new BoxContents(TestProduct.Milk, 7, 2));

            var outcome = StockRules.Empty(fridge);
            Assert.AreEqual(EmptyOutcomeKind.Boxed, outcome.Kind);
            Assert.AreSame(TestProduct.Milk, outcome.Box.Product);
            Assert.AreEqual(7, outcome.Box.Units);
            Assert.AreEqual(2, outcome.Box.DaysLeft);
            Assert.IsTrue(fridge.IsEmpty);
            Assert.IsNull(fridge.Product);
        }

        [Test]
        public void EmptyingExpiredStockWritesItOffAsWaste()
        {
            var fridge = Fridge();
            fridge.SetContents(TestProduct.Milk, 6, 0);

            var outcome = StockRules.Empty(fridge);
            Assert.AreEqual(EmptyOutcomeKind.Wasted, outcome.Kind);
            Assert.IsNull(outcome.Box);
            Assert.AreEqual(6, outcome.WastedUnits);
            Assert.AreEqual(6 * 26, outcome.WasteValue);
            Assert.IsTrue(fridge.IsEmpty);
        }

        [Test]
        public void EmptyingAnEmptyFixtureDoesNothing()
        {
            Assert.AreEqual(EmptyOutcomeKind.Nothing, StockRules.Empty(Shelf()).Kind);
        }

        [Test]
        public void AfterEmptyingAnyProductCanGoOn()
        {
            var shelf = Shelf();
            StockRules.Stock(shelf, new BoxContents(TestProduct.Cola, 5, null));
            StockRules.Empty(shelf);
            Assert.AreEqual(24, StockRules.Stock(shelf, BoxContents.FreshFromSupplier(TestProduct.Chips)));
            Assert.AreSame(TestProduct.Chips, shelf.Product);
        }

        [Test]
        public void SoldOutShelfAcceptsANewProduct()
        {
            var shelf = Shelf();
            StockRules.Stock(shelf, new BoxContents(TestProduct.Cola, 3, null));
            Assert.AreEqual(3, StockRules.TakeForBasket(shelf, 5));
            Assert.IsTrue(shelf.IsEmpty);
            Assert.AreEqual(StockVerdict.CanStock, StockRules.Check(shelf, BoxContents.FreshFromSupplier(TestProduct.Chips)).Verdict);
        }

        [Test]
        public void ShoppersNeverTakeExpiredStock()
        {
            var fridge = Fridge();
            fridge.SetContents(TestProduct.Milk, 6, 0);
            Assert.AreEqual(0, StockRules.TakeForBasket(fridge, 2));
            Assert.AreEqual(6, fridge.Quantity);
        }

        [Test]
        public void AgeingCountsDownAndStopsAtZero()
        {
            var fridge = Fridge();
            StockRules.Stock(fridge, new BoxContents(TestProduct.Milk, 4, 1));
            StockRules.AgeOneNight(fridge);
            Assert.AreEqual(0, fridge.DaysLeft);
            Assert.IsTrue(fridge.IsExpired);
            StockRules.AgeOneNight(fridge);
            Assert.AreEqual(0, fridge.DaysLeft);

            var cola = BoxContents.FreshFromSupplier(TestProduct.Cola);
            StockRules.AgeOneNight(cola);
            Assert.IsNull(cola.DaysLeft);
            Assert.IsFalse(cola.IsExpired);
        }

        [Test]
        public void NonPerishablesIgnoreAnyDaysLeftPassedIn()
        {
            var box = new BoxContents(TestProduct.Cola, 5, 0);
            Assert.IsNull(box.DaysLeft);
            Assert.IsFalse(box.IsExpired);
        }

        [Test]
        public void DeepShelvingRaisesCapacityWithoutLosingStock()
        {
            var shelf = Shelf();
            StockRules.Stock(shelf, BoxContents.FreshFromSupplier(TestProduct.Cola));
            shelf.SetCapacity(36);
            Assert.AreEqual(24, shelf.Quantity);
            Assert.AreEqual(12, shelf.FreeSpace);
            Assert.AreEqual(StockVerdict.CanStock, StockRules.Check(shelf, BoxContents.FreshFromSupplier(TestProduct.Cola)).Verdict);
        }

        [Test]
        public void SetContentsRejectsTheWrongKind()
        {
            Assert.Throws<System.ArgumentException>(() => Shelf().SetContents(TestProduct.Milk, 3, 3));
        }

        /// <summary>
        /// Random sequences of stock / empty / take. Units must only ever be moved, never created or
        /// destroyed, except by the explicit waste and sale paths, which are counted.
        /// </summary>
        [Test]
        public void UnitsAreConservedAcrossRandomOperations([Values(1, 2, 3, 4, 5)] int seed)
        {
            var rng = new System.Random(seed);
            var fixtures = new[] { Shelf(), Shelf(), Fridge() };
            var boxes = new System.Collections.Generic.List<BoxContents>();
            var products = new IProduct[] { TestProduct.Cola, TestProduct.Bread, TestProduct.Chips, TestProduct.Milk };
            int created = 0, sold = 0, wasted = 0;

            for (int step = 0; step < 500; step++)
            {
                switch (rng.Next(4))
                {
                    case 0:
                        var fresh = BoxContents.FreshFromSupplier(products[rng.Next(products.Length)]);
                        created += fresh.Units;
                        boxes.Add(fresh);
                        break;
                    case 1:
                        if (boxes.Count > 0) StockRules.Stock(fixtures[rng.Next(fixtures.Length)], boxes[rng.Next(boxes.Count)]);
                        break;
                    case 2:
                        var outcome = StockRules.Empty(fixtures[rng.Next(fixtures.Length)]);
                        if (outcome.Box != null) boxes.Add(outcome.Box);
                        wasted += outcome.WastedUnits;
                        break;
                    case 3:
                        sold += StockRules.TakeForBasket(fixtures[rng.Next(fixtures.Length)], rng.Next(1, 4));
                        break;
                }
                if (rng.Next(25) == 0) foreach (var f in fixtures) StockRules.AgeOneNight(f);
                boxes.RemoveAll(b => b.IsEmpty);

                int onFixtures = 0;
                foreach (var f in fixtures)
                {
                    Assert.LessOrEqual(f.Quantity, f.Capacity, "over capacity");
                    if (!f.IsEmpty) Assert.AreEqual(f.Kind, f.Product.RequiredFixture(), "product on the wrong fixture");
                    onFixtures += f.IsEmpty ? 0 : f.Quantity;
                }
                int inBoxes = 0;
                foreach (var b in boxes) inBoxes += b.Units;
                Assert.AreEqual(created, onFixtures + inBoxes + sold + wasted, $"units not conserved at step {step}");
            }
        }
    }
}
