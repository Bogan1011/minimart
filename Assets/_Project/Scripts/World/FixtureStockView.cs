using MiniMart.Data;
using UnityEngine;

namespace MiniMart.World
{
    /// <summary>
    /// Shows a fixture's stock as rows of small product blocks plus a price/quantity ticket, so
    /// players can see the count change. Placeholder for instanced product models.
    /// </summary>
    public sealed class FixtureStockView : MonoBehaviour
    {
        [Tooltip("Local-space area units are laid out in: centre and size (x = width, y = height of one level, z = depth).")]
        [SerializeField] private Vector3 areaCentre = new Vector3(0f, 0.55f, 0f);
        [SerializeField] private Vector3 areaSize = new Vector3(1.8f, 0.3f, 0.45f);
        [SerializeField] private int levels = 3;
        [SerializeField] private float levelSpacing = 0.45f;
        [SerializeField] private TextMesh ticket;

        private Transform unitRoot;
        private Renderer[] units = new Renderer[0];
        private int builtFor = -1;

        public void Configure(Vector3 centre, Vector3 size, int levelCount, float spacing, TextMesh ticketLabel)
        {
            areaCentre = centre; areaSize = size; levels = Mathf.Max(1, levelCount); levelSpacing = spacing; ticket = ticketLabel;
        }

        public int VisibleUnits { get; private set; }

        public void Show(ProductDefinition product, int quantity, int capacity, string ticketText)
        {
            if (builtFor != capacity) Build(capacity);
            Color c = product != null ? product.PrimaryColor : Color.white;
            VisibleUnits = 0;
            for (int i = 0; i < units.Length; i++)
            {
                bool on = product != null && i < quantity;
                units[i].gameObject.SetActive(on);
                if (on) { ProtoBuilder.Tint(units[i], c); VisibleUnits++; }
            }
            if (ticket != null) ticket.text = ticketText;
        }

        private void Build(int capacity)
        {
            if (unitRoot != null) Destroy(unitRoot.gameObject);
            unitRoot = new GameObject("Units").transform;
            unitRoot.SetParent(transform, false);

            int perLevel = Mathf.CeilToInt(capacity / (float)levels);
            int cols = Mathf.Max(1, Mathf.CeilToInt(perLevel / 2f));   // two deep
            int rows = perLevel > 1 ? 2 : 1;
            float cw = areaSize.x / cols, cd = areaSize.z / rows;
            var unitSize = new Vector3(cw * 0.8f, areaSize.y * 0.8f, cd * 0.8f);

            units = new Renderer[capacity];
            for (int i = 0; i < capacity; i++)
            {
                int level = i / perLevel, k = i % perLevel;
                int col = k % cols, row = k / cols;
                var pos = areaCentre + new Vector3(
                    -areaSize.x / 2f + cw * (col + 0.5f),
                    level * levelSpacing + unitSize.y / 2f,
                    -areaSize.z / 2f + cd * (row + 0.5f));
                units[i] = ProtoBuilder.Block($"Unit{i}", unitRoot, pos, unitSize, Color.white).GetComponent<Renderer>();
            }
            builtFor = capacity;
        }
    }
}
