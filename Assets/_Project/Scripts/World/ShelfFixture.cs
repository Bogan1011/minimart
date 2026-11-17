using System;
using MiniMart.Core;
using MiniMart.Data;
using MiniMart.Interaction;
using MiniMart.Simulation.Catalogue;
using MiniMart.Simulation.Inventory;
using UnityEngine;

namespace MiniMart.World
{
    /// <summary>
    /// A shelf, fridge, freezer or produce crate. Owns a FixtureStock and applies StockRules to it.
    /// E with a box: stock it. R empty-handed: empty it into a box (expired stock goes to waste).
    /// </summary>
    public sealed class ShelfFixture : MonoBehaviour, IInteractable
    {
        [SerializeField] private FixtureDefinition definition;
        [SerializeField] private bool unlocked = true;
        [Tooltip("Deep shelving = 1.5.")]
        [SerializeField] private float capacityMultiplier = 1f;
        [Header("Optional starting stock (test maps / demos)")]
        [SerializeField] private ProductDefinition startProduct;
        [SerializeField] private int startQuantity;
        [Tooltip("Start the stock already expired (to try clearing it with R).")]
        [SerializeField] private bool startExpired;
        [Header("Presentation")]
        [SerializeField] private FixtureStockView view;
        [SerializeField] private string lockedMessage = "Locked - expand the store first";

        private InteractableHighlight highlight;

        public FixtureStock Stock { get; private set; }
        public FixtureDefinition Definition => definition;
        public string DisplayName => definition != null ? definition.DisplayName : "fixture";

        /// <summary>Raised after any change to the stock on this fixture.</summary>
        public event Action<ShelfFixture> StockChanged;

        public void Setup(FixtureDefinition def, FixtureStockView stockView, bool isUnlocked = true)
        {
            definition = def; view = stockView; unlocked = isUnlocked;
        }

        public void SetStartStock(ProductDefinition product, int quantity, bool expired = false)
        {
            startProduct = product; startQuantity = quantity; startExpired = expired;
        }

        private void Awake()
        {
            highlight = GetComponent<InteractableHighlight>();
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
            Stock = new FixtureStock(definition.Kind, CapacityFor(capacityMultiplier), unlocked);
            if (startProduct != null && startQuantity > 0) Stock.SetContents(startProduct, startQuantity, startExpired ? 0 : startProduct.FreshDaysLeft());
        }

        private int CapacityFor(float multiplier) => Mathf.Max(1, Mathf.RoundToInt(definition.BaseCapacity * multiplier));

        public void SetCapacityMultiplier(float multiplier)
        {
            capacityMultiplier = multiplier;
            EnsureStock();
            Stock.SetCapacity(CapacityFor(multiplier));
            Changed();
        }

        public void SetUnlocked(bool isUnlocked)
        {
            unlocked = isUnlocked;
            EnsureStock();
            Stock.Unlocked = isUnlocked;
            Changed();
        }

        // ---------------------------------------------------------------- interaction

        public InteractionPrompt GetPrompt(InteractionController who)
        {
            EnsureStock();
            if (who.Carry.IsCarrying)
            {
                var check = StockRules.Check(Stock, who.Carry.Carried.Contents);
                if (check.Verdict == StockVerdict.Locked) return InteractionPrompt.Blocked(lockedMessage);
                return check.Allowed ? InteractionPrompt.Action(check.Prompt) : InteractionPrompt.Blocked(check.Prompt);
            }

            if (!Stock.Unlocked) return InteractionPrompt.Info(lockedMessage);
            if (Stock.IsEmpty) return InteractionPrompt.Info($"Empty {DisplayName} - bring a box");
            string productName = Stock.Product.DisplayName;
            if (Stock.IsExpired)
                return new InteractionPrompt($"{productName} has EXPIRED - shoppers won't buy it", false, "Clear it out", true);
            string days = Stock.DaysLeft.HasValue ? $" · {Stock.DaysLeft} day{(Stock.DaysLeft == 1 ? "" : "s")} left" : "";
            return new InteractionPrompt($"{productName}: {Stock.Quantity}/{Stock.Capacity} at ₹{Stock.Product.BasePrice}{days}", false, "Empty", true);
        }

        public void Interact(InteractionController who)
        {
            EnsureStock();
            if (!who.Carry.IsCarrying) return;
            int moved = StockRules.Stock(Stock, who.Carry.Carried.Contents);
            if (moved <= 0) return;
            SessionStats.AddStocked(moved);
            who.Carry.Carried.RefreshVisuals();
            who.Carry.ConsumeIfEmpty();
            Changed();
        }

        public void InteractSecondary(InteractionController who)
        {
            EnsureStock();
            if (who.Carry.IsCarrying || Stock.IsEmpty) return;

            // remember what was there in case the box can't be handed over
            var product = Stock.Product; int qty = Stock.Quantity; int? days = Stock.DaysLeft;
            var outcome = StockRules.Empty(Stock);
            if (outcome.Kind == EmptyOutcomeKind.Wasted)
            {
                SessionStats.AddWaste(outcome.WasteValue);
                GameMessages.Post($"{who.PlayerName} cleared {outcome.WastedUnits} expired {product.DisplayName} (₹{outcome.WasteValue} waste)", MessageKind.Spend);
            }
            else if (outcome.Kind == EmptyOutcomeKind.Boxed && !who.Carry.TryHoldNew(outcome.Box))
            {
                Stock.SetContents(product, qty, days);   // undo: never lose stock
            }
            Changed();
        }

        // ---------------------------------------------------------------- presentation

        private void Changed()
        {
            RefreshView();
            StockChanged?.Invoke(this);
        }

        public void RefreshView()
        {
            if (view == null || Stock == null) return;
            bool lit = highlight != null && highlight.IsHighlighted;
            if (lit) highlight.SetHighlighted(false);

            string ticket;
            if (!Stock.Unlocked) ticket = "LOCKED";
            else if (Stock.IsEmpty) ticket = $"Empty {DisplayName}";
            else ticket = $"{Stock.Product.DisplayName}  ₹{Stock.Product.BasePrice}\n{Stock.Quantity}/{Stock.Capacity}{(Stock.IsExpired ? "  EXPIRED" : "")}";
            view.Show(Stock.Product as ProductDefinition, Stock.IsEmpty ? 0 : Stock.Quantity, Stock.Capacity, ticket);

            if (lit) highlight.SetHighlighted(true);
        }
    }
}
