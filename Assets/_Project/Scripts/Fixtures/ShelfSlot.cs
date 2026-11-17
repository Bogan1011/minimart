using MiniMart.Products;
using UnityEngine;

namespace MiniMart.Fixtures
{
    /// <summary>
    /// A named product position on a fixture (blueprint §9.4): where units are drawn, how much room
    /// there is, and the price label under it. The stock itself lives in the fixture's FixtureStock.
    /// </summary>
    public sealed class ShelfSlot : MonoBehaviour
    {
        [SerializeField] private int index;
        [Tooltip("Local size of the slot volume (width, height, depth). The slot's origin is the centre of its floor; +Z is the front.")]
        [SerializeField] private Vector3 size = new Vector3(0.85f, 0.35f, 0.45f);
        [SerializeField] private TextMesh priceLabel;

        private Transform unitRoot;
        private GameObject[] units = new GameObject[0];
        private ProductDefinition builtFor;
        private int builtCapacity = -1;

        public int Index => index;
        public Vector3 Size => size;
        public int VisibleUnits { get; private set; }

        public void Configure(int slotIndex, Vector3 slotSize, TextMesh label)
        {
            index = slotIndex; size = slotSize; priceLabel = label;
        }

        /// <summary>Centre of the slot volume in world space, for picking the slot the player aims at.</summary>
        public Vector3 WorldCentre => transform.TransformPoint(new Vector3(0, size.y / 2f, 0));

        public void Show(ProductDefinition product, int quantity, int capacity, int price, bool expired)
        {
            if (product != builtFor || capacity != builtCapacity) Build(product, capacity);
            VisibleUnits = 0;
            for (int i = 0; i < units.Length; i++)
            {
                bool on = product != null && i < quantity;
                if (units[i] != null) units[i].SetActive(on);
                if (on) VisibleUnits++;
            }
            if (priceLabel != null)
            {
                priceLabel.text = product == null ? "" : expired ? "EXPIRED" : $"₹{price}";
                priceLabel.color = expired ? new Color(0.45f, 0.45f, 0.45f) : Color.black;
            }
        }

        /// <summary>Units fill front to back, two across when there's room, so products face outward (§7.4).</summary>
        private void Build(ProductDefinition product, int capacity)
        {
            if (unitRoot != null) Destroy(unitRoot.gameObject);
            unitRoot = new GameObject("Units").transform;
            unitRoot.SetParent(transform, false);
            units = new GameObject[capacity];
            builtFor = product;
            builtCapacity = capacity;
            if (product == null || capacity <= 0) return;

            int across = capacity >= 4 ? 2 : 1;
            int deep = Mathf.CeilToInt(capacity / (float)across);
            var cell = new Vector3(size.x / across, size.y * 0.9f, size.z / deep);
            for (int i = 0; i < capacity; i++)
            {
                int row = i / across, col = i % across;   // row 0 = front
                var pos = new Vector3(-size.x / 2f + cell.x * (col + 0.5f), 0f, size.z / 2f - cell.z * (row + 0.5f));
                units[i] = ProductView.Create(product, unitRoot, pos, cell);
                units[i].SetActive(false);
            }
        }
    }
}
