using System;
using MiniMart.Simulation.Catalogue;

namespace MiniMart.Simulation.Inventory
{
    /// <summary>
    /// What is inside one cardboard box: one product, a unit count and (for fresh food) days left.
    /// Units only ever move between boxes and fixtures through <see cref="StockRules"/>, so they are
    /// never copied.
    /// </summary>
    public sealed class BoxContents
    {
        public IProduct Product { get; }
        public int Units { get; internal set; }

        /// <summary>Days before expiry, or null if the product never expires.</summary>
        public int? DaysLeft { get; internal set; }

        public BoxContents(IProduct product, int units, int? daysLeft)
        {
            if (product == null) throw new ArgumentNullException(nameof(product));
            if (units < 0) throw new ArgumentOutOfRangeException(nameof(units), units, "Units cannot be negative.");
            Product = product;
            Units = units;
            DaysLeft = product.IsPerishable() ? daysLeft : null;
        }

        /// <summary>A full box straight from the supplier.</summary>
        public static BoxContents FreshFromSupplier(IProduct product) =>
            new BoxContents(product, product.UnitsPerBox, product.FreshDaysLeft());

        public bool IsEmpty => Units <= 0;
        public bool IsExpired => DaysLeft.HasValue && DaysLeft.Value <= 0;

        /// <summary>Supplier value of what's inside, used for waste accounting.</summary>
        public int CostValue => Units * Product.SupplierCost;

        public override string ToString() => $"{Product.DisplayName} × {Units}";
    }
}
