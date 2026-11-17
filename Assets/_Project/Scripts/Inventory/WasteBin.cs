using MiniMart.Core;
using MiniMart.Interaction;
using UnityEngine;

namespace MiniMart.Inventory
{
    /// <summary>Bin the box you're carrying (Discarded). Anything still inside counts as waste at supplier cost.</summary>
    public sealed class WasteBin : MonoBehaviour, IInteractable
    {
        public InteractionPrompt GetPrompt(in PlayerInteractionContext ctx)
        {
            if (!ctx.IsCarrying) return InteractionPrompt.Info("Waste bin");
            var c = ctx.Carry.Carried.Contents;
            return c.IsEmpty
                ? InteractionPrompt.Action("Throw away the empty box")
                : InteractionPrompt.Action($"Throw away {c.Units} × {c.Product.DisplayName} (−₹{c.CostValue} waste)");
        }

        public void Interact(in PlayerInteractionContext ctx)
        {
            if (!ctx.IsCarrying) return;
            var c = ctx.Carry.Carried.Contents;
            string what = c.IsEmpty ? "an empty box" : $"{c.Units} × {c.Product.DisplayName}";
            int worth = ctx.Carry.Discard();
            SessionStats.AddWaste(worth);
            GameMessages.Post(worth > 0 ? $"{ctx.PlayerName} binned {what} (₹{worth} waste)" : $"{ctx.PlayerName} binned {what}",
                worth > 0 ? MessageKind.Spend : MessageKind.Info);
        }

        public void InteractSecondary(in PlayerInteractionContext ctx) { }
    }
}
