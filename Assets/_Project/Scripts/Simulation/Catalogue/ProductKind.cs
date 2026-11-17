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
