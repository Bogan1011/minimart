using System.Collections.Generic;

namespace MiniMart.Simulation.Catalogue
{
    /// <summary>Sanity checks for product data. Returns human-readable problems; empty means OK.</summary>
    public static class CatalogueValidator
    {
        public static List<string> Validate(IEnumerable<IProduct> products)
        {
            var problems = new List<string>();
            var ids = new HashSet<string>();
            foreach (var p in products)
            {
                if (p == null) { problems.Add("Catalogue contains an empty entry."); continue; }
                string name = string.IsNullOrEmpty(p.DisplayName) ? p.ProductId : p.DisplayName;
                if (string.IsNullOrWhiteSpace(p.ProductId)) problems.Add($"{name}: missing product id.");
                else if (!ids.Add(p.ProductId)) problems.Add($"{name}: duplicate product id '{p.ProductId}'.");
                if (string.IsNullOrWhiteSpace(p.DisplayName)) problems.Add($"{p.ProductId}: missing display name.");
                if (p.UnitsPerBox <= 0) problems.Add($"{name}: units per box must be at least 1.");
                if (p.SupplierCost <= 0) problems.Add($"{name}: supplier cost must be positive.");
                if (p.BasePrice <= 0) problems.Add($"{name}: price must be positive.");
                if (p.SupplierCost >= p.BasePrice) problems.Add($"{name}: supplier cost ₹{p.SupplierCost} is not below price ₹{p.BasePrice}.");
                if (p.ShelfLifeDays < 0) problems.Add($"{name}: shelf life cannot be negative.");
            }
            return problems;
        }
    }
}
