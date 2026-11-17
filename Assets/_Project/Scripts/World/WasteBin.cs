using MiniMart.Core;
using MiniMart.Interaction;
using UnityEngine;

namespace MiniMart.World
{
    /// <summary>Throw away the box you're carrying. Its supplier value counts as waste.</summary>
    public sealed class WasteBin : MonoBehaviour, IInteractable
    {
        public InteractionPrompt GetPrompt(InteractionController who)
        {
            if (!who.Carry.IsCarrying) return InteractionPrompt.Info("Waste bin");
            var c = who.Carry.Carried.Contents;
            return InteractionPrompt.Action($"Throw away {c.Product.DisplayName} (−₹{c.CostValue} waste)");
        }

        public void Interact(InteractionController who)
        {
            if (!who.Carry.IsCarrying) return;
            var c = who.Carry.Carried.Contents;
            int worth = c.CostValue;
            SessionStats.AddWaste(worth);
            GameMessages.Post($"{who.PlayerName} binned {c.Units} × {c.Product.DisplayName} (₹{worth} waste)", MessageKind.Spend);
            who.Carry.ConsumeCarried();
        }

        public void InteractSecondary(InteractionController who) { }
    }
}
