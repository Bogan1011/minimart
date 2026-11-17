using System.Collections.Generic;
using MiniMart.Data;
using MiniMart.Interaction;
using MiniMart.Simulation.Inventory;
using UnityEngine;

namespace MiniMart.World
{
    /// <summary>
    /// A supplier carton in the world. Either lies on the floor (physics on) or is held by exactly one
    /// CarryController (physics off, parented to the hold point).
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public sealed class ProductBox : MonoBehaviour, IInteractable
    {
        public static readonly Vector3 DefaultSize = new Vector3(0.5f, 0.32f, 0.4f);
        private static readonly List<ProductBox> Live = new List<ProductBox>();

        [Tooltip("Only used when the box is placed in a scene by hand: it starts full of this product.")]
        [SerializeField] private ProductDefinition startProduct;
        [SerializeField] private TextMesh[] labels = new TextMesh[0];
        [SerializeField] private Renderer body;

        private Rigidbody rb;
        private Collider[] colliders;
        private CarryController holder;

        /// <summary>Every box currently in the scene (floor or carried). Used by tests and debug.</summary>
        public static IReadOnlyList<ProductBox> All => Live;

        public BoxContents Contents { get; private set; }
        public bool IsHeld => holder != null;
        public CarryController Holder => holder;
        public Vector3 HalfExtents => DefaultSize * 0.5f;

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            colliders = GetComponentsInChildren<Collider>();
            if (Contents == null && startProduct != null) Init(BoxContents.FreshFromSupplier(startProduct));
        }

        private void OnEnable() { if (!Live.Contains(this)) Live.Add(this); }
        private void OnDisable() => Live.Remove(this);

        public void Init(BoxContents contents)
        {
            Contents = contents;
            RefreshVisuals();
        }

        public void SetVisualRefs(Renderer bodyRenderer, TextMesh[] labelMeshes)
        {
            body = bodyRenderer;
            labels = labelMeshes;
        }

        public void RefreshVisuals()
        {
            if (Contents == null) return;
            var def = Contents.Product as ProductDefinition;
            Color c = def != null ? def.PrimaryColor : new Color(0.75f, 0.6f, 0.4f);
            // a cardboard carton with a product-coloured band would be the real art; tint for now
            if (body != null) ProtoBuilder.Tint(body, Color.Lerp(new Color(0.76f, 0.6f, 0.42f), c, 0.55f));
            string text = $"{Contents.Product.DisplayName}\n× {Contents.Units}" + (Contents.IsExpired ? "\nEXPIRED" : "");
            foreach (var l in labels) if (l != null) l.text = text;
        }

        // ---------------------------------------------------------------- carrying

        internal void AttachTo(Transform holdPoint, CarryController by)
        {
            holder = by;
            rb.isKinematic = true;
            rb.interpolation = RigidbodyInterpolation.None;
            foreach (var c in colliders) if (c != null) c.enabled = false;
            transform.SetParent(holdPoint, false);
            transform.localPosition = Vector3.zero;
            transform.localRotation = Quaternion.identity;
        }

        internal void Release(Vector3 position, Quaternion rotation)
        {
            holder = null;
            transform.SetParent(null, true);
            transform.SetPositionAndRotation(position, rotation);
            foreach (var c in colliders) if (c != null) c.enabled = true;
            rb.isKinematic = false;
            rb.interpolation = RigidbodyInterpolation.Interpolate;
#if UNITY_6000_0_OR_NEWER
            rb.linearVelocity = Vector3.zero;
#else
            rb.velocity = Vector3.zero;
#endif
            rb.angularVelocity = Vector3.zero;
        }

        internal void DestroyBox()
        {
            holder = null;
            Live.Remove(this);
            gameObject.SetActive(false);
            Destroy(gameObject);
        }

        // ---------------------------------------------------------------- interaction

        public InteractionPrompt GetPrompt(InteractionController who)
        {
            if (IsHeld || Contents == null) return InteractionPrompt.None;
            if (who.Carry.IsCarrying) return InteractionPrompt.Blocked("Hands full - drop your box first");
            string exp = Contents.IsExpired ? " - EXPIRED" : "";
            return InteractionPrompt.Action($"Pick up {Contents.Product.DisplayName} box ({Contents.Units}){exp}");
        }

        public void Interact(InteractionController who)
        {
            if (!IsHeld) who.Carry.TryPickUp(this);
        }

        public void InteractSecondary(InteractionController who) { }

        // ---------------------------------------------------------------- spawning

        /// <summary>Makes a box in the world. Uses the scene's ProductBoxFactory prefab if there is one.</summary>
        public static ProductBox Spawn(BoxContents contents, Vector3 position, Quaternion rotation)
        {
            var factory = ProductBoxFactory.Instance;
            ProductBox box = factory != null && factory.Prefab != null
                ? Instantiate(factory.Prefab, position, rotation)
                : BuildPrimitive(position, rotation);
            box.Init(contents);
            return box;
        }

        /// <summary>Grey-box carton built from a cube. Also used by the editor to make the prefab.</summary>
        public static ProductBox BuildPrimitive(Vector3 position, Quaternion rotation)
        {
            var go = ProtoBuilder.Primitive(PrimitiveType.Cube, "ProductBox");
            go.transform.SetPositionAndRotation(position, rotation);
            go.transform.localScale = DefaultSize;
            var body = go.GetComponent<Renderer>();

            var rigid = go.AddComponent<Rigidbody>();
            rigid.mass = 3f;
            rigid.interpolation = RigidbodyInterpolation.Interpolate;
            rigid.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;

            go.AddComponent<InteractableHighlight>();

            // labels on the long sides and the top; parent to an unscaled holder so text isn't squashed
            var labelRoot = new GameObject("Labels").transform;
            labelRoot.SetParent(go.transform, false);
            labelRoot.localScale = new Vector3(1f / DefaultSize.x, 1f / DefaultSize.y, 1f / DefaultSize.z);
            var front = ProtoBuilder.Label("LabelFront", labelRoot, new Vector3(0, 0, -DefaultSize.z / 2f - 0.002f), "", 0.012f, Color.black);
            var back = ProtoBuilder.Label("LabelBack", labelRoot, new Vector3(0, 0, DefaultSize.z / 2f + 0.002f), "", 0.012f, Color.black);
            back.transform.localRotation = Quaternion.Euler(0, 180, 0);
            var top = ProtoBuilder.Label("LabelTop", labelRoot, new Vector3(0, DefaultSize.y / 2f + 0.002f, 0), "", 0.012f, Color.black);
            top.transform.localRotation = Quaternion.Euler(90, 0, 0);

            var box = go.AddComponent<ProductBox>();
            box.SetVisualRefs(body, new[] { front, back, top });
            return box;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStatics() => Live.Clear();
    }
}
