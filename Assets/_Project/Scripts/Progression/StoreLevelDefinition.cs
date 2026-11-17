using System.Collections.Generic;
using MiniMart.Products;
using UnityEngine;

namespace MiniMart.Progression
{
    // Captured from the prototype in Phase 0 so the numbers live in data from day one.
    // Gameplay that uses it arrives in Phase 2/4.

    /// <summary>One of the four store sizes.</summary>
    [CreateAssetMenu(menuName = "MiniMart/Store Level", fileName = "StoreLevel")]
    public sealed class StoreLevelDefinition : ScriptableObject
    {
        public int level = 1;
        public string displayName = "";
        [Tooltip("₹ to expand to this level.")] public int cost;
        [Tooltip("Lifetime shoppers served needed.")] public int servedRequired;
        [Tooltip("Reputation needed (0-100).")] public int reputationRequired;
        [Tooltip("Base rent per day, ₹. Prototype adds ₹25 × day number.")] public int rentPerDay;
        [Tooltip("Most shoppers per day.")] public int dailyCustomerCap;
        [Tooltip("Most shoppers inside at once.")] public int crowdCap;
        [Tooltip("Product categories this level makes available to license.")] public List<ProductCategoryDefinition> availableCategories = new List<ProductCategoryDefinition>();
        [TextArea] public string description = "";
    }
}
