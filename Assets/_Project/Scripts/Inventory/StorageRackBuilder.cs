using MiniMart.Core;
using MiniMart.Interaction;
using MiniMart.World;
using UnityEngine;

namespace MiniMart.Inventory
{
    /// <summary>
    /// Builds a grey-box storage rack: an open-fronted frame (front faces local +Z, like fixtures) with
    /// one <see cref="StorageSlot"/> per box position. Each slot is a trigger the size of a box so it can
    /// be aimed at; a stored box sits on its board and is itself solid.
    /// </summary>
    public static class StorageRackBuilder
    {
        public const float Width = 1.9f, Depth = 0.6f, Height = 1.9f;
        private static readonly Color Frame = new Color(0.25f, 0.4f, 0.65f);
        private static readonly Color Board = new Color(0.72f, 0.6f, 0.45f);

        public static GameObject Build(Vector3 position, Quaternion rotation, Transform parent = null, int levels = 2, int columns = 3)
        {
            var root = new GameObject("StorageRack");
            root.transform.SetParent(parent, false);
            root.transform.SetPositionAndRotation(position, rotation);
            var t = root.transform;

            // frame: uprights and back rail are solid so boxes and players can't pass through
            foreach (float x in new[] { -Width / 2f, Width / 2f })
                foreach (float z in new[] { -Depth / 2f, Depth / 2f })
                    ProtoBuilder.Block("Upright", t, new Vector3(x, Height / 2f, z), new Vector3(0.05f, Height, 0.05f), Frame, solid: true);
            ProtoBuilder.Block("BackRail", t, new Vector3(0, Height - 0.05f, -Depth / 2f), new Vector3(Width, 0.08f, 0.05f), Frame, solid: true);

            float gap = (Height - 0.15f) / levels;
            float colWidth = (Width - 0.1f) / columns;
            int index = 0;
            for (int level = 0; level < levels; level++)
            {
                float y = 0.1f + level * gap;
                ProtoBuilder.Block($"Board{level}", t, new Vector3(0, y - 0.02f, 0), new Vector3(Width, 0.04f, Depth), Board, solid: true);
                for (int c = 0; c < columns; c++)
                {
                    float x = -Width / 2f + 0.05f + colWidth * (c + 0.5f);
                    var slotGo = new GameObject($"StorageSlot{index++}");
                    slotGo.transform.SetParent(t, false);
                    slotGo.transform.localPosition = new Vector3(x, y, 0);
                    var trigger = slotGo.AddComponent<BoxCollider>();
                    trigger.isTrigger = true;
                    trigger.size = new Vector3(colWidth - 0.04f, 0.42f, Depth - 0.05f);
                    trigger.center = new Vector3(0, 0.21f, 0);
                    var slot = slotGo.AddComponent<StorageSlot>();
                    slot.SetAnchor(slotGo.transform);
                    slotGo.AddComponent<InteractableHighlight>();
                }
            }

            var sign = ProtoBuilder.Label("RackLabel", t, new Vector3(0, Height + 0.12f, 0), "STORAGE RACK", 0.04f, Color.black);
            sign.transform.localRotation = Quaternion.Euler(0, 180, 0);
            GameLayers.Set(root, GameLayers.Fixture);
            return root;
        }
    }
}
