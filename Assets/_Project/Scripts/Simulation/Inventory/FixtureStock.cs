using System;
using System.Collections.Generic;
using MiniMart.Simulation.Catalogue;

namespace MiniMart.Simulation.Inventory
{
    /// <summary>
    /// One product slot on a fixture (blueprint §9.4). A slot holds one product, up to its capacity,
    /// with the freshness of its oldest unit.
    /// </summary>
    public sealed class SlotStock
    {
        public int Index { get; }
        public int BaseCapacity { get; }
        public int Capacity { get; internal set; }
        public IProduct Product { get; internal set; }
        public int Quantity { get; internal set; }
        public int? DaysLeft { get; internal set; }

        internal SlotStock(int index, int capacity)
        {
            Index = index;
            BaseCapacity = capacity;
            Capacity = capacity;
        }

        public bool IsEmpty => Product == null || Quantity <= 0;
        public bool IsFull => !IsEmpty && Quantity >= Capacity;
        public bool IsExpired => !IsEmpty && DaysLeft.HasValue && DaysLeft.Value <= 0;
        public int FreeSpace => Math.Max(0, Capacity - (IsEmpty ? 0 : Quantity));

        internal void Clear()
        {
            Product = null;
            Quantity = 0;
            DaysLeft = null;
        }
    }

    /// <summary>
    /// The stock on one fixture: a fixed set of slots. Prototype capacities are kept as slot totals
    /// (shelf 24 = 6 × 4, fridge 18 = 9 × 2, freezer 16 = 8 × 2, produce crate 20 = 5 × 4).
    /// </summary>
    public sealed class FixtureStock
    {
        private readonly SlotStock[] slots;

        public FixtureKind Kind { get; }
        public bool Unlocked { get; set; }
        public IReadOnlyList<SlotStock> Slots => slots;
        public int SlotCount => slots.Length;

        public FixtureStock(FixtureKind kind, int slotCount, int unitsPerSlot, bool unlocked = true)
        {
            if (slotCount <= 0) throw new ArgumentOutOfRangeException(nameof(slotCount));
            if (unitsPerSlot <= 0) throw new ArgumentOutOfRangeException(nameof(unitsPerSlot));
            Kind = kind;
            Unlocked = unlocked;
            slots = new SlotStock[slotCount];
            for (int i = 0; i < slotCount; i++) slots[i] = new SlotStock(i, unitsPerSlot);
        }

        /// <summary>The prototype's slot layout for a fixture kind.</summary>
        public static FixtureStock PrototypeLayout(FixtureKind kind, bool unlocked = true)
        {
            KindRules.PrototypeSlotLayout(kind, out int count, out int perSlot);
            return new FixtureStock(kind, count, perSlot, unlocked);
        }

        public int Capacity { get { int c = 0; foreach (var s in slots) c += s.Capacity; return c; } }
        public int Quantity { get { int q = 0; foreach (var s in slots) q += s.IsEmpty ? 0 : s.Quantity; return q; } }
        public bool IsEmpty => Quantity == 0;

        public int QuantityOf(IProduct product)
        {
            int q = 0;
            foreach (var s in slots) if (!s.IsEmpty && StockRules.SameProduct(s.Product, product)) q += s.Quantity;
            return q;
        }

        public SlotStock Slot(int index) => index >= 0 && index < slots.Length ? slots[index] : null;

        /// <summary>Deep shelving: multiply every slot's base capacity. Stock above the new capacity is kept.</summary>
        public void SetCapacityMultiplier(float multiplier)
        {
            if (multiplier <= 0f) throw new ArgumentOutOfRangeException(nameof(multiplier));
            foreach (var s in slots) s.Capacity = Math.Max(1, (int)Math.Round(s.BaseCapacity * multiplier, MidpointRounding.AwayFromZero));
        }

        /// <summary>
        /// Put stock on a slot directly. For loading saves, test maps and demo setups only; gameplay
        /// goes through <see cref="StockRules"/>.
        /// </summary>
        public void SetSlot(int index, IProduct product, int quantity, int? daysLeft)
        {
            var s = Slot(index) ?? throw new ArgumentOutOfRangeException(nameof(index));
            if (product == null || quantity <= 0) { s.Clear(); return; }
            if (product.RequiredFixture() != Kind)
                throw new ArgumentException($"{product.DisplayName} cannot go in a {KindRules.DisplayName(Kind)}.", nameof(product));
            s.Product = product;
            s.Quantity = Math.Min(quantity, s.Capacity);
            s.DaysLeft = product.IsPerishable() ? daysLeft : null;
        }
    }
}
