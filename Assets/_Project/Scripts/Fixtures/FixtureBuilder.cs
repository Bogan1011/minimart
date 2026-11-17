using MiniMart.Core;
using MiniMart.Interaction;
using MiniMart.Simulation.Catalogue;
using MiniMart.World;
using UnityEngine;

namespace MiniMart.Fixtures
{
    /// <summary>
    /// Grey-box fixtures, 2 m wide like the prototype's two-tile fixtures, front facing +Z.
    /// Each gets one solid collider (players bump into it, the interaction ray hits it) and a set of
    /// ShelfSlot anchors laid out from its FixtureDefinition. Sizes follow blueprint §7.2.
    /// </summary>
    public static class FixtureBuilder
    {
        public static ShelfFixture Build(FixtureDefinition def, Vector3 position, Quaternion rotation, Transform parent = null)
        {
            if (def == null) def = FixtureDefinition.CreateRuntime(FixtureKind.Shelf);
            var root = new GameObject(def.DisplayName);
            root.SetActive(false);   // so Awake runs after Setup, not during AddComponent
            root.transform.SetParent(parent, false);
            root.transform.SetPositionAndRotation(position, rotation);
            var kind = def.Kind;

            Vector3 size; Color frame; float firstLevelY, levelGap; bool upright;
            switch (kind)
            {
                case FixtureKind.Fridge:
                    size = new Vector3(2f, 2.0f, 0.8f); frame = new Color(0.85f, 0.9f, 0.95f); firstLevelY = 0.35f; levelGap = 0.5f; upright = true; break;
                case FixtureKind.Freezer:
                    size = new Vector3(2f, 0.9f, 1.0f); frame = new Color(0.8f, 0.88f, 0.95f); firstLevelY = 0.45f; levelGap = 0f; upright = false; break;
                case FixtureKind.ProduceCrate:
                    size = new Vector3(2f, 0.9f, 1.0f); frame = new Color(0.55f, 0.38f, 0.2f); firstLevelY = 0.62f; levelGap = 0f; upright = false; break;
                default:
                    size = new Vector3(2f, 1.9f, 0.6f); frame = new Color(0.78f, 0.78f, 0.8f); firstLevelY = 0.3f; levelGap = 0.5f; upright = true; break;
            }

            var col = root.AddComponent<BoxCollider>();
            col.size = size;
            col.center = new Vector3(0, size.y / 2f, 0);

            float innerW = size.x - 0.12f;
            if (upright)
            {
                ProtoBuilder.Block("Back", root.transform, new Vector3(0, size.y / 2f, -size.z / 2f + 0.03f), new Vector3(size.x, size.y, 0.06f), frame);
                ProtoBuilder.Block("SideL", root.transform, new Vector3(-size.x / 2f + 0.03f, size.y / 2f, 0), new Vector3(0.06f, size.y, size.z), frame);
                ProtoBuilder.Block("SideR", root.transform, new Vector3(size.x / 2f - 0.03f, size.y / 2f, 0), new Vector3(0.06f, size.y, size.z), frame);
                ProtoBuilder.Block("Top", root.transform, new Vector3(0, size.y - 0.03f, 0), new Vector3(size.x, 0.06f, size.z), frame);
                for (int l = 0; l < def.Levels; l++)
                {
                    float y = firstLevelY + l * levelGap;
                    ProtoBuilder.Block($"Board{l}", root.transform, new Vector3(0, y - 0.02f, 0), new Vector3(innerW, 0.04f, size.z - 0.06f), frame * 0.9f);
                    ProtoBuilder.Block($"PriceRail{l}", root.transform, new Vector3(0, y - 0.05f, size.z / 2f - 0.01f), new Vector3(innerW, 0.06f, 0.02f), new Color(0.95f, 0.95f, 0.92f));
                }
                if (kind == FixtureKind.Fridge)
                    ProtoBuilder.Block("Glow", root.transform, new Vector3(0, size.y - 0.1f, size.z / 2f - 0.05f), new Vector3(innerW, 0.06f, 0.04f), new Color(0.6f, 0.85f, 1f));
            }
            else
            {
                ProtoBuilder.Block("Body", root.transform, new Vector3(0, (firstLevelY - 0.02f) / 2f, 0), new Vector3(size.x, firstLevelY - 0.02f, size.z), frame);
                ProtoBuilder.Block("RimF", root.transform, new Vector3(0, size.y - 0.1f, size.z / 2f - 0.03f), new Vector3(size.x, size.y - firstLevelY + 0.2f, 0.06f) , frame * 0.85f);
                ProtoBuilder.Block("RimB", root.transform, new Vector3(0, size.y - 0.1f, -size.z / 2f + 0.03f), new Vector3(size.x, size.y - firstLevelY + 0.2f, 0.06f), frame * 0.85f);
            }

            // slots
            var slotRoot = new GameObject("Slots").transform;
            slotRoot.SetParent(root.transform, false);
            int perLevel = def.SlotsPerLevel, levels = def.Levels;
            float slotW = innerW / perLevel;
            var slots = new ShelfSlot[def.SlotCount];
            for (int l = 0; l < levels; l++)
            {
                for (int c = 0; c < perLevel; c++)
                {
                    int i = l * perLevel + c;
                    Vector3 local; Vector3 slotSize;
                    if (upright)
                    {
                        local = new Vector3(-innerW / 2f + slotW * (c + 0.5f), firstLevelY + l * levelGap, 0.02f);
                        slotSize = new Vector3(slotW * 0.94f, levelGap > 0 ? levelGap * 0.75f : 0.3f, size.z - 0.12f);
                    }
                    else
                    {
                        // flat fixtures: levels become rows from front to back
                        float rowD = (size.z - 0.14f) / levels;
                        local = new Vector3(-innerW / 2f + slotW * (c + 0.5f), firstLevelY, (size.z - 0.14f) / 2f - rowD * (l + 0.5f));
                        slotSize = new Vector3(slotW * 0.92f, 0.16f, rowD * 0.9f);
                    }
                    var anchor = new GameObject($"Slot{i}");
                    anchor.transform.SetParent(slotRoot, false);
                    anchor.transform.localPosition = local;
                    var label = ProtoBuilder.Label("Price", anchor.transform,
                        upright ? new Vector3(0, -0.05f, size.z / 2f - 0.005f) : new Vector3(0, size.y - firstLevelY - 0.12f - 0.1f * l, size.z / 2f - local.z + 0.005f),
                        "", 0.018f, Color.black);
                    label.transform.localRotation = Quaternion.Euler(0, 180, 0);   // TextMesh reads from -Z; turn to face +Z
                    var slot = anchor.AddComponent<ShelfSlot>();
                    slot.Configure(i, slotSize, label);
                    slots[i] = slot;
                }
            }

            root.AddComponent<InteractableHighlight>();
            var fixture = root.AddComponent<ShelfFixture>();
            fixture.Setup(def, slots);
            GameLayers.Set(root, GameLayers.Fixture);
            root.SetActive(true);
            return fixture;
        }
    }
}
