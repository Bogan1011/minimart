using MiniMart.Simulation.Catalogue;

namespace MiniMart.Tests
{
    /// <summary>Plain products for rule tests, using prototype values.</summary>
    internal sealed class TestProduct : IProduct
    {
        public string ProductId { get; set; }
        public string DisplayName { get; set; }
        public ProductKind Kind { get; set; }
        public int UnitsPerBox { get; set; }
        public int ShelfLifeDays { get; set; }
        public int SupplierCost { get; set; }
        public int BasePrice { get; set; }

        public static readonly TestProduct Cola = new TestProduct { ProductId = "cola-can", DisplayName = "Cola Can", Kind = ProductKind.Dry, UnitsPerBox = 24, SupplierCost = 32, BasePrice = 40 };
        public static readonly TestProduct Bread = new TestProduct { ProductId = "bread-loaf", DisplayName = "Bread Loaf", Kind = ProductKind.Dry, UnitsPerBox = 10, ShelfLifeDays = 2, SupplierCost = 37, BasePrice = 45 };
        public static readonly TestProduct Chips = new TestProduct { ProductId = "chips-pack", DisplayName = "Chips Pack", Kind = ProductKind.Dry, UnitsPerBox = 24, SupplierCost = 16, BasePrice = 20 };
        public static readonly TestProduct Milk = new TestProduct { ProductId = "milk-packet", DisplayName = "Milk Packet", Kind = ProductKind.Chilled, UnitsPerBox = 16, ShelfLifeDays = 3, SupplierCost = 26, BasePrice = 30 };
        public static readonly TestProduct IceCream = new TestProduct { ProductId = "ice-cream-tub", DisplayName = "Ice Cream Tub", Kind = ProductKind.Frozen, UnitsPerBox = 8, SupplierCost = 175, BasePrice = 220 };
        public static readonly TestProduct Tomatoes = new TestProduct { ProductId = "tomatoes", DisplayName = "Tomatoes", Kind = ProductKind.Produce, UnitsPerBox = 12, ShelfLifeDays = 3, SupplierCost = 30, BasePrice = 40 };
    }
}
