using System;
using System.Collections.Generic;
using MiniMart.Products;
using MiniMart.Simulation.Inventory;
using UnityEngine;

namespace MiniMart.Inventory
{
    /// <summary>
    /// The yellow pad in storage where supplier boxes appear (state Delivered). For now it lays out a
    /// fixed set of sealed boxes when the scene starts; ordering and the delivery timer come with the
    /// SupplierManager (blueprint §13.3), which will call <see cref="Deliver"/>.
    /// </summary>
    public sealed class DeliveryPad : MonoBehaviour
    {
        [Serializable]
        public struct Delivery
        {
            public ProductDefinition product;
            [Min(1)] public int boxes;
        }

        [SerializeField] private List<Delivery> startingDeliveries = new List<Delivery>();
        [Tooltip("Pad size in metres (x, z).")]
        [SerializeField] private Vector2 padSize = new Vector2(4f, 4f);
        [SerializeField] private float spacing = 0.75f;

        private int placed;

        public void SetDeliveries(List<Delivery> deliveries) => startingDeliveries = deliveries;

        private void Start()
        {
            foreach (var d in startingDeliveries)
                for (int i = 0; i < d.boxes && d.product != null; i++)
                    Deliver(BoxContents.FreshFromSupplier(d.product));
        }

        /// <summary>Puts one box on the next free spot of the pad (stacking once the pad is full).</summary>
        public ProductBoxController Deliver(BoxContents contents)
        {
            int cols = Mathf.Max(1, Mathf.FloorToInt(padSize.x / spacing));
            int rows = Mathf.Max(1, Mathf.FloorToInt(padSize.y / spacing));
            int perLayer = cols * rows;
            int layer = placed / perLayer, k = placed % perLayer;
            placed++;
            var local = new Vector3(
                -padSize.x / 2f + spacing * (k % cols + 0.5f),
                ProductBoxController.DefaultSize.y * (layer + 0.5f) + 0.02f,
                -padSize.y / 2f + spacing * (k / cols + 0.5f));
            // ignore the pad's own scale (it's a flattened cube)
            return ProductBoxController.Spawn(contents, transform.position + transform.rotation * local, transform.rotation);
        }
    }
}
