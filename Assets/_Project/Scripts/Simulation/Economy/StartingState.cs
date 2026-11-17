namespace MiniMart.Simulation.Economy
{
    /// <summary>
    /// How a new game starts (decided by Akshay, 2026-11-17). No starter stock: players buy every box
    /// from the supplier, and whatever is on fixtures, in storage or on the floor carries over to the next
    /// day (it only ages). Day 1 cash must cover a first order.
    /// </summary>
    public static class StartingState
    {
        /// <summary>
        /// ₹8,000. The prototype's ₹5,000 bought only about three quarters of one box of each Day 1
        /// product (₹6,592 for all twelve). ₹8,000 covers all twelve plus Day 1 rent (₹325) with about
        /// ₹1,000 to spare. Tune in playtest; CatalogueTests checks it still covers a first order.
        /// </summary>
        public const int Cash = 8000;

        /// <summary>Fixtures start empty and the delivery pad starts clear.</summary>
        public const bool StarterStock = false;

        public const int Reputation = 50;

        /// <summary>
        /// Start small: Level 1 is a corner shop with one till and room to grow. The prototype began
        /// with 2 tills, 8 shelves, 2 fridges and 2 produce stands; we start with 1 till, 4 shelves,
        /// 1 fridge and 1 produce crate, and the rest arrives as the store expands.
        /// </summary>
        public const int StoreLevel = 1;
        public const int Tills = 1;
        public const int Shelves = 4;
        public const int Fridges = 1;
        public const int ProduceCrates = 1;

        /// <summary>Rent paid at close of day: level rent + ₹25 × day number (prototype rule).</summary>
        public static int RentFor(int levelRent, int day) => levelRent + 25 * day;
    }
}
