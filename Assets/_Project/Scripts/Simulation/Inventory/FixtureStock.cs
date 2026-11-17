using System;
using MiniMart.Simulation.Catalogue;

namespace MiniMart.Simulation.Inventory
{
    /// <summary>
    /// The stock on one fixture. A fixture holds one product at a time (prototype rule).
    /// </summary>
    public sealed class FixtureStock
    {
        public FixtureKind Kind { get; }

        /// <summary>Most units it can hold right now (base capacity × upgrades).</summary>
        public int Capacity { get; private set; }

        /// <summary>False while the fixture's zone is still behind a hoarding wall.</summary>
        public bool Unlocked { get; set; }

        /// <summary>The product on it, or null when it has never been stocked or was emptied.</summary>
        public IProduct Product { get; internal set; }

        public int Quantity { get; internal set; }

        /// <summary>Days before the oldest unit expires, or null for non-perishables / empty.</summary>
        public int? DaysLeft { get; internal set; }

        public FixtureStock(FixtureKind kind, int capacity, bool unlocked = true)
        {
            Kind = kind;
            SetCapacity(capacity);
            Unlocked = unlocked;
        }

        public bool IsEmpty => Product == null || Quantity <= 0;
        public bool IsFull => !IsEmpty && Quantity >= Capacity;
        public bool IsExpired => !IsEmpty && DaysLeft.HasValue && DaysLeft.Value <= 0;
        public int FreeSpace => Math.Max(0, Capacity - (IsEmpty ? 0 : Quantity));

        /// <summary>Change capacity (e.g. Deep shelving). Stock above the new capacity is kept, not deleted.</summary>
        public void SetCapacity(int capacity)
        {
            if (capacity <= 0) throw new ArgumentOutOfRangeException(nameof(capacity), capacity, "Capacity must be positive.");
            Capacity = capacity;
        }

        internal void Clear()
        {
            Product = null;
            Quantity = 0;
            DaysLeft = null;
        }

        /// <summary>
        /// Put a known amount of stock on directly. For loading saves, test maps and demo setups only;
        /// gameplay goes through <see cref="StockRules"/>.
        /// </summary>
        public void SetContents(IProduct product, int quantity, int? daysLeft)
        {
            if (product == null || quantity <= 0) { Clear(); return; }
            if (product.RequiredFixture() != Kind)
                throw new ArgumentException($"{product.DisplayName} cannot go in a {KindRules.DisplayName(Kind)}.", nameof(product));
            Product = product;
            Quantity = Math.Min(quantity, Capacity);
            DaysLeft = product.IsPerishable() ? daysLeft : null;
        }
    }
}
