using MiniMart.Core;
using MiniMart.Handling;
using MiniMart.Player;
using UnityEngine;

namespace MiniMart.Interaction
{
    /// <summary>
    /// Finds what the player is aiming at, highlights it, exposes its prompt for the HUD and routes
    /// Interact (E) / Secondary (R) / Drop (Q) / Open box (F).
    ///
    /// Target choice follows blueprint §8.3: (1) whatever is dead centre of the view, else (2) valid
    /// objects within reach, (3) smallest angle from the view direction, (4) nearest as tie-break.
    /// Nothing is offered through a wall: a candidate needs a clear line of sight from the camera.
    /// </summary>
    [RequireComponent(typeof(CarryController))]
    public sealed class PlayerInteractionController : MonoBehaviour
    {
        [SerializeField] private Camera viewCamera;
        [Tooltip("Metres (blueprint §8.1: 2.5 m).")]
        [SerializeField] private float reach = 2.5f;
        [Tooltip("Radius of the fallback sphere cast that catches near-misses.")]
        [SerializeField] private float castRadius = 0.15f;
        [Tooltip("Hold E: first repeat after this delay, then every Repeat Interval (s).")]
        [SerializeField] private float repeatDelay = 0.3f;
        [SerializeField] private float repeatInterval = 0.12f;

        private static readonly RaycastHit[] Hits = new RaycastHit[32];
        private static readonly RaycastHit[] SightHits = new RaycastHit[16];

        private PlayerInputReader input;
        private IInteractable target;
        private Component targetComponent;
        private InteractableHighlight targetHighlight;
        private Collider hitCollider;
        private Vector3 hitPoint;
        private bool hasHitPoint;
        private float nextRepeat;

        public CarryController Carry { get; private set; }
        public string PlayerName { get; set; } = "You";
        public IInteractable Target => target;
        public Component TargetComponent => targetComponent;
        public InteractionPrompt CurrentPrompt { get; private set; } = InteractionPrompt.None;
        public float Reach => reach;
        public Camera ViewCamera => viewCamera;

        public void SetCamera(Camera cam) => viewCamera = cam;

        public PlayerInteractionContext Context => new PlayerInteractionContext(this, hitCollider, hitPoint, hasHitPoint);

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

            if (input.InteractPressedInGame) { PressPrimary(); nextRepeat = Time.time + repeatDelay; }
            else if (input.InteractHeld && CurrentPrompt.Repeatable && CurrentPrompt.PrimaryEnabled && Time.time >= nextRepeat)
            {
                PressPrimary();
                nextRepeat = Time.time + repeatInterval;
            }
            else if (input.SecondaryPressed) PressSecondary();
            else if (input.DropPressed) Carry.Drop();
            else if (input.OpenBoxPressed) Carry.OpenCarried();
        }

        /// <summary>E / left-click on the current target.</summary>
        public void PressPrimary()
        {
            RefreshPrompt();
            if (target != null && CurrentPrompt.PrimaryEnabled) target.Interact(Context);
            RefreshPrompt();
        }

        /// <summary>R on the current target.</summary>
        public void PressSecondary()
        {
            RefreshPrompt();
            if (target != null && CurrentPrompt.SecondaryEnabled) target.InteractSecondary(Context);
            RefreshPrompt();
        }

        public void UpdateTarget()
        {
            IInteractable found = null;
            Component foundComponent = null;
            Collider foundCollider = null;
            Vector3 foundPoint = Vector3.zero;

            if (viewCamera != null)
            {
                var origin = viewCamera.transform.position;
                var dir = viewCamera.transform.forward;
                int mask = GameLayers.InteractionMask;

                // 1. dead centre: the first thing the thin ray touches decides
                int n = Physics.RaycastNonAlloc(new Ray(origin, dir), Hits, reach, mask, QueryTriggerInteraction.Collide);
                SortByDistance(n);
                for (int k = 0; k < n; k++)
                {
                    var h = Hits[k];
                    if (Ignore(h.collider)) continue;
                    var i = h.collider.GetComponentInParent<IInteractable>();
                    if (i != null) { found = i; foundComponent = (Component)i; foundCollider = h.collider; foundPoint = h.point; break; }
                    if (!h.collider.isTrigger) break;   // a wall or other solid thing in the way
                }

                // 2-4. otherwise the valid candidate closest to the centre of view, nearest as tie-break
                if (found == null)
                {
                    float bestAngle = float.MaxValue, bestDist = float.MaxValue;
                    n = Physics.SphereCastNonAlloc(new Ray(origin, dir), castRadius, Hits, reach, mask, QueryTriggerInteraction.Collide);
                    for (int k = 0; k < n; k++)
                    {
                        var h = Hits[k];
                        if (Ignore(h.collider)) continue;
                        var i = h.collider.GetComponentInParent<IInteractable>();
                        if (i == null) continue;
                        Vector3 p = h.distance > 0f ? h.point : h.collider.ClosestPoint(origin);
                        if (!InSight(origin, p, (Component)i)) continue;
                        float angle = Vector3.Angle(dir, p - origin);
                        float dist = Vector3.Distance(origin, p);
                        if (angle < bestAngle - 0.5f || (Mathf.Abs(angle - bestAngle) <= 0.5f && dist < bestDist))
                        {
                            bestAngle = angle; bestDist = dist;
                            found = i; foundComponent = (Component)i; foundCollider = h.collider; foundPoint = p;
                        }
                    }
                }
            }

            hitCollider = foundCollider;
            hitPoint = foundPoint;
            hasHitPoint = foundCollider != null;
            SetTarget(found, foundComponent);
            RefreshPrompt();
        }

        private bool Ignore(Collider c)
        {
            if (c == null) return true;
            if (c.transform.IsChildOf(transform)) return true;   // ourselves
            return Carry.IsCarrying && c.transform.IsChildOf(Carry.Carried.transform);
        }

        /// <summary>True if nothing solid stands between the camera and the point, other than the target itself.</summary>
        private bool InSight(Vector3 origin, Vector3 point, Component candidate)
        {
            var toPoint = point - origin;
            float d = toPoint.magnitude;
            if (d < 0.01f) return true;
            int n = Physics.RaycastNonAlloc(new Ray(origin, toPoint / d), SightHits, d - 0.02f, GameLayers.InteractionMask, QueryTriggerInteraction.Ignore);
            for (int k = 0; k < n; k++)
            {
                var c = SightHits[k].collider;
                if (Ignore(c) || c.transform.IsChildOf(candidate.transform)) continue;
                return false;
            }
            return true;
        }

        private static void SortByDistance(int n)
        {
            for (int a = 1; a < n; a++)
            {
                var h = Hits[a]; int b = a - 1;
                while (b >= 0 && Hits[b].distance > h.distance) { Hits[b + 1] = Hits[b]; b--; }
                Hits[b + 1] = h;
            }
        }

        private void SetTarget(IInteractable found, Component foundComponent)
        {
            if (ReferenceEquals(foundComponent, targetComponent)) return;
            if (targetHighlight != null) targetHighlight.SetHighlighted(false);
            target = found;
            targetComponent = foundComponent;
            targetHighlight = foundComponent != null ? foundComponent.GetComponent<InteractableHighlight>() : null;
            if (targetHighlight != null) targetHighlight.SetHighlighted(true);
        }

        /// <summary>Re-reads the prompt from the current target (it changes as stock moves).</summary>
        public void RefreshPrompt()
        {
            if (target != null && targetComponent == null) { target = null; targetHighlight = null; hitCollider = null; hasHitPoint = false; }   // destroyed
            CurrentPrompt = target != null ? target.GetPrompt(Context) : InteractionPrompt.None;
        }

        /// <summary>For tests and scripted setups: aim at something directly, skipping the raycast.</summary>
        public void ForceTarget(IInteractable interactable, Vector3? aimPoint = null)
        {
            target = interactable;
            targetComponent = interactable as Component;
            hitCollider = targetComponent != null ? targetComponent.GetComponentInChildren<Collider>() : null;
            hasHitPoint = aimPoint.HasValue;
            hitPoint = aimPoint ?? Vector3.zero;
            RefreshPrompt();
        }
    }
}
