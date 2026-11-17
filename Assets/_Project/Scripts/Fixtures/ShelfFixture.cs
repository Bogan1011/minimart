using System;
using MiniMart.Core;
using MiniMart.Interaction;
using MiniMart.Products;
using MiniMart.Simulation.Catalogue;
using MiniMart.Simulation.Inventory;
using UnityEngine;

namespace MiniMart.Fixtures
{
    /// <summary>
    /// A shelf, fridge, freezer or produce crate made of named slots (blueprint §6.4, §9.4).
    /// With an open box: E stocks one unit into the slot you aim at (hold to repeat); R takes one back.
    /// Empty-handed: R empties the aimed slot into a box (expired stock goes straight to waste).
    /// </summary>
    public sealed class ShelfFixture : MonoBehaviour, IInteractable
    {
        [SerializeField] private FixtureDefinition definition;
        [SerializeField] private ShelfSlot[] slots = new ShelfSlot[0];
        [SerializeField] private bool unlocked = true;
        [Tooltip("Deep shelving = 1.5.")]
        [SerializeField] private float capacityMultiplier = 1f;
        [Header("Optional starting stock (test maps / demos): fills slots in order")]
        [SerializeField] private ProductDefinition startProduct;
        [SerializeField] private int startQuantity;
        [Tooltip("Start the stock already expired (to try clearing it).")]
        [SerializeField] private bool startExpired;
        [SerializeField] private string lockedMessage = "Locked - expand the store first";

        private InteractableHighlight highlight;

        public FixtureStock Stock { get; private set; }
        public FixtureDefinition Definition => definition;
        public string DisplayName => definition != null ? definition.DisplayName : "Fixture";
        public ShelfSlot[] Slots => slots;

        /// <summary>Raised after any change to the stock on this fixture.</summary>
        public event Action<ShelfFixture> StockChanged;

        public void Setup(FixtureDefinition def, ShelfSlot[] slotViews, bool isUnlocked = true)
        {
            definition = def; slots = slotViews; unlocked = isUnlocked;
        }

        public void SetStartStock(ProductDefinition product, int quantity, bool expired = false)
        {
            startProduct = product; startQuantity = quantity; startExpired = expired;
        }

        private void Awake()
        {
            highlight = GetComponent<InteractableHighlight>();
            GameLayers.Set(gameObject, GameLayers.Fixture, recursive: false);
            EnsureStock();
        }

        private void Start() => RefreshView();

        private void EnsureStock()
        {
            if (Stock != null) return;
            if (definition == null)
            {
                Debug.LogError($"{name}: ShelfFixture has no FixtureDefinition. Run MiniMart ▸ Import Prototype Catalogue.", this);
                definition = FixtureDefinition.CreateRuntime(FixtureKind.Shelf);
            }
            Stock = new FixtureStock(definition.Kind, definition.SlotCount, definition.UnitsPerSlot, unlocked);
            if (!Mathf.Approximately(capacityMultiplier, 1f)) Stock.SetCapacityMultiplier(capacityMultiplier);
            if (startProduct != null && startQuantity > 0)
            {
                int left = startQuantity;
                int? days = startExpired ? 0 : startProduct.FreshDaysLeft();
                for (int i = 0; i < Stock.SlotCount && left > 0; i++)
                {
                    int q = Math.Min(left, Stock.Slots[i].Capacity);
                    Stock.SetSlot(i, startProduct, q, days);
                    left -= q;
                }
            }
        }

        public void SetCapacityMultiplier(float multiplier)
        {
            capacityMultiplier = multiplier;
            EnsureStock();
            Stock.SetCapacityMultiplier(multiplier);
            Changed();
        }

        public void SetUnlocked(bool isUnlocked)
        {
            unlocked = isUnlocked;
            EnsureStock();
            Stock.Unlocked = isUnlocked;
            Changed();
        }

        /// <summary>The slot nearest the aim point, or -1 if there's no aim point.</summary>
        public int AimedSlot(in PlayerInteractionContext ctx)
        {
            if (!ctx.HasHitPoint || slots == null || slots.Length == 0) return -1;
            int best = -1; float bestD = float.MaxValue;
            for (int i = 0; i < slots.Length; i++)
            {
                if (slots[i] == null) continue;
                float dist = (ctx.HitPoint - slots[i].WorldCentre).sqrMagnitude;
                if (dist < bestD) { bestD = dist; best = slots[i].Index; }
            }
            return best;
        }

        // ---------------------------------------------------------------- interaction

        public InteractionPrompt GetPrompt(in PlayerInteractionContext ctx)
        {
            EnsureStock();
            int aimed = AimedSlot(ctx);

            if (ctx.IsCarrying)
            {
                var box = ctx.Carry.Carried.Contents;
                var check = StockRules.Check(Stock, box, aimed);
                InteractionPrompt p;
                if (check.Verdict == StockVerdict.Locked) p = InteractionPrompt.Blocked(lockedMessage);
                else if (check.Verdict == StockVerdict.BoxClosed) p = InteractionPrompt.Blocked("Open the box first [F]");
                else p = check.Allowed ? InteractionPrompt.Action(check.Prompt, repeatable: true) : InteractionPrompt.Blocked(check.Prompt);
                if (aimed >= 0 && StockRules.CanTakeBack(Stock, aimed, box)) p = p.WithSecondary("Take one back");
                return p;
            }

            if (!Stock.Unlocked) return InteractionPrompt.Info(lockedMessage);
            var s = aimed >= 0 ? Stock.Slot(aimed) : null;
            if (s == null || s.IsEmpty)
                return InteractionPrompt.Info(Stock.IsEmpty ? $"Empty {DisplayName.ToLowerInvariant()} - bring an open box"
                                                            : $"{DisplayName}: {Stock.Quantity}/{Stock.Capacity}");
            string productName = s.Product.DisplayName;
            if (s.IsExpired)
                return InteractionPrompt.Info($"{productName} has EXPIRED - shoppers won't buy it").WithSecondary("Clear it out");
            string days = s.DaysLeft.HasValue ? $" · {s.DaysLeft} day{(s.DaysLeft == 1 ? "" : "s")} left" : "";
            return InteractionPrompt.Info($"{productName}: {s.Quantity}/{s.Capacity} at ₹{PriceOf(s.Product)}{days}").WithSecondary("Empty this slot");
        }

        public void Interact(in PlayerInteractionContext ctx)
        {
            EnsureStock();
            if (!ctx.IsCarrying) return;
            var carried = ctx.Carry.Carried;
            int slot = StockRules.StockOne(Stock, carried.Contents, AimedSlot(ctx));
            if (slot < 0) return;
            SessionStats.AddStocked(1);
            carried.RefreshVisuals();
            Changed();
        }

        public void InteractSecondary(in PlayerInteractionContext ctx)
        {
            EnsureStock();
            int aimed = AimedSlot(ctx);
            if (aimed < 0) return;

            if (ctx.IsCarrying)
            {
                if (StockRules.TakeBackOne(Stock, aimed, ctx.Carry.Carried.Contents))
                {
                    ctx.Carry.Carried.RefreshVisuals();
                    Changed();
                }
                return;
            }

            var s = Stock.Slot(aimed);
            if (s.IsEmpty) return;
            var product = s.Product; int qty = s.Quantity; int? days = s.DaysLeft;   // to undo if needed
            var outcome = StockRules.EmptySlot(Stock, aimed);
            if (outcome.Kind == EmptyOutcomeKind.Wasted)
            {
                SessionStats.AddWaste(outcome.WasteValue);
                GameMessages.Post($"{ctx.PlayerName} cleared {outcome.WastedUnits} expired {product.DisplayName} (₹{outcome.WasteValue} waste)", MessageKind.Spend);
            }
            else if (outcome.Kind == EmptyOutcomeKind.Boxed && !ctx.Carry.TryHoldNew(outcome.Box))
            {
                Stock.SetSlot(aimed, product, qty, days);   // never lose stock
            }
            Changed();
        }

        /// <summary>Selling price. Store pricing (players setting prices) arrives with the EconomyManager; MRP until then.</summary>
        private static int PriceOf(IProduct p) => p is ProductDefinition d ? d.DefaultSellingPrice : p.BasePrice;

        // ---------------------------------------------------------------- presentation

        private void Changed()
        {
            RefreshView();
            StockChanged?.Invoke(this);
        }

        public void RefreshView()
        {
            if (Stock == null || slots == null) return;
            bool lit = highlight != null && highlight.IsHighlighted;
            if (lit) highlight.SetHighlighted(false);
            foreach (var view in slots)
            {
                if (view == null) continue;
                var s = Stock.Slot(view.Index);
                if (s == null) continue;
                var product = s.IsEmpty ? null : s.Product as ProductDefinition;
                view.Show(product, s.IsEmpty ? 0 : s.Quantity, s.Capacity, product != null ? PriceOf(product) : 0, s.IsExpired);
            }
            if (lit) highlight.SetHighlighted(true);
        }
    }
}
