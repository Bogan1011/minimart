using UnityEngine;

namespace MiniMart.Core
{
    /// <summary>
    /// Running counters for the HUD in Sprint 1. Becomes the day ledger (EconomyManager) in Phase 2.
    /// </summary>
    public static class SessionStats
    {
        public static int UnitsStocked { get; private set; }
        public static int WasteValue { get; private set; }

        public static void AddStocked(int units) { if (units > 0) UnitsStocked += units; }
        public static void AddWaste(int rupees) { if (rupees > 0) WasteValue += rupees; }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void Reset()
        {
            UnitsStocked = 0;
            WasteValue = 0;
        }
    }
}
