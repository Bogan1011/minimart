using System;
using MiniMart.Simulation.Catalogue;

namespace MiniMart.Simulation.Inventory
{
    /// <summary>Where a box physically is. Blueprint §6.3: Delivered → On Ground → Held → Stored → … → Discarded.</summary>
    public enum BoxLocation
    {
        /// <summary>On the delivery pad, untouched since it arrived.</summary>
        Delivered,
        OnGround,
        Held,
        /// <summary>On a storage rack slot.</summary>
        Stored,
        /// <summary>Thrown in the waste bin. Terminal.</summary>
        Discarded,
    }

    /// <summary>The blueprint's single box state, derived from location + opened + contents. For UI and tests.</summary>
    public enum BoxState { Delivered, OnGround, Held, Stored, Opened, Empty, Discarded }

    /// <summary>
    /// One cardboard box: one product, a unit count, freshness, whether it has been opened and where it
    /// is. Units only move between boxes and fixture slots through <see cref="StockRules"/>, one at a
    /// time, so they are never copied.
    /// </summary>
    public sealed class BoxContents
    {
        public IProduct Product { get; }
        public int Units { get; internal set; }

        /// <summary>Most units this box can hold (a supplier box's pack count).</summary>
        public int Capacity { get; }

        /// <summary>Days before expiry, or null if the product never expires.</summary>
        public int? DaysLeft { get; internal set; }

        /// <summary>Closed boxes can be carried and stored but not unpacked (blueprint §9.5).</summary>
        public bool IsOpen { get; internal set; }

        public BoxLocation Location { get; internal set; }

        public BoxContents(IProduct product, int units, int? daysLeft, bool isOpen = false, BoxLocation location = BoxLocation.OnGround)
        {
            if (product == null) throw new ArgumentNullException(nameof(product));
            if (units < 0) throw new ArgumentOutOfRangeException(nameof(units), units, "Units cannot be negative.");
            Product = product;
            Capacity = Math.Max(units, product.UnitsPerBox);
            Units = units;
            DaysLeft = product.IsPerishable() ? daysLeft : null;
            IsOpen = isOpen;
            Location = location;
        }

        /// <summary>A full, sealed box straight from the supplier, sitting on the delivery pad.</summary>
        public static BoxContents FreshFromSupplier(IProduct product) =>
            new BoxContents(product, product.UnitsPerBox, product.FreshDaysLeft(), false, BoxLocation.Delivered);

        public bool IsEmpty => Units <= 0;
        public bool IsFull => Units >= Capacity;
        public bool IsExpired => DaysLeft.HasValue && DaysLeft.Value <= 0;

        /// <summary>Supplier value of what's inside, used for waste accounting.</summary>
        public int CostValue => Units * Product.SupplierCost;

        public BoxState State
        {
            get
            {
                if (Location == BoxLocation.Discarded) return BoxState.Discarded;
                if (IsOpen && IsEmpty) return BoxState.Empty;
                if (IsOpen) return BoxState.Opened;
                switch (Location)
                {
                    case BoxLocation.Delivered: return BoxState.Delivered;
                    case BoxLocation.Held: return BoxState.Held;
                    case BoxLocation.Stored: return BoxState.Stored;
                    default: return BoxState.OnGround;
                }
            }
        }

        public override string ToString() => $"{Product.DisplayName} × {Units} ({State})";
    }

    /// <summary>Box handling rules: where a box may go next, opening, discarding.</summary>
    public static class BoxRules
    {
        public static bool CanMove(BoxContents box, BoxLocation to)
        {
            if (box == null || box.Location == BoxLocation.Discarded || box.Location == to) return false;
            if (box.Location == BoxLocation.Held) return to != BoxLocation.Delivered;   // drop, store or bin
            return to == BoxLocation.Held;                                               // anything else: pick up first
        }

        public static bool TryMove(BoxContents box, BoxLocation to)
        {
            if (!CanMove(box, to)) return false;
            box.Location = to;
            return true;
        }

        /// <summary>Open a box you're holding. Returns false if it's not held or already open.</summary>
        public static bool TryOpen(BoxContents box)
        {
            if (box == null || box.IsOpen || box.Location != BoxLocation.Held) return false;
            box.IsOpen = true;
            return true;
        }

        /// <summary>Bin a held box. Returns the supplier value of anything still inside (counted as waste).</summary>
        public static int Discard(BoxContents box)
        {
            if (box == null || box.Location != BoxLocation.Held) return 0;
            int waste = box.CostValue;
            box.Units = 0;
            box.Location = BoxLocation.Discarded;
            return waste;
        }
    }
}
