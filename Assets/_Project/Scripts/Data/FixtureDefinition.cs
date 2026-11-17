using MiniMart.Simulation.Catalogue;
using UnityEngine;

namespace MiniMart.Data
{
    /// <summary>A fixture type (shelf, fridge, freezer, produce crate) and its base capacity.</summary>
    [CreateAssetMenu(menuName = "MiniMart/Fixture", fileName = "Fixture")]
    public sealed class FixtureDefinition : ScriptableObject
    {
        [SerializeField] private FixtureKind kind = FixtureKind.Shelf;
        [SerializeField] private string displayName = "Shelf";
        [Tooltip("Units it holds before upgrades (prototype: shelf 24, fridge 18, freezer 16, produce 20).")]
        [Min(1)] [SerializeField] private int baseCapacity = 24;

        public FixtureKind Kind => kind;
        public string DisplayName => displayName;
        public int BaseCapacity => baseCapacity;

        public void Configure(FixtureKind fixtureKind, string name, int capacity)
        {
            kind = fixtureKind; displayName = name; baseCapacity = Mathf.Max(1, capacity);
        }

        public static FixtureDefinition CreateRuntime(FixtureKind fixtureKind)
        {
            var d = CreateInstance<FixtureDefinition>();
            d.Configure(fixtureKind, KindRules.DisplayName(fixtureKind), KindRules.PrototypeBaseCapacity(fixtureKind));
            d.name = fixtureKind.ToString();
            return d;
        }
    }
}
