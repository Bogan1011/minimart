using System;
using MiniMart.Simulation.Catalogue;

namespace MiniMart.Simulation.Inventory
{
    public enum StockVerdict
    {
        CanStock,
        NoBox,
        BoxClosed,
        BoxEmpty,
        Locked,
        WrongFixture,
        BoxExpired,
        SlotExpired,
        Full,
        HoldsOtherProduct,
    }

    /// <summary>The answer to "can a unit from this box go here?", the slot it would go to, and the player's prompt.</summary>
    public readonly struct StockCheck
    {
        public readonly StockVerdict Verdict;
        public readonly string Prompt;
        /// <summary>Slot the unit would go to, or -1.</summary>
        public readonly int SlotIndex;

        public StockCheck(StockVerdict verdict, string prompt, int slotIndex = -1)
        {
            Verdict = verdict;
            Prompt = prompt;
            SlotIndex = slotIndex;
        }

        public bool Allowed => Verdict == StockVerdict.CanStock;
        public override string ToString() => $"{Verdict} [{SlotIndex}]: {Prompt}";
    }

    public enum EmptyOutcomeKind
    {
        /// <summary>The slot was already empty.</summary>
        Nothing,
        /// <summary>The stock came off into a new, open box.</summary>
        Boxed,
        /// <summary>The stock had expired and was written off.</summary>
        Wasted,
    }

    public readonly struct EmptyOutcome
    {
        public readonly EmptyOutcomeKind Kind;
        public readonly BoxContents Box;
        public readonly int WastedUnits;
        public readonly int WasteValue;

        public EmptyOutcome(EmptyOutcomeKind kind, BoxContents box, int wastedUnits, int wasteValue)
        {
            Kind = kind;
            Box = box;
            WastedUnits = wastedUnits;
            WasteValue = wasteValue;
        }
    }

    /// <summary>
    /// Stocking rules. The prototype's checks (game.js probe / stockInto / pull), adapted to the
    /// blueprint: products go into named slots, one unit per action, from an opened box (§9.4, §9.5).
    /// Pure C#, so the host can run them authoritatively and EditMode tests can cover them.
    /// </summary>
    public static class StockRules
    {
        public static bool SameProduct(IProduct a, IProduct b) =>
            ReferenceEquals(a, b) || (a != null && b != null && a.ProductId == b.ProductId);

        /// <summary>
        /// Can one unit from <paramref name="box"/> go on this fixture? Pass a slot index to aim at a
        /// specific slot, or -1 to let the fixture choose (top up the same product first, then the first
        /// empty slot).
        /// </summary>
        public static StockCheck Check(FixtureStock fixture, BoxContents box, int slotIndex = -1)
        {
            if (fixture == null) throw new ArgumentNullException(nameof(fixture));
            if (box == null) return new StockCheck(StockVerdict.NoBox, "Bring a box");

            var product = box.Product;
            var need = product.RequiredFixture();

            if (!fixture.Unlocked) return new StockCheck(StockVerdict.Locked, "Locked - expand the store first");
            if (fixture.Kind != need) return new StockCheck(StockVerdict.WrongFixture, $"{product.DisplayName} goes in a {KindRules.DisplayName(need)}");
            if (!box.IsOpen) return new StockCheck(StockVerdict.BoxClosed, "Open the box first");
            if (box.IsEmpty) return new StockCheck(StockVerdict.BoxEmpty, "This box is empty - bin it");
            if (box.IsExpired) return new StockCheck(StockVerdict.BoxExpired, "This box has expired - throw it in the waste bin");

            if (slotIndex >= 0)
            {
                var s = fixture.Slot(slotIndex);
                if (s == null) return Choose(fixture, box);
                return CheckSlot(s, box);
            }
            return Choose(fixture, box);
        }

        private static StockCheck CheckSlot(SlotStock s, BoxContents box)
        {
            var product = box.Product;
            if (s.IsExpired) return new StockCheck(StockVerdict.SlotExpired, $"Expired {s.Product.DisplayName} here - clear it first", s.Index);
            if (!s.IsEmpty && !SameProduct(s.Product, product))
                return new StockCheck(StockVerdict.HoldsOtherProduct, $"This slot holds {s.Product.DisplayName}", s.Index);
            if (s.IsFull) return new StockCheck(StockVerdict.Full, "This slot is full", s.Index);
            int shown = s.IsEmpty ? 0 : s.Quantity;
            return new StockCheck(StockVerdict.CanStock, $"Stock {product.DisplayName} ({shown}/{s.Capacity})", s.Index);
        }

        private static StockCheck Choose(FixtureStock fixture, BoxContents box)
        {
            // 1. top up a slot that already has this product
            foreach (var s in fixture.Slots)
                if (!s.IsEmpty && !s.IsExpired && SameProduct(s.Product, box.Product) && !s.IsFull)
                    return CheckSlot(s, box);
            // 2. the first empty slot
            foreach (var s in fixture.Slots)
                if (s.IsEmpty) return CheckSlot(s, box);

            // nowhere: explain why
            foreach (var s in fixture.Slots)
                if (s.IsExpired && SameProduct(s.Product, box.Product))
                    return new StockCheck(StockVerdict.SlotExpired, $"Expired {s.Product.DisplayName} here - clear it first", s.Index);
            foreach (var s in fixture.Slots)
                if (SameProduct(s.Product, box.Product))
                    return new StockCheck(StockVerdict.Full, "This one is full");
            return new StockCheck(StockVerdict.HoldsOtherProduct, "No free slot - empty one first");
        }

        /// <summary>
        /// Moves one unit from the box to a slot. Returns the slot index used, or -1 if
        /// <see cref="Check"/> says no (nothing changes).
        /// </summary>
        public static int StockOne(FixtureStock fixture, BoxContents box, int slotIndex = -1)
        {
            var check = Check(fixture, box, slotIndex);
            if (!check.Allowed) return -1;
            var s = fixture.Slot(check.SlotIndex);

            if (s.IsEmpty)
            {
                s.Product = box.Product;
                s.Quantity = 0;
                s.DaysLeft = box.DaysLeft;
            }
            else if (box.DaysLeft.HasValue)
            {
                // the slot is only as fresh as its oldest unit
                s.DaysLeft = s.DaysLeft.HasValue ? Math.Min(s.DaysLeft.Value, box.DaysLeft.Value) : box.DaysLeft;
            }

            s.Quantity += 1;
            box.Units -= 1;
            return s.Index;
        }

        /// <summary>Can one unit come off this slot back into the open box being carried?</summary>
        public static bool CanTakeBack(FixtureStock fixture, int slotIndex, BoxContents box)
        {
            var s = fixture?.Slot(slotIndex);
            return s != null && box != null && box.IsOpen && !box.IsFull && !s.IsEmpty && !s.IsExpired
                   && SameProduct(s.Product, box.Product);
        }

        /// <summary>Moves one unit from a slot back into the carried box. Returns true if moved.</summary>
        public static bool TakeBackOne(FixtureStock fixture, int slotIndex, BoxContents box)
        {
            if (!CanTakeBack(fixture, slotIndex, box)) return false;
            var s = fixture.Slot(slotIndex);
            if (s.DaysLeft.HasValue)
                box.DaysLeft = box.DaysLeft.HasValue ? Math.Min(box.DaysLeft.Value, s.DaysLeft.Value) : s.DaysLeft;
            s.Quantity -= 1;
            box.Units += 1;
            if (s.Quantity == 0) s.Clear();
            return true;
        }

        /// <summary>
        /// Empties one slot. Good stock comes off as one open box (same product, units, days left);
        /// expired stock is written off as waste.
        /// </summary>
        public static EmptyOutcome EmptySlot(FixtureStock fixture, int slotIndex)
        {
            var s = fixture?.Slot(slotIndex) ?? throw new ArgumentOutOfRangeException(nameof(slotIndex));
            if (s.IsEmpty) { s.Clear(); return new EmptyOutcome(EmptyOutcomeKind.Nothing, null, 0, 0); }

            if (s.IsExpired)
            {
                int units = s.Quantity, value = units * s.Product.SupplierCost;
                s.Clear();
                return new EmptyOutcome(EmptyOutcomeKind.Wasted, null, units, value);
            }

            var box = new BoxContents(s.Product, s.Quantity, s.DaysLeft, isOpen: true, location: BoxLocation.Held);
            s.Clear();
            return new EmptyOutcome(EmptyOutcomeKind.Boxed, box, 0, 0);
        }

        /// <summary>
        /// A shopper takes up to <paramref name="wanted"/> units of a product off the fixture.
        /// Returns the number taken. Expired and locked stock is never taken.
        /// </summary>
        public static int TakeForBasket(FixtureStock fixture, IProduct product, int wanted)
        {
            if (fixture == null) throw new ArgumentNullException(nameof(fixture));
            if (wanted <= 0 || !fixture.Unlocked) return 0;
            int taken = 0;
            foreach (var s in fixture.Slots)
            {
                if (taken >= wanted) break;
                if (s.IsEmpty || s.IsExpired || !SameProduct(s.Product, product)) continue;
                int t = Math.Min(wanted - taken, s.Quantity);
                s.Quantity -= t;
                taken += t;
                if (s.Quantity == 0) s.Clear();
            }
            return taken;
        }

        /// <summary>A night passes: fresh stock loses a day (never below 0).</summary>
        public static void AgeOneNight(FixtureStock fixture)
        {
            if (fixture == null) return;
            foreach (var s in fixture.Slots)
                if (!s.IsEmpty && s.DaysLeft.HasValue) s.DaysLeft = Math.Max(0, s.DaysLeft.Value - 1);
        }

        public static void AgeOneNight(BoxContents box)
        {
            if (box != null && box.DaysLeft.HasValue) box.DaysLeft = Math.Max(0, box.DaysLeft.Value - 1);
        }
    }
}
