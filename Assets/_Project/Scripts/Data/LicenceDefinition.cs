using System.Collections.Generic;
using UnityEngine;

namespace MiniMart.Data
{
    // Captured from the prototype in Phase 0 so the numbers live in data from day one.
    // Gameplay that uses it arrives in Phase 2/4.

    /// <summary>A product line you buy the right to sell.</summary>
    [CreateAssetMenu(menuName = "MiniMart/Licence", fileName = "Licence")]
    public sealed class LicenceDefinition : ScriptableObject
    {
        public string key = "";
        public string displayName = "";
        [Tooltip("Store level needed before it can be bought.")] public int storeLevel = 1;
        [Tooltip("₹. 0 = owned from the start.")] public int cost;
        public List<ProductDefinition> products = new List<ProductDefinition>();
    }
}
