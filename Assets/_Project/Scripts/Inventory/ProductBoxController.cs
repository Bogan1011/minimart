using System.Collections.Generic;
using MiniMart.Core;
using MiniMart.Handling;
using MiniMart.Interaction;
using MiniMart.Products;
using MiniMart.Simulation.Inventory;
using MiniMart.World;
using UnityEngine;

namespace MiniMart.Inventory
{
    /// <summary>
    /// A supplier carton in the world (blueprint §6.3 ProductBoxController). Physics follows §9.1:
    /// <list type="bullet">
    /// <item>Delivered / stored / settled on the ground: kinematic, collider on (State A).</item>
    /// <item>Held: kinematic, colliders off, parented to the carry anchor (State B).</item>
    /// <item>Just dropped: dynamic until it settles, then back to kinematic (State C).</item>
    /// </list>
    /// The box's contents are one data object; the units inside are never separate GameObjects.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public sealed class ProductBoxController : MonoBehaviour, IInteractable
    {
        public static readonly Vector3 DefaultSize = new Vector3(0.5f, 0.32f, 0.4f);
        private static readonly List<ProductBoxController> Live = new List<ProductBoxController>();

        [Tooltip("Only used when the box is placed in a scene by hand: it starts as a sealed delivery of this product.")]
        [SerializeField] private ProductDefinition startProduct;
        [SerializeField] private TextMesh[] labels = new TextMesh[0];
        [SerializeField] private Renderer body;
        [SerializeField] private Renderer lid;
        [Tooltip("Speed (m/s) under which a dropped box counts as settled.")]
        [SerializeField] private float settleSpeed = 0.05f;
        [SerializeField] private float settleTime = 0.4f;

        private Rigidbody rb;
        private Collider[] colliders;
        private CarryController holder;
        private StorageSlot storedIn;
        private bool settling;
        private float stillFor;
        private Vector3 lastSafePosition;

        /// <summary>Every box currently in the scene. Used by tests, debug and (later) saving.</summary>
        public static IReadOnlyList<ProductBoxController> All => Live;

        public BoxContents Contents { get; private set; }
        public bool IsHeld => holder != null;
        public bool IsSettling => settling;
        public CarryController Holder => holder;
        public StorageSlot StoredIn => storedIn;
        public Vector3 HalfExtents => DefaultSize * 0.5f;
        public bool CanBePickedUp => Contents != null && !IsHeld && BoxRules.CanMove(Contents, BoxLocation.Held);

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            colliders = GetComponentsInChildren<Collider>(true);
            GameLayers.Set(gameObject, GameLayers.ProductBox);
            if (Contents == null && startProduct != null) Init(BoxContents.FreshFromSupplier(startProduct));
        }

        private void OnEnable() { if (!Live.Contains(this)) Live.Add(this); }
        private void OnDisable() => Live.Remove(this);

        public void Init(BoxContents contents)
        {
            Contents = contents;
            lastSafePosition = transform.position;
            SetKinematicResting();
            RefreshVisuals();
        }

        public void SetVisualRefs(Renderer bodyRenderer, Renderer lidRenderer, TextMesh[] labelMeshes)
        {
            body = bodyRenderer; lid = lidRenderer; labels = labelMeshes;
        }

        public void RefreshVisuals()
        {
            if (Contents == null) return;
            var def = Contents.Product as ProductDefinition;
            Color c = def != null ? def.PrimaryColor : new Color(0.75f, 0.6f, 0.4f);
            if (body != null) ProtoBuilder.Tint(body, Color.Lerp(new Color(0.76f, 0.6f, 0.42f), c, 0.5f));
            if (lid != null) lid.gameObject.SetActive(!Contents.IsOpen);     // an open box has its lid gone
            string state = Contents.IsOpen ? (Contents.IsEmpty ? "EMPTY" : "OPEN") : "";
            string text = $"{Contents.Product.DisplayName}\n× {Contents.Units}" +
                          (Contents.IsExpired ? "\nEXPIRED" : state.Length > 0 ? "\n" + state : "");
            foreach (var l in labels) if (l != null) l.text = text;
        }

        // ---------------------------------------------------------------- physics states

        private void SetColliders(bool on) { foreach (var c in colliders) if (c != null) c.enabled = on; }

        private void SetKinematicResting()
        {
            settling = false;
            rb.isKinematic = true;
            rb.interpolation = RigidbodyInterpolation.None;
            SetColliders(true);
        }

        /// <summary>Called by CarryController. Validates the move and attaches to the carry anchor.</summary>
        internal bool TakeInto(Transform anchor, CarryController by)
        {
            if (!BoxRules.TryMove(Contents, BoxLocation.Held)) return false;
            if (storedIn != null) { storedIn.Release(this); storedIn = null; }
            AttachHeld(anchor, by);
            return true;
        }

        internal void AttachHeld(Transform anchor, CarryController by)
        {
            holder = by;
            settling = false;
            rb.isKinematic = true;
            rb.interpolation = RigidbodyInterpolation.None;
            SetColliders(false);
            transform.SetParent(anchor, false);
            transform.localPosition = Vector3.zero;
            transform.localRotation = Quaternion.identity;
        }

        internal void PlaceOnGround(Vector3 position, Quaternion rotation)
        {
            holder = null;
            BoxRules.TryMove(Contents, BoxLocation.OnGround);
            transform.SetParent(null, true);
            transform.SetPositionAndRotation(position, rotation);
            lastSafePosition = position;
            SetColliders(true);
            rb.isKinematic = false;
            rb.interpolation = RigidbodyInterpolation.Interpolate;
#if UNITY_6000_0_OR_NEWER
            rb.linearVelocity = Vector3.zero;
#else
            rb.velocity = Vector3.zero;
#endif
            rb.angularVelocity = Vector3.zero;
            settling = true;
            stillFor = 0f;
        }

        internal void PlaceInStorage(StorageSlot slot, Transform anchor)
        {
            holder = null;
            storedIn = slot;
            BoxRules.TryMove(Contents, BoxLocation.Stored);
            transform.SetParent(anchor, false);
            transform.localPosition = new Vector3(0, HalfExtents.y, 0);
            transform.localRotation = Quaternion.identity;
            lastSafePosition = transform.position;
            SetKinematicResting();
        }

        private void FixedUpdate()
        {
            if (!settling) return;
            if (transform.position.y < -5f)
            {
                // fell through the world: put it back where it was last known to be safe
                transform.position = lastSafePosition + Vector3.up * 0.2f;
#if UNITY_6000_0_OR_NEWER
                rb.linearVelocity = Vector3.zero;
#else
                rb.velocity = Vector3.zero;
#endif
                return;
            }
#if UNITY_6000_0_OR_NEWER
            float speed = rb.linearVelocity.magnitude;
#else
            float speed = rb.velocity.magnitude;
#endif
            stillFor = speed < settleSpeed && rb.angularVelocity.magnitude < 0.2f ? stillFor + Time.fixedDeltaTime : 0f;
            if (stillFor >= settleTime || rb.IsSleeping())
            {
                lastSafePosition = transform.position;
                SetKinematicResting();
            }
        }

        internal void DestroyBox()
        {
            holder = null;
            Live.Remove(this);
            gameObject.SetActive(false);
            Destroy(gameObject);
        }

        // ---------------------------------------------------------------- interaction

        public InteractionPrompt GetPrompt(in PlayerInteractionContext ctx)
        {
            if (IsHeld || Contents == null) return InteractionPrompt.None;
            if (ctx.IsCarrying) return InteractionPrompt.Blocked("Hands full - put your box down first");
            string tag = Contents.IsExpired ? " - EXPIRED" : Contents.IsOpen ? (Contents.IsEmpty ? " (empty)" : " (open)") : "";
            return InteractionPrompt.Action($"Pick up {Contents.Product.DisplayName} box ({Contents.Units}){tag}");
        }

        public void Interact(in PlayerInteractionContext ctx)
        {
            if (!ctx.IsCarrying) ctx.Carry.TryPickUp(this);
        }

        public void InteractSecondary(in PlayerInteractionContext ctx) { }

        // ---------------------------------------------------------------- spawning

        /// <summary>Makes a box in the world. Uses the scene's ProductBoxFactory prefab if there is one.</summary>
        public static ProductBoxController Spawn(BoxContents contents, Vector3 position, Quaternion rotation)
        {
            var factory = ProductBoxFactory.Instance;
            ProductBoxController box = factory != null && factory.Prefab != null
                ? Instantiate(factory.Prefab, position, rotation)
                : BuildPrimitive(position, rotation);
            box.Init(contents);
            return box;
        }

        /// <summary>Grey-box carton: a cube body, a lid that disappears when opened, printed labels.</summary>
        public static ProductBoxController BuildPrimitive(Vector3 position, Quaternion rotation)
        {
            var go = new GameObject("ProductBox");
            go.SetActive(false);
            go.transform.SetPositionAndRotation(position, rotation);

            var col = go.AddComponent<BoxCollider>();
            col.size = DefaultSize;
            var rigid = go.AddComponent<Rigidbody>();
            rigid.mass = 3f;
            rigid.isKinematic = true;
            rigid.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;

            var body = ProtoBuilder.Block("Body", go.transform, new Vector3(0, -0.01f, 0), DefaultSize - new Vector3(0, 0.02f, 0), new Color(0.76f, 0.6f, 0.42f)).GetComponent<Renderer>();
            var lid = ProtoBuilder.Block("Lid", go.transform, new Vector3(0, DefaultSize.y / 2f - 0.01f, 0), new Vector3(DefaultSize.x, 0.02f, DefaultSize.z), new Color(0.7f, 0.55f, 0.38f)).GetComponent<Renderer>();
            ProtoBuilder.Block("Tape", lid.transform, new Vector3(0, 0.6f, 0), new Vector3(0.12f, 0.3f, 1.01f), new Color(0.85f, 0.8f, 0.65f));

            var front = ProtoBuilder.Label("LabelFront", go.transform, new Vector3(0, 0, -DefaultSize.z / 2f - 0.002f), "", 0.012f, Color.black);
            var back = ProtoBuilder.Label("LabelBack", go.transform, new Vector3(0, 0, DefaultSize.z / 2f + 0.002f), "", 0.012f, Color.black);
            back.transform.localRotation = Quaternion.Euler(0, 180, 0);

            go.AddComponent<InteractableHighlight>();
            var box = go.AddComponent<ProductBoxController>();
            box.SetVisualRefs(body, lid, new[] { front, back });
            go.SetActive(true);
            return box;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStatics() => Live.Clear();
    }
}
