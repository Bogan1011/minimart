namespace MiniMart.Simulation.Catalogue
{
    /// <summary>
    /// What the simulation needs to know about a product. In Unity this is implemented by the
    /// ProductDefinition ScriptableObject; in tests by a plain class.
    /// </summary>
    public interface IProduct
    {
        /// <summary>Stable string id, e.g. "cola-can". Never shown to players.</summary>
        string ProductId { get; }

        string DisplayName { get; }

        ProductKind Kind { get; }

        /// <summary>Units in one supplier box.</summary>
        int UnitsPerBox { get; }

        /// <summary>Business days before it expires. 0 means it never expires.</summary>
        int ShelfLifeDays { get; }

        /// <summary>Supplier price per unit, whole rupees.</summary>
        int SupplierCost { get; }

        /// <summary>MRP per unit, whole rupees. The price shoppers expect.</summary>
        int BasePrice { get; }
    }

    public static class ProductExtensions
    {
        public static bool IsPerishable(this IProduct product) => product != null && product.ShelfLifeDays > 0;

        /// <summary>Shelf life for a fresh box, or null when the product never expires.</summary>
        public static int? FreshDaysLeft(this IProduct product) =>
            product.IsPerishable() ? product.ShelfLifeDays : (int?)null;

        public static FixtureKind RequiredFixture(this IProduct product) => KindRules.FixtureFor(product.Kind);
    }
}
