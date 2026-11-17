using MiniMart.Simulation.Catalogue;
using MiniMart.Simulation.Inventory;
using NUnit.Framework;

namespace MiniMart.Tests
{
    /// <summary>
    /// Stocking rules: the prototype's checks (game.js probe / stockInto / pull) on the blueprint's
    /// slot model, one unit per press from an opened box. See Docs/BehaviourSpec.md §4.
    /// </summary>
    public class StockRulesTests
    {
        private static FixtureStock Shelf() => FixtureStock.PrototypeLayout(FixtureKind.Shelf);
        private static FixtureStock Fridge() => FixtureStock.PrototypeLayout(FixtureKind.Fridge);

        /// <summary>A supplier box picked up and opened, ready to stock from.</summary>
        private static BoxContents OpenBox(IProduct p)
        {
            var box = BoxContents.FreshFromSupplier(p);
            Assert.IsTrue(BoxRules.TryMove(box, BoxLocation.Held));
            Assert.IsTrue(BoxRules.TryOpen(box));
            return box;
        }

        private static int StockAll(FixtureStock f, BoxContents box, int slot = -1)
        {
            int n = 0;
            while (StockRules.StockOne(f, box, slot) >= 0) n++;
            return n;
        }

        // ------------------------------------------------------------------ kinds and layouts

        [Test]
        public void KindsMapToTheRightFixture()
        {
            Assert.AreEqual(FixtureKind.Shelf, KindRules.FixtureFor(ProductKind.Dry));
            Assert.AreEqual(FixtureKind.Fridge, KindRules.FixtureFor(ProductKind.Chilled));
            Assert.AreEqual(FixtureKind.Freezer, KindRules.FixtureFor(ProductKind.Frozen));
            Assert.AreEqual(FixtureKind.ProduceCrate, KindRules.FixtureFor(ProductKind.Produce));
        }

        [TestCase(FixtureKind.Shelf, 6, 4, 24)]
        [TestCase(FixtureKind.Fridge, 9, 2, 18)]
        [TestCase(FixtureKind.Freezer, 8, 2, 16)]
        [TestCase(FixtureKind.ProduceCrate, 5, 4, 20)]
        public void SlotLayoutsKeepThePrototypeCapacities(FixtureKind kind, int slots, int perSlot, int total)
        {
            KindRules.PrototypeSlotLayout(kind, out int s, out int u);
            Assert.AreEqual(slots, s);
            Assert.AreEqual(perSlot, u);
            Assert.AreEqual(total, KindRules.PrototypeBaseCapacity(kind));
            var f = FixtureStock.PrototypeLayout(kind);
            Assert.AreEqual(slots, f.SlotCount);
            Assert.AreEqual(total, f.Capacity);
        }

        [Test]
        public void DeepShelvingIsHalfAsMuchAgainPerSlot()
        {
            var shelf = Shelf();
            shelf.SetCapacityMultiplier(1.5f);
            Assert.AreEqual(6, shelf.Slot(0).Capacity);
            Assert.AreEqual(36, shelf.Capacity);
            var fridge = Fridge();
            fridge.SetCapacityMultiplier(1.5f);
            Assert.AreEqual(27, fridge.Capacity);
        }

        // ------------------------------------------------------------------ boxes

        [Test]
        public void FreshBoxIsSealedFullAndOnThePad()
        {
            var bread = BoxContents.FreshFromSupplier(TestProduct.Bread);
            Assert.AreEqual(10, bread.Units);
            Assert.AreEqual(2, bread.DaysLeft);
            Assert.IsFalse(bread.IsOpen);
            Assert.AreEqual(BoxState.Delivered, bread.State);

            var cola = BoxContents.FreshFromSupplier(TestProduct.Cola);
            Assert.IsNull(cola.DaysLeft, "non-perishables have no expiry");
        }

        [Test]
        public void BoxStatesFollowTheBlueprintLifecycle()
        {
            var box = BoxContents.FreshFromSupplier(TestProduct.Cola);
            Assert.AreEqual(BoxState.Delivered, box.State);
            Assert.IsFalse(BoxRules.CanMove(box, BoxLocation.Stored), "must be picked up first");

            Assert.IsTrue(BoxRules.TryMove(box, BoxLocation.Held));
            Assert.AreEqual(BoxState.Held, box.State);
            Assert.IsTrue(BoxRules.TryMove(box, BoxLocation.OnGround));
            Assert.AreEqual(BoxState.OnGround, box.State);
            Assert.IsFalse(BoxRules.TryOpen(box), "only a held box can be opened");
            Assert.IsTrue(BoxRules.TryMove(box, BoxLocation.Held));
            Assert.IsTrue(BoxRules.TryMove(box, BoxLocation.Stored));
            Assert.AreEqual(BoxState.Stored, box.State);
            Assert.IsTrue(BoxRules.TryMove(box, BoxLocation.Held));
            Assert.IsFalse(BoxRules.CanMove(box, BoxLocation.Delivered), "boxes never go back to the pad");

            Assert.IsTrue(BoxRules.TryOpen(box));
            Assert.AreEqual(BoxState.Opened, box.State);
            Assert.IsFalse(BoxRules.TryOpen(box), "already open");

            var shelf = Shelf();
            StockAll(shelf, box);
            Assert.AreEqual(BoxState.Empty, box.State);
            Assert.AreEqual(0, BoxRules.Discard(box));
            Assert.AreEqual(BoxState.Discarded, box.State);
            Assert.IsFalse(BoxRules.CanMove(box, BoxLocation.Held), "a binned box is gone");
        }

        [Test]
        public void BinningABoxWithStockCountsItAsWaste()
        {
            var box = OpenBox(TestProduct.Milk);
            Assert.AreEqual(16 * 26, BoxRules.Discard(box));
            Assert.AreEqual(0, box.Units);
        }

        [Test]
        public void OnlyAHeldBoxCanBeBinned()
        {
            var box = BoxContents.FreshFromSupplier(TestProduct.Milk);
            Assert.AreEqual(0, BoxRules.Discard(box));
            Assert.AreEqual(BoxState.Delivered, box.State);
        }

        // ------------------------------------------------------------------ checks

        [Test]
        public void ChecksComeInTheRightOrder()
        {
            var shelf = Shelf();
            Assert.AreEqual(StockVerdict.NoBox, StockRules.Check(shelf, null).Verdict);

            var sealedBox = BoxContents.FreshFromSupplier(TestProduct.Cola);
            BoxRules.TryMove(sealedBox, BoxLocation.Held);
            var check = StockRules.Check(shelf, sealedBox);
            Assert.AreEqual(StockVerdict.BoxClosed, check.Verdict);
            Assert.AreEqual("Open the box first", check.Prompt);

            var milk = OpenBox(TestProduct.Milk);
            check = StockRules.Check(shelf, milk);
            Assert.AreEqual(StockVerdict.WrongFixture, check.Verdict);
            Assert.AreEqual("Milk Packet goes in a fridge", check.Prompt);

            var locked = FixtureStock.PrototypeLayout(FixtureKind.Fridge, unlocked: false);
            Assert.AreEqual(StockVerdict.Locked, StockRules.Check(locked, milk).Verdict);
        }

        [Test]
        public void EmptyShelfShowsTheFirstSlot()
        {
            var check = StockRules.Check(Shelf(), OpenBox(TestProduct.Bread));
            Assert.AreEqual(StockVerdict.CanStock, check.Verdict);
            Assert.AreEqual(0, check.SlotIndex);
            Assert.AreEqual("Stock Bread Loaf (0/4)", check.Prompt);
        }

        // ------------------------------------------------------------------ stocking

        [Test]
        public void StockingMovesOneUnitPerPress()
        {
            var shelf = Shelf();
            var box = OpenBox(TestProduct.Bread);
            Assert.AreEqual(0, StockRules.StockOne(shelf, box));
            Assert.AreEqual(9, box.Units);
            Assert.AreEqual(1, shelf.Slot(0).Quantity);
            Assert.AreSame(TestProduct.Bread, shelf.Slot(0).Product);
            Assert.AreEqual(2, shelf.Slot(0).DaysLeft);
        }

        [Test]
        public void AutoChooseTopsUpTheSameProductThenTheNextEmptySlot()
        {
            var shelf = Shelf();
            var box = OpenBox(TestProduct.Cola);
            for (int i = 0; i < 4; i++) Assert.AreEqual(0, StockRules.StockOne(shelf, box));
            Assert.AreEqual(1, StockRules.StockOne(shelf, box), "slot 0 full, so the next empty slot");

            var chips = OpenBox(TestProduct.Chips);
            Assert.AreEqual(2, StockRules.StockOne(shelf, chips), "a different product takes a fresh slot");
            Assert.AreEqual(1, StockRules.StockOne(shelf, box), "cola tops up its partial slot first");
        }

        [Test]
        public void AimingAtASlotRespectsWhatsThere()
        {
            var shelf = Shelf();
            var cola = OpenBox(TestProduct.Cola);
            StockRules.StockOne(shelf, cola, 3);
            var chips = OpenBox(TestProduct.Chips);

            var check = StockRules.Check(shelf, chips, 3);
            Assert.AreEqual(StockVerdict.HoldsOtherProduct, check.Verdict);
            Assert.AreEqual("This slot holds Cola Can", check.Prompt);
            Assert.AreEqual(-1, StockRules.StockOne(shelf, chips, 3));

            for (int i = 0; i < 3; i++) StockRules.StockOne(shelf, cola, 3);
            check = StockRules.Check(shelf, cola, 3);
            Assert.AreEqual(StockVerdict.Full, check.Verdict);
            Assert.AreEqual("This slot is full", check.Prompt);
        }

        [Test]
        public void FullFixtureStopsAndUnitsAreConserved()
        {
            var shelf = Shelf();
            var a = OpenBox(TestProduct.Cola);
            var b = OpenBox(TestProduct.Cola);
            int moved = StockAll(shelf, a) + StockAll(shelf, b);
            Assert.AreEqual(24, moved);
            Assert.AreEqual(24, shelf.Quantity);
            Assert.AreEqual(48 - 24, a.Units + b.Units, "nothing created or lost");
            Assert.AreEqual(StockVerdict.Full, StockRules.Check(shelf, b).Verdict);
        }

        [Test]
        public void MixedFreshnessTakesTheOldest()
        {
            var fridge = Fridge();
            var old = OpenBox(TestProduct.Milk);
            StockRules.AgeOneNight(old);
            StockRules.AgeOneNight(old);           // 1 day left
            StockRules.StockOne(fridge, old, 0);
            var fresh = OpenBox(TestProduct.Milk); // 3 days left
            StockRules.StockOne(fridge, fresh, 0);
            Assert.AreEqual(1, fridge.Slot(0).DaysLeft);
        }

        [Test]
        public void ExpiredStockBlocksItsSlotAndExpiredBoxesCantBeStocked()
        {
            var fridge = Fridge();
            fridge.SetSlot(0, TestProduct.Milk, 2, 0);
            var box = OpenBox(TestProduct.Milk);
            Assert.AreEqual(StockVerdict.SlotExpired, StockRules.Check(fridge, box, 0).Verdict);
            Assert.AreEqual(1, StockRules.StockOne(fridge, box), "auto-choose skips the expired slot");

            var expired = OpenBox(TestProduct.Milk);
            StockRules.AgeOneNight(expired); StockRules.AgeOneNight(expired); StockRules.AgeOneNight(expired);
            Assert.AreEqual(StockVerdict.BoxExpired, StockRules.Check(fridge, expired).Verdict);
        }

        // ------------------------------------------------------------------ taking back and emptying

        [Test]
        public void TakeBackMovesOneUnitIntoTheOpenBox()
        {
            var shelf = Shelf();
            var box = OpenBox(TestProduct.Cola);
            StockRules.StockOne(shelf, box, 0);
            StockRules.StockOne(shelf, box, 0);
            Assert.IsTrue(StockRules.TakeBackOne(shelf, 0, box));
            Assert.AreEqual(23, box.Units);
            Assert.AreEqual(1, shelf.Slot(0).Quantity);
            Assert.IsTrue(StockRules.TakeBackOne(shelf, 0, box));
            Assert.IsTrue(shelf.Slot(0).IsEmpty);
            Assert.IsFalse(StockRules.TakeBackOne(shelf, 0, box), "nothing left");
            Assert.IsFalse(StockRules.CanTakeBack(shelf, 0, box));
        }

        [Test]
        public void CantTakeBackIntoAFullOrDifferentBox()
        {
            var shelf = Shelf();
            shelf.SetSlot(0, TestProduct.Cola, 4, null);
            var full = OpenBox(TestProduct.Cola);
            Assert.IsFalse(StockRules.CanTakeBack(shelf, 0, full));
            var chips = OpenBox(TestProduct.Chips);
            StockRules.StockOne(shelf, chips, 1);
            Assert.IsFalse(StockRules.CanTakeBack(shelf, 0, chips));
        }

        [Test]
        public void EmptyingGoodStockGivesAnOpenHeldBox()
        {
            var shelf = Shelf();
            shelf.SetSlot(2, TestProduct.Bread, 3, 1);
            var outcome = StockRules.EmptySlot(shelf, 2);
            Assert.AreEqual(EmptyOutcomeKind.Boxed, outcome.Kind);
            Assert.AreEqual(3, outcome.Box.Units);
            Assert.AreEqual(1, outcome.Box.DaysLeft);
            Assert.IsTrue(outcome.Box.IsOpen);
            Assert.AreEqual(BoxLocation.Held, outcome.Box.Location);
            Assert.IsTrue(shelf.Slot(2).IsEmpty);
        }

        [Test]
        public void EmptyingExpiredStockIsWaste()
        {
            var fridge = Fridge();
            fridge.SetSlot(0, TestProduct.Milk, 2, 0);
            var outcome = StockRules.EmptySlot(fridge, 0);
            Assert.AreEqual(EmptyOutcomeKind.Wasted, outcome.Kind);
            Assert.AreEqual(2, outcome.WastedUnits);
            Assert.AreEqual(52, outcome.WasteValue);
            Assert.IsNull(outcome.Box);
            Assert.AreEqual(EmptyOutcomeKind.Nothing, StockRules.EmptySlot(fridge, 0).Kind);
        }

        // ------------------------------------------------------------------ shoppers and nights

        [Test]
        public void ShoppersTakeAcrossSlotsButNeverExpiredStock()
        {
            var fridge = Fridge();
            fridge.SetSlot(0, TestProduct.Milk, 2, 0);
            fridge.SetSlot(1, TestProduct.Milk, 2, 2);
            fridge.SetSlot(2, TestProduct.Milk, 1, 2);
            Assert.AreEqual(3, StockRules.TakeForBasket(fridge, TestProduct.Milk, 5));
            Assert.AreEqual(2, fridge.Quantity, "only the expired units remain");
        }

        [Test]
        public void SetSlotRefusesTheWrongKind()
        {
            Assert.Throws<System.ArgumentException>(() => Shelf().SetSlot(0, TestProduct.Milk, 1, 3));
        }

        [Test]
        public void NightsAgeStockButNotBelowZero()
        {
            var fridge = Fridge();
            fridge.SetSlot(0, TestProduct.Milk, 1, 1);
            fridge.SetSlot(1, TestProduct.Milk, 1, 0);
            StockRules.AgeOneNight(fridge);
            Assert.AreEqual(0, fridge.Slot(0).DaysLeft);
            Assert.AreEqual(0, fridge.Slot(1).DaysLeft);
            Assert.IsTrue(fridge.Slot(0).IsExpired);
        }
    }
}
