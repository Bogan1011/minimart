namespace MiniMart.Interaction
{
    /// <summary>
    /// What the player sees when looking at something: up to two actions with labels.
    /// Primary = E / left-click. Secondary = R.
    /// </summary>
    public readonly struct InteractionPrompt
    {
        public readonly string Primary;
        public readonly bool PrimaryEnabled;
        public readonly string Secondary;
        public readonly bool SecondaryEnabled;

        public InteractionPrompt(string primary, bool primaryEnabled, string secondary = null, bool secondaryEnabled = false)
        {
            Primary = primary;
            PrimaryEnabled = primaryEnabled;
            Secondary = secondary;
            SecondaryEnabled = secondaryEnabled;
        }

        public static readonly InteractionPrompt None = new InteractionPrompt(null, false);

        public static InteractionPrompt Action(string label) => new InteractionPrompt(label, true);
        public static InteractionPrompt Blocked(string reason) => new InteractionPrompt(reason, false);
        public static InteractionPrompt Info(string text) => new InteractionPrompt(text, false);

        public bool IsEmpty => string.IsNullOrEmpty(Primary) && string.IsNullOrEmpty(Secondary);
    }

    /// <summary>
    /// Anything the player can target with the interaction raycast. Implementations must re-check
    /// their own rules inside Interact (the prompt may be a frame old, and in multiplayer the host
    /// will call these after validating the request).
    /// </summary>
    public interface IInteractable
    {
        InteractionPrompt GetPrompt(InteractionController who);
        void Interact(InteractionController who);
        void InteractSecondary(InteractionController who);
    }
}
