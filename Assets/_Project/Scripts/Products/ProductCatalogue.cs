using System.Collections.Generic;
using MiniMart.Fixtures;
using MiniMart.Simulation.Catalogue;
using UnityEngine;

namespace MiniMart.Products
{
    /// <summary>The full product list in prototype order, plus fixture types and categories.</summary>
    [CreateAssetMenu(menuName = "MiniMart/Product Catalogue", fileName = "ProductCatalogue")]
    public sealed class ProductCatalogue : ScriptableObject
    {
        [SerializeField] private List<ProductDefinition> products = new List<ProductDefinition>();
        [SerializeField] private List<ProductCategoryDefinition> categories = new List<ProductCategoryDefinition>();
        [SerializeField] private List<FixtureDefinition> fixtures = new List<FixtureDefinition>();

        public IReadOnlyList<ProductDefinition> Products => products;
        public IReadOnlyList<ProductCategoryDefinition> Categories => categories;
        public IReadOnlyList<FixtureDefinition> Fixtures => fixtures;

        public ProductDefinition Find(string productId)
        {
            foreach (var p in products) if (p != null && p.ProductId == productId) return p;
            return null;
        }

        public FixtureDefinition FindFixture(FixtureKind kind)
        {
            foreach (var f in fixtures) if (f != null && f.Kind == kind) return f;
            return null;
        }

        public void SetContents(List<ProductDefinition> productList, List<ProductCategoryDefinition> categoryList, List<FixtureDefinition> fixtureList)
        {
            products = productList;
            categories = categoryList;
            fixtures = fixtureList;
        }
    }
}
