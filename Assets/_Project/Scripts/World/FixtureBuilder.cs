using MiniMart.Data;
using MiniMart.Interaction;
using MiniMart.Simulation.Catalogue;
using UnityEngine;

namespace MiniMart.World
{
    /// <summary>Grey-box fixtures: 2 m wide like the prototype's two-tile fixtures. Front faces +Z.</summary>
    public static class FixtureBuilder
    {
        public static ShelfFixture Build(FixtureDefinition def, Vector3 position, Quaternion rotation, Transform parent = null)
        {
            var root = new GameObject(def != null ? def.DisplayName : "Fixture");
            root.SetActive(false);   // so Awake runs after Setup, not during AddComponent
            root.transform.SetParent(parent, false);
            root.transform.SetPositionAndRotation(position, rotation);
            var kind = def != null ? def.Kind : FixtureKind.Shelf;

            Vector3 size; Color frame; int levels; float spacing; Vector3 area; Vector3 areaCentre;
            switch (kind)
            {
                case FixtureKind.Fridge:
                    size = new Vector3(2f, 2.0f, 0.8f); frame = new Color(0.85f, 0.9f, 0.95f);
                    levels = 3; spacing = 0.5f; area = new Vector3(1.7f, 0.3f, 0.55f); areaCentre = new Vector3(0, 0.45f, 0.05f);
                    break;
                case FixtureKind.Freezer:
                    size = new Vector3(2f, 0.9f, 1.0f); frame = new Color(0.8f, 0.88f, 0.95f);
                    levels = 1; spacing = 0f; area = new Vector3(1.8f, 0.25f, 0.8f); areaCentre = new Vector3(0, 0.55f, 0);
                    break;
                case FixtureKind.ProduceCrate:
                    size = new Vector3(2f, 0.9f, 1.0f); frame = new Color(0.55f, 0.38f, 0.2f);
                    levels = 2; spacing = 0.12f; area = new Vector3(1.8f, 0.12f, 0.8f); areaCentre = new Vector3(0, 0.75f, 0);
                    break;
                default:
                    size = new Vector3(2f, 1.8f, 0.6f); frame = new Color(0.78f, 0.78f, 0.8f);
                    levels = 3; spacing = 0.5f; area = new Vector3(1.8f, 0.3f, 0.45f); areaCentre = new Vector3(0, 0.36f, 0.03f);
                    break;
            }

            // one solid collider for the whole fixture: the player bumps into it and the ray hits it
            var col = root.AddComponent<BoxCollider>();
            col.size = size;
            col.center = new Vector3(0, size.y / 2f, 0);

            if (kind == FixtureKind.Shelf || kind == FixtureKind.Fridge)
            {
                ProtoBuilder.Block("Back", root.transform, new Vector3(0, size.y / 2f, -size.z / 2f + 0.03f), new Vector3(size.x, size.y, 0.06f), frame);
                ProtoBuilder.Block("SideL", root.transform, new Vector3(-size.x / 2f + 0.03f, size.y / 2f, 0), new Vector3(0.06f, size.y, size.z), frame);
                ProtoBuilder.Block("SideR", root.transform, new Vector3(size.x / 2f - 0.03f, size.y / 2f, 0), new Vector3(0.06f, size.y, size.z), frame);
                ProtoBuilder.Block("Top", root.transform, new Vector3(0, size.y - 0.03f, 0), new Vector3(size.x, 0.06f, size.z), frame);
                for (int i = 0; i < levels; i++)
                    ProtoBuilder.Block($"Board{i}", root.transform, new Vector3(0, areaCentre.y - 0.02f + i * spacing, 0), new Vector3(size.x - 0.1f, 0.04f, size.z - 0.06f), frame * 0.9f);
                if (kind == FixtureKind.Fridge)
                    ProtoBuilder.Block("Glow", root.transform, new Vector3(0, size.y - 0.1f, size.z / 2f - 0.05f), new Vector3(size.x - 0.1f, 0.06f, 0.04f), new Color(0.6f, 0.85f, 1f));
            }
            else
            {
                ProtoBuilder.Block("Body", root.transform, new Vector3(0, (areaCentre.y - 0.05f) / 2f, 0), new Vector3(size.x, areaCentre.y - 0.05f, size.z), frame);
                ProtoBuilder.Block("Rim", root.transform, new Vector3(0, size.y - 0.04f, 0), new Vector3(size.x, 0.08f, size.z), frame * 0.85f);
            }

            var ticket = ProtoBuilder.Label("Ticket", root.transform, new Vector3(0, kind == FixtureKind.Shelf || kind == FixtureKind.Fridge ? 0.2f : size.y + 0.25f, size.z / 2f + 0.02f), "", 0.03f, Color.black);
            ticket.transform.localRotation = Quaternion.Euler(0, 180, 0);   // TextMesh faces -Z by default; turn it to face shoppers at +Z
            ProtoBuilder.Block("TicketBack", ticket.transform, new Vector3(0, 0, 0.005f), new Vector3(0.9f, 0.16f, 0.005f), new Color(1f, 0.97f, 0.8f));

            var view = root.AddComponent<FixtureStockView>();
            view.Configure(areaCentre, area, levels, spacing, ticket);
            root.AddComponent<InteractableHighlight>();
            var fixture = root.AddComponent<ShelfFixture>();
            fixture.Setup(def, view);
            root.SetActive(true);
            return fixture;
        }
    }
}
