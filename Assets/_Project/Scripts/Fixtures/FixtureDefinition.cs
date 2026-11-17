using MiniMart.Simulation.Catalogue;
using UnityEngine;

namespace MiniMart.Fixtures
{
    /// <summary>A fixture type and its slot layout (blueprint §6.4, §9.4).</summary>
    [CreateAssetMenu(menuName = "MiniMart/Fixture", fileName = "Fixture")]
    public sealed class FixtureDefinition : ScriptableObject
    {
        [SerializeField] private FixtureKind kind = FixtureKind.Shelf;
        [SerializeField] private string displayName = "Shelf";
        [Tooltip("Shelf levels (rows of slots).")]
        [Min(1)] [SerializeField] private int levels = 3;
        [Tooltip("Slots across each level.")]
        [Min(1)] [SerializeField] private int slotsPerLevel = 2;
        [Tooltip("Units each slot holds before upgrades.")]
        [Min(1)] [SerializeField] private int unitsPerSlot = 4;

        public FixtureKind Kind => kind;
        public string DisplayName => displayName;
        public int Levels => levels;
        public int SlotsPerLevel => slotsPerLevel;
        public int SlotCount => levels * slotsPerLevel;
        public int UnitsPerSlot => unitsPerSlot;
        /// <summary>Total units (prototype BASE_CAP: shelf 24, fridge 18, freezer 16, produce 20).</summary>
        public int BaseCapacity => SlotCount * unitsPerSlot;

        public void Configure(FixtureKind fixtureKind, string name, int levelCount, int perLevel, int perSlot)
        {
            kind = fixtureKind; displayName = name;
            levels = Mathf.Max(1, levelCount); slotsPerLevel = Mathf.Max(1, perLevel); unitsPerSlot = Mathf.Max(1, perSlot);
        }

        /// <summary>Prototype layouts: shelf 3 × 2 × 4, fridge 3 × 3 × 2, freezer 2 × 4 × 2, produce 1 × 5 × 4.</summary>
        public static void PrototypeShape(FixtureKind kind, out int levelCount, out int perLevel, out int perSlot)
        {
            KindRules.PrototypeSlotLayout(kind, out int slots, out perSlot);
            switch (kind)
            {
                case FixtureKind.Shelf: levelCount = 3; break;
                case FixtureKind.Fridge: levelCount = 3; break;
                case FixtureKind.Freezer: levelCount = 2; break;
                default: levelCount = 1; break;
            }
            perLevel = slots / levelCount;
        }

        public static FixtureDefinition CreateRuntime(FixtureKind fixtureKind)
        {
            var d = CreateInstance<FixtureDefinition>();
            PrototypeShape(fixtureKind, out int l, out int p, out int u);
            string n = KindRules.DisplayName(fixtureKind);
            d.Configure(fixtureKind, char.ToUpperInvariant(n[0]) + n.Substring(1), l, p, u);
            d.name = fixtureKind.ToString();
            return d;
        }
    }
}
