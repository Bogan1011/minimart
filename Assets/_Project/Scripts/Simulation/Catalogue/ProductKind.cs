namespace MiniMart.Simulation.Catalogue
{
    /// <summary>How a product is stored. Decides which fixture it can go on.</summary>
    public enum ProductKind
    {
        Dry = 0,
        Chilled = 1,
        Frozen = 2,
        Produce = 3,
    }

    /// <summary>The four fixture types from the prototype.</summary>
    public enum FixtureKind
    {
        Shelf = 0,
        Fridge = 1,
        Freezer = 2,
        ProduceCrate = 3,
    }

    public static class KindRules
    {
        /// <summary>dry → shelf, chilled → fridge, frozen → freezer, produce → produce crate.</summary>
        public static FixtureKind FixtureFor(ProductKind kind)
        {
            switch (kind)
            {
                case ProductKind.Dry: return FixtureKind.Shelf;
                case ProductKind.Chilled: return FixtureKind.Fridge;
                case ProductKind.Frozen: return FixtureKind.Freezer;
                case ProductKind.Produce: return FixtureKind.ProduceCrate;
                default: throw new System.ArgumentOutOfRangeException(nameof(kind), kind, null);
            }
        }

        public static string DisplayName(FixtureKind kind)
        {
            switch (kind)
            {
                case FixtureKind.Shelf: return "shelf";
                case FixtureKind.Fridge: return "fridge";
                case FixtureKind.Freezer: return "freezer";
                case FixtureKind.ProduceCrate: return "produce crate";
                default: return kind.ToString();
            }
        }

        /// <summary>
        /// Slot layout that keeps the prototype's capacity (BASE_CAP in game.js) and divides cleanly by
        /// Deep shelving's × 1.5: shelf 6 × 4 = 24, fridge 9 × 2 = 18, freezer 8 × 2 = 16, produce 5 × 4 = 20.
        /// </summary>
        public static void PrototypeSlotLayout(FixtureKind kind, out int slots, out int unitsPerSlot)
        {
            switch (kind)
            {
                case FixtureKind.Shelf: slots = 6; unitsPerSlot = 4; break;
                case FixtureKind.Fridge: slots = 9; unitsPerSlot = 2; break;
                case FixtureKind.Freezer: slots = 8; unitsPerSlot = 2; break;
                case FixtureKind.ProduceCrate: slots = 5; unitsPerSlot = 4; break;
                default: slots = 1; unitsPerSlot = 1; break;
            }
        }

        /// <summary>Prototype base capacity in units (BASE_CAP in game.js).</summary>
        public static int PrototypeBaseCapacity(FixtureKind kind)
        {
            switch (kind)
            {
                case FixtureKind.Shelf: return 24;
                case FixtureKind.Fridge: return 18;
                case FixtureKind.Freezer: return 16;
                case FixtureKind.ProduceCrate: return 20;
                default: return 0;
            }
        }
    }
}
