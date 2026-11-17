using MiniMart.Player;
using UnityEngine;

namespace MiniMart.Interaction
{
    /// <summary>
    /// Ray from the centre of the camera. Finds the nearest IInteractable in reach, highlights it,
    /// exposes its prompt for the HUD and routes E / R / Q presses.
    /// </summary>
    [RequireComponent(typeof(CarryController))]
    public sealed class InteractionController : MonoBehaviour
    {
        [SerializeField] private Camera viewCamera;
        [Tooltip("Metres. The prototype's 2.2 tiles (4.4 m) is generous for first person.")]
        [SerializeField] private float reach = 2.6f;
        [Tooltip("Sphere radius for the cast, so small targets are easy to hit.")]
        [SerializeField] private float castRadius = 0.12f;
        [SerializeField] private LayerMask interactMask = ~0;

        private PlayerInputReader input;
        private IInteractable target;
        private Component targetComponent;
        private InteractableHighlight targetHighlight;

        public CarryController Carry { get; private set; }
        public string PlayerName { get; set; } = "You";
        public IInteractable Target => target;
        public Component TargetComponent => targetComponent;
        public InteractionPrompt CurrentPrompt { get; private set; } = InteractionPrompt.None;
        public float Reach => reach;

        public void SetCamera(Camera cam) => viewCamera = cam;

        private void Awake()
        {
            Carry = GetComponent<CarryController>();
            input = GetComponent<PlayerInputReader>();
            if (viewCamera == null) viewCamera = GetComponentInChildren<Camera>();
        }

        private void Update()
        {
            UpdateTarget();
            if (input == null || !input.HasFocus) return;

            if (input.InteractPressedInGame) PressPrimary();
            else if (input.EmptyPressed) PressSecondary();
            else if (input.DropPressed) Carry.Drop();
        }

        /// <summary>E / left-click on the current target.</summary>
        public void PressPrimary()
        {
            RefreshPrompt();
            if (target != null && CurrentPrompt.PrimaryEnabled) target.Interact(this);
            RefreshPrompt();
        }

        /// <summary>R on the current target.</summary>
        public void PressSecondary()
        {
            RefreshPrompt();
            if (target != null && CurrentPrompt.SecondaryEnabled) target.InteractSecondary(this);
            RefreshPrompt();
        }

        public void UpdateTarget()
        {
            IInteractable found = null;
            Component foundComponent = null;
            if (viewCamera != null)
            {
                var ray = new Ray(viewCamera.transform.position, viewCamera.transform.forward);
                var hits = Physics.SphereCastAll(ray, castRadius, reach, interactMask, QueryTriggerInteraction.Collide);
                float best = float.MaxValue;
                foreach (var h in hits)
                {
                    if (h.collider == null) continue;
                    // ignore ourselves and whatever we're carrying
                    if (h.collider.transform.IsChildOf(transform)) continue;
                    if (Carry.IsCarrying && h.collider.transform.IsChildOf(Carry.Carried.transform)) continue;
                    var i = h.collider.GetComponentInParent<IInteractable>();
                    float d = h.distance;
                    if (i == null)
                    {
                        // a solid non-interactable in front blocks anything behind it
                        if (!h.collider.isTrigger && d < best) { best = d; found = null; foundComponent = null; }
                        continue;
                    }
                    if (d < best) { best = d; found = i; foundComponent = (Component)i; }
                }
            }

            if (!ReferenceEquals(foundComponent, targetComponent))
            {
                if (targetHighlight != null) targetHighlight.SetHighlighted(false);
                target = found;
                targetComponent = foundComponent;
                targetHighlight = foundComponent != null ? foundComponent.GetComponent<InteractableHighlight>() : null;
                if (targetHighlight != null) targetHighlight.SetHighlighted(true);
            }

            RefreshPrompt();
        }

        /// <summary>Re-reads the prompt from the current target (it changes as stock moves).</summary>
        public void RefreshPrompt()
        {
            if (target != null && targetComponent == null) { target = null; targetHighlight = null; }   // destroyed
            CurrentPrompt = target != null ? target.GetPrompt(this) : InteractionPrompt.None;
        }

        /// <summary>For tests and scripted setups: target something directly, skipping the raycast.</summary>
        public void ForceTarget(IInteractable interactable)
        {
            target = interactable;
            targetComponent = interactable as Component;
            RefreshPrompt();
        }
    }
}
