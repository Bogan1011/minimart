using MiniMart.Core;
using MiniMart.Interaction;
using UnityEngine;

namespace MiniMart.Inventory
{
    /// <summary>
    /// One box position on a storage rack (blueprint §5.5 H, §3.1 "one storage position"). A stored box
    /// is kinematic and snapped to the slot; aim at the box itself to take it back.
    /// </summary>
    public sealed class StorageSlot : MonoBehaviour, IInteractable
    {
        [SerializeField] private Transform anchor;

        public ProductBoxController Occupant { get; private set; }
        public bool IsOccupied => Occupant != null;

        public void SetAnchor(Transform t) => anchor = t;

        private void Awake()
        {
            if (anchor == null) anchor = transform;
            GameLayers.Set(gameObject, GameLayers.Fixture, recursive: false);
        }

        internal void Accept(ProductBoxController box)
        {
            Occupant = box;
            box.PlaceInStorage(this, anchor);
        }

        internal void Release(ProductBoxController box)
        {
            if (Occupant == box) Occupant = null;
        }

        public InteractionPrompt GetPrompt(in PlayerInteractionContext ctx)
        {
            if (!ctx.IsCarrying) return IsOccupied ? InteractionPrompt.None : InteractionPrompt.Info("Storage space");
            if (IsOccupied) return InteractionPrompt.Blocked("This space is taken");
            return InteractionPrompt.Action($"Store {ctx.Carry.Carried.Contents.Product.DisplayName} box");
        }

        public void Interact(in PlayerInteractionContext ctx)
        {
            if (ctx.IsCarrying && !IsOccupied) ctx.Carry.Store(this);
        }

        public void InteractSecondary(in PlayerInteractionContext ctx) { }
    }
}
