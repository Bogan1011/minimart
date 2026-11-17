using MiniMart.Handling;
using UnityEngine;

namespace MiniMart.Interaction
{
    /// <summary>
    /// What the player sees when aiming at something: up to two actions. Primary = E / left-click,
    /// secondary = R. <see cref="Repeatable"/> means holding E repeats the action (stocking unit by unit).
    /// </summary>
    public readonly struct InteractionPrompt
    {
        public readonly string Primary;
        public readonly bool PrimaryEnabled;
        public readonly string Secondary;
        public readonly bool SecondaryEnabled;
        public readonly bool Repeatable;

        public InteractionPrompt(string primary, bool primaryEnabled, string secondary = null, bool secondaryEnabled = false, bool repeatable = false)
        {
            Primary = primary;
            PrimaryEnabled = primaryEnabled;
            Secondary = secondary;
            SecondaryEnabled = secondaryEnabled;
            Repeatable = repeatable;
        }

        public static readonly InteractionPrompt None = new InteractionPrompt(null, false);
        public static InteractionPrompt Action(string label, bool repeatable = false) => new InteractionPrompt(label, true, null, false, repeatable);
        public static InteractionPrompt Blocked(string reason) => new InteractionPrompt(reason, false);
        public static InteractionPrompt Info(string text) => new InteractionPrompt(text, false);

        public InteractionPrompt WithSecondary(string label, bool enabled = true) =>
            new InteractionPrompt(Primary, PrimaryEnabled, label, enabled, Repeatable);

        public bool IsEmpty => string.IsNullOrEmpty(Primary) && string.IsNullOrEmpty(Secondary);
    }

    /// <summary>
    /// Everything an interactable needs to know about who is acting and where they're aiming
    /// (blueprint §8.2 PlayerInteractionContext). In multiplayer the host rebuilds this from the
    /// client's request before calling Interact.
    /// </summary>
    public readonly struct PlayerInteractionContext
    {
        public readonly PlayerInteractionController Controller;
        public readonly Collider HitCollider;
        public readonly Vector3 HitPoint;
        public readonly bool HasHitPoint;

        public PlayerInteractionContext(PlayerInteractionController controller, Collider hitCollider, Vector3 hitPoint, bool hasHitPoint)
        {
            Controller = controller;
            HitCollider = hitCollider;
            HitPoint = hitPoint;
            HasHitPoint = hasHitPoint;
        }

        public CarryController Carry => Controller.Carry;
        public string PlayerName => Controller.PlayerName;
        public bool IsCarrying => Controller.Carry.IsCarrying;
    }

    /// <summary>
    /// Anything the interaction ray can target (blueprint §8.2). Implementations re-check their own
    /// rules inside Interact: the prompt may be a frame old, and in multiplayer the host calls these
    /// after validating a client's request.
    /// </summary>
    public interface IInteractable
    {
        InteractionPrompt GetPrompt(in PlayerInteractionContext context);
        void Interact(in PlayerInteractionContext context);
        void InteractSecondary(in PlayerInteractionContext context);
    }
}
