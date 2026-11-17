using System.Collections.Generic;
using UnityEngine;

namespace MiniMart.Data
{
    // Captured from the prototype in Phase 0 so the numbers live in data from day one.
    // Gameplay that uses it arrives in Phase 2/4.

    /// <summary>Equipment upgrade or staff hire.</summary>
    [CreateAssetMenu(menuName = "MiniMart/Upgrade", fileName = "Upgrade")]
    public sealed class UpgradeDefinition : ScriptableObject
    {
        public string key = "";
        public string displayName = "";
        public int storeLevel = 1;
        [Tooltip("Cost of each purchase in order. One entry for single upgrades.")] public List<int> costs = new List<int>();
        public int maxCount = 1;
        [Tooltip("₹ per day per hire (staff only).")] public int dailyWage;
        [TextArea] public string description = "";
    }
}
