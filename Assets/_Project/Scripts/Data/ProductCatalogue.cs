using System.Collections.Generic;
using UnityEngine;

namespace MiniMart.Data
{
    /// <summary>The full product list, in prototype order.</summary>
    [CreateAssetMenu(menuName = "MiniMart/Product Catalogue", fileName = "ProductCatalogue")]
    public sealed class ProductCatalogue : ScriptableObject
    {
        [SerializeField] private List<ProductDefinition> products = new List<ProductDefinition>();
        [SerializeField] private List<FixtureDefinition> fixtures = new List<FixtureDefinition>();

        public IReadOnlyList<ProductDefinition> Products => products;
        public IReadOnlyList<FixtureDefinition> Fixtures => fixtures;

        public ProductDefinition Find(string productId)
        {
            foreach (var p in products) if (p != null && p.ProductId == productId) return p;
            return null;
        }

        public FixtureDefinition FindFixture(MiniMart.Simulation.Catalogue.FixtureKind kind)
        {
            foreach (var f in fixtures) if (f != null && f.Kind == kind) return f;
            return null;
        }

        public void SetContents(List<ProductDefinition> productList, List<FixtureDefinition> fixtureList)
        {
            products = productList;
            fixtures = fixtureList;
        }
    }
}
