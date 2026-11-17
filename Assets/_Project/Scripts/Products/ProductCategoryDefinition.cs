using System.Collections.Generic;
using UnityEngine;

namespace MiniMart.Products
{
    /// <summary>
    /// A product line (blueprint §17.6 ProductCategoryDefinition). In the prototype these are the seven
    /// licences: you buy the right to order and sell a line.
    /// </summary>
    [CreateAssetMenu(menuName = "MiniMart/Product Category", fileName = "Category")]
    public sealed class ProductCategoryDefinition : ScriptableObject
    {
        public string key = "";
        public string displayName = "";
        [TextArea] public string description = "";
        public List<ProductDefinition> products = new List<ProductDefinition>();

        [Header("Licence requirement")]
        [Tooltip("Store level needed before the licence can be bought.")] public int storeLevel = 1;
        [Tooltip("₹. 0 = owned from the start.")] public int licenceCost;
        public Sprite icon;
    }
}
