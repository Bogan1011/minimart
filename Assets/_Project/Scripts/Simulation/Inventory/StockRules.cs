using System;
using MiniMart.Simulation.Catalogue;

namespace MiniMart.Simulation.Inventory
{
    public enum StockVerdict
    {
        CanStock,
        NoBox,
        Locked,
        WrongFixture,
        BoxExpired,
        FixtureExpired,
        Full,
        HoldsOtherProduct,
    }

    /// <summary>The answer to "can this box go on this fixture?" plus the prompt the player sees.</summary>
    public readonly struct StockCheck
    {
        public readonly StockVerdict Verdict;
        public readonly string Prompt;

        public StockCheck(StockVerdict verdict, string prompt)
        {
            Verdict = verdict;
            Prompt = prompt;
        }

        public bool Allowed => Verdict == StockVerdict.CanStock;
        public override string ToString() => $"{Verdict}: {Prompt}";
    }

    public enum EmptyOutcomeKind
    {
        /// <summary>The fixture was already empty.</summary>
        Nothing,
        /// <summary>The stock came off into a new box.</summary>
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
    /// Stocking rules, taken from the prototype (game.js probe / stockInto / pull). Pure C#, no Unity,
    /// so the host can run them authoritatively and EditMode tests can cover them.
    /// </summary>
    public static class StockRules
    {
        /// <summary>Checks are made in the same order as the prototype, so prompts match.</summary>
        public static StockCheck Check(FixtureStock fixture, BoxContents box)
        {
            if (fixture == null) throw new ArgumentNullException(nameof(fixture));
            if (box == null || box.IsEmpty)
                return new StockCheck(StockVerdict.NoBox, "Bring a box");

            var product = box.Product;
            var need = product.RequiredFixture();

            if (!fixture.Unlocked)
                return new StockCheck(StockVerdict.Locked, "Locked - expand the store first");
            if (fixture.Kind != need)
                return new StockCheck(StockVerdict.WrongFixture, $"{product.DisplayName} goes in a {KindRules.DisplayName(need)}");
            if (box.IsExpired)
                return new StockCheck(StockVerdict.BoxExpired, "This box has expired - throw it in the waste bin");
            if (fixture.IsExpired)
                return new StockCheck(StockVerdict.FixtureExpired, $"Expired {fixture.Product.DisplayName} here - clear it first");

            bool sameProduct = !fixture.IsEmpty && SameProduct(fixture.Product, product);
            if (fixture.IsEmpty || sameProduct)
            {
                if (sameProduct && fixture.Quantity >= fixture.Capacity)
                    return new StockCheck(StockVerdict.Full, "This one is full");
                int shown = sameProduct ? fixture.Quantity : 0;
                return new StockCheck(StockVerdict.CanStock, $"Stock {product.DisplayName} ({shown}/{fixture.Capacity})");
            }

            return new StockCheck(StockVerdict.HoldsOtherProduct, $"Holds {fixture.Product.DisplayName} - empty it first");
        }

        public static bool SameProduct(IProduct a, IProduct b) =>
            ReferenceEquals(a, b) || (a != null && b != null && a.ProductId == b.ProductId);

        /// <summary>
        /// Moves as many units as fit from the box onto the fixture. Returns the number moved
        /// (0 if <see cref="Check"/> says no). The box is left with the remainder.
        /// </summary>
        public static int Stock(FixtureStock fixture, BoxContents box)
        {
            if (!Check(fixture, box).Allowed) return 0;

            if (fixture.IsEmpty)
            {
                fixture.Product = box.Product;
                fixture.Quantity = 0;
                fixture.DaysLeft = box.DaysLeft;
            }
            else if (box.DaysLeft.HasValue)
            {
                // mixing stock: the shelf is only as fresh as its oldest unit
                fixture.DaysLeft = fixture.DaysLeft.HasValue ? Math.Min(fixture.DaysLeft.Value, box.DaysLeft.Value) : box.DaysLeft;
            }

            int move = Math.Min(fixture.Capacity - fixture.Quantity, box.Units);
            if (move <= 0) return 0;
            fixture.Quantity += move;
            box.Units -= move;
            return move;
        }

        /// <summary>
        /// Empties a fixture. Good stock comes off as one box (same product, units and days left);
        /// expired stock is written off as waste.
        /// </summary>
        public static EmptyOutcome Empty(FixtureStock fixture)
        {
            if (fixture == null) throw new ArgumentNullException(nameof(fixture));
            if (fixture.IsEmpty)
            {
                fixture.Clear();
                return new EmptyOutcome(EmptyOutcomeKind.Nothing, null, 0, 0);
            }

            if (fixture.IsExpired)
            {
                int units = fixture.Quantity;
                int value = units * fixture.Product.SupplierCost;
                fixture.Clear();
                return new EmptyOutcome(EmptyOutcomeKind.Wasted, null, units, value);
            }

            var box = new BoxContents(fixture.Product, fixture.Quantity, fixture.DaysLeft);
            fixture.Clear();
            return new EmptyOutcome(EmptyOutcomeKind.Boxed, box, 0, 0);
        }

        /// <summary>
        /// Takes up to <paramref name="wanted"/> units off the fixture for a shopper's basket.
        /// Returns the number actually taken. Expired stock is never taken.
        /// </summary>
        public static int TakeForBasket(FixtureStock fixture, int wanted)
        {
            if (fixture == null) throw new ArgumentNullException(nameof(fixture));
            if (wanted <= 0 || fixture.IsEmpty || fixture.IsExpired || !fixture.Unlocked) return 0;
            int take = Math.Min(wanted, fixture.Quantity);
            fixture.Quantity -= take;
            if (fixture.Quantity == 0) fixture.Clear();
            return take;
        }

        /// <summary>A night passes: fresh stock loses a day (never below 0).</summary>
        public static void AgeOneNight(FixtureStock fixture)
        {
            if (fixture != null && !fixture.IsEmpty && fixture.DaysLeft.HasValue)
                fixture.DaysLeft = Math.Max(0, fixture.DaysLeft.Value - 1);
        }

        public static void AgeOneNight(BoxContents box)
        {
            if (box != null && box.DaysLeft.HasValue)
                box.DaysLeft = Math.Max(0, box.DaysLeft.Value - 1);
        }
    }
}
