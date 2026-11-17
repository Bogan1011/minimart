using MiniMart.Core;
using MiniMart.Inventory;
using MiniMart.Player;
using MiniMart.Simulation.Inventory;
using UnityEngine;

namespace MiniMart.Handling
{
    /// <summary>
    /// Holds at most one box (blueprint §8.4). Pick up, drop, open, store and bin all go through here,
    /// so a box is always in exactly one place: delivered, on the ground, held by one player, stored or binned.
    /// </summary>
    public sealed class CarryController : MonoBehaviour
    {
        [Tooltip("Where a carried box sits, usually a child of the camera.")]
        [SerializeField] private Transform holdPoint;

        private PlayerController player;

        public ProductBoxController Carried { get; private set; }
        public bool IsCarrying => Carried != null;
        public Transform HoldPoint => holdPoint;

        public void SetHoldPoint(Transform point) => holdPoint = point;

        private void Awake()
        {
            player = GetComponent<PlayerController>();
            if (holdPoint == null) holdPoint = transform;
        }

        /// <summary>Picks up a box from the pad, the floor or a storage slot.</summary>
        public bool TryPickUp(ProductBoxController box)
        {
            if (box == null || IsCarrying || !box.CanBePickedUp) return false;
            if (!box.TakeInto(holdPoint, this)) return false;
            Carried = box;
            if (player != null) player.IsCarrying = true;
            return true;
        }

        /// <summary>Puts a brand-new box (stock taken off a fixture slot) straight into the player's hands.</summary>
        public bool TryHoldNew(BoxContents contents)
        {
            if (IsCarrying || contents == null || contents.Location != BoxLocation.Held) return false;   // EmptySlot hands it over Held
            var box = ProductBoxController.Spawn(contents, holdPoint.position, holdPoint.rotation);
            box.AttachHeld(holdPoint, this);
            Carried = box;
            if (player != null) player.IsCarrying = true;
            return true;
        }

        /// <summary>Opens the carried box (F). Contents become accessible for stocking.</summary>
        public bool OpenCarried()
        {
            if (!IsCarrying) return false;
            if (!BoxRules.TryOpen(Carried.Contents)) return false;
            Carried.RefreshVisuals();
            return true;
        }

        /// <summary>Drops the carried box at a safe spot in front of the player. False if there's no room.</summary>
        public bool Drop()
        {
            if (!IsCarrying) return false;
            if (!DropPlacement.TryFind(transform, Carried.HalfExtents, Carried.transform, out var pos, out var rot))
            {
                GameMessages.Post("No room to put the box down here", MessageKind.Bad);
                return false;
            }
            var box = Release();
            box.PlaceOnGround(pos, rot);
            return true;
        }

        /// <summary>Hands the carried box to a storage slot.</summary>
        public bool Store(StorageSlot slot)
        {
            if (!IsCarrying || slot == null || slot.IsOccupied) return false;
            if (!BoxRules.CanMove(Carried.Contents, BoxLocation.Stored)) return false;
            var box = Release();
            slot.Accept(box);
            return true;
        }

        /// <summary>Bins the carried box. Returns the waste value of anything still inside.</summary>
        public int Discard()
        {
            if (!IsCarrying) return 0;
            var box = Release();
            int waste = BoxRules.Discard(box.Contents);
            box.DestroyBox();
            return waste;
        }

        private ProductBoxController Release()
        {
            var box = Carried;
            Carried = null;
            if (player != null) player.IsCarrying = false;
            return box;
        }

        /// <summary>
        /// A player leaving must not take the box with them (blueprint §21.2). Call this before the
        /// player object is disabled or despawned: Unity won't let a child be re-parented while its
        /// parent is being deactivated, so this can't happen from OnDisable.
        /// </summary>
        public void DropBeforeLeaving()
        {
            if (!IsCarrying) return;
            var box = Release();
            if (DropPlacement.TryFind(transform, box.HalfExtents, box.transform, out var pos, out var rot))
                box.PlaceOnGround(pos, rot);
            else
                box.PlaceOnGround(transform.position + Vector3.up * (box.HalfExtents.y + 0.05f), transform.rotation);
        }

        public string Describe()
        {
            if (!IsCarrying) return null;
            var c = Carried.Contents;
            string state = c.IsOpen ? (c.IsEmpty ? " · empty box" : " · open") : " · sealed";
            string exp = c.IsExpired ? " · EXPIRED" : c.DaysLeft.HasValue ? $" · {c.DaysLeft} day{(c.DaysLeft == 1 ? "" : "s")} left" : "";
            return $"{c.Product.DisplayName} × {c.Units}{state}{exp}";
        }
    }
}
