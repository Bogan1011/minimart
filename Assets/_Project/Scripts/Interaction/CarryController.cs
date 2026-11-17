using MiniMart.Player;
using MiniMart.Simulation.Inventory;
using MiniMart.World;
using UnityEngine;

namespace MiniMart.Interaction
{
    /// <summary>
    /// Holds at most one product box (prototype rule). Picking up, dropping and consuming a box all go
    /// through here, so a box is always in exactly one place: on the floor or in one player's hands.
    /// </summary>
    public sealed class CarryController : MonoBehaviour
    {
        [Tooltip("Where a carried box sits, usually a child of the camera.")]
        [SerializeField] private Transform holdPoint;
        [Tooltip("How far in front of the player a dropped box lands (m).")]
        [SerializeField] private float dropDistance = 1.0f;
        [SerializeField] private LayerMask dropBlockers = ~0;

        private PlayerController player;

        public ProductBox Carried { get; private set; }
        public bool IsCarrying => Carried != null;
        public Transform HoldPoint => holdPoint;

        public void SetHoldPoint(Transform point) => holdPoint = point;

        private void Awake()
        {
            player = GetComponent<PlayerController>();
            if (holdPoint == null) holdPoint = transform;
        }

        /// <summary>Picks up a box lying in the world. Returns false if hands are full or the box is held.</summary>
        public bool TryPickUp(ProductBox box)
        {
            if (box == null || IsCarrying || box.IsHeld) return false;
            Carried = box;
            box.AttachTo(holdPoint, this);
            if (player != null) player.IsCarrying = true;
            return true;
        }

        /// <summary>Puts a brand-new box (e.g. stock emptied off a fixture) straight into the player's hands.</summary>
        public bool TryHoldNew(BoxContents contents)
        {
            if (IsCarrying || contents == null || contents.IsEmpty) return false;
            var box = ProductBox.Spawn(contents, holdPoint.position, holdPoint.rotation);
            return TryPickUp(box);
        }

        /// <summary>Drops the carried box in front of the player, or at their feet if that spot is blocked.</summary>
        public bool Drop()
        {
            if (!IsCarrying) return false;
            var box = Carried;
            Carried = null;
            if (player != null) player.IsCarrying = false;

            Vector3 forward = Vector3.ProjectOnPlane(transform.forward, Vector3.up).normalized;
            if (forward.sqrMagnitude < 0.01f) forward = Vector3.forward;
            Vector3 origin = transform.position + Vector3.up * 0.9f;
            Vector3 half = box.HalfExtents;
            Vector3 target = origin + forward * dropDistance;

            bool blocked = Physics.BoxCast(origin, half * 0.9f, forward, out _, transform.rotation, dropDistance, dropBlockers, QueryTriggerInteraction.Ignore);
            if (blocked) target = transform.position + Vector3.up * (half.y + 0.05f) + forward * 0.1f;

            box.Release(target, transform.rotation);
            return true;
        }

        /// <summary>Called when a box has been fully unpacked or binned. Destroys it.</summary>
        public void ConsumeCarried()
        {
            if (!IsCarrying) return;
            var box = Carried;
            Carried = null;
            if (player != null) player.IsCarrying = false;
            box.DestroyBox();
        }

        /// <summary>If the carried box is now empty, get rid of it.</summary>
        public void ConsumeIfEmpty()
        {
            if (IsCarrying && Carried.Contents.IsEmpty) ConsumeCarried();
        }

        private void OnDisable()
        {
            // a player leaving must not take the box with them
            if (IsCarrying) Drop();
        }

        public string Describe()
        {
            if (!IsCarrying) return null;
            var c = Carried.Contents;
            string exp = c.IsExpired ? " · EXPIRED" : c.DaysLeft.HasValue ? $" · {c.DaysLeft} day{(c.DaysLeft == 1 ? "" : "s")} left" : "";
            return $"{c.Product.DisplayName} × {c.Units}{exp}";
        }
    }
}
