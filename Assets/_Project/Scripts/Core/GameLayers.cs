using UnityEngine;

namespace MiniMart.Core
{
    /// <summary>
    /// Collision layers from blueprint §9.3. MiniMart ▸ Set Up Project adds them to Tags and Layers.
    /// If a layer is missing (setup not run yet) objects fall back to Default so nothing breaks.
    /// </summary>
    public static class GameLayers
    {
        public const string World = "World";
        public const string Player = "Player";
        public const string PlayerInteraction = "PlayerInteraction";
        public const string NPC = "NPC";
        public const string Product = "Product";
        public const string ProductBox = "ProductBox";
        public const string Fixture = "Fixture";
        public const string Checkout = "Checkout";
        public const string Trolley = "Trolley";
        public const string Trigger = "Trigger";
        public const string Decoration = "Decoration";

        /// <summary>In the order they are added to Tags and Layers (user layers 8 onward). "UI" is Unity's built-in layer 5.</summary>
        public static readonly string[] All =
            { World, Player, PlayerInteraction, NPC, Product, ProductBox, Fixture, Checkout, Trolley, Trigger, Decoration };

        /// <summary>Pairs that never collide (blueprint §9.3 examples).</summary>
        public static readonly string[,] IgnoredPairs =
        {
            { Decoration, Product },
            { Decoration, ProductBox },
            { Decoration, Decoration },
            { Product, Product },          // shelf products are slot-placed, never physically stacked
            { Trigger, NPC },
            { PlayerInteraction, World },  // interaction probes are query-only
            { PlayerInteraction, Player },
        };

        public static int Get(string name)
        {
            int l = LayerMask.NameToLayer(name);
            return l < 0 ? 0 : l;
        }

        public static bool Exists(string name) => LayerMask.NameToLayer(name) >= 0;

        public static void Set(GameObject go, string layer, bool recursive = true)
        {
            int l = Get(layer);
            go.layer = l;
            if (!recursive) return;
            foreach (Transform t in go.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = l;
        }

        /// <summary>What the interaction ray can hit: everything except the player, decoration and pure triggers.</summary>
        public static int InteractionMask
        {
            get
            {
                int mask = ~0;
                foreach (var n in new[] { Player, PlayerInteraction, Decoration, Trigger })
                    if (Exists(n)) mask &= ~(1 << Get(n));
                return mask;
            }
        }

        /// <summary>What blocks a dropped box: walls, fixtures, other boxes, checkouts, NPCs, trolleys.</summary>
        public static int DropBlockerMask
        {
            get
            {
                int mask = 0;
                foreach (var n in new[] { World, Fixture, ProductBox, Checkout, NPC, Trolley })
                    if (Exists(n)) mask |= 1 << Get(n);
                return mask == 0 ? ~0 : mask | 1;   // include Default so untagged geometry still blocks
            }
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        public static void ApplyCollisionMatrix()
        {
            for (int i = 0; i < IgnoredPairs.GetLength(0); i++)
            {
                string a = IgnoredPairs[i, 0], b = IgnoredPairs[i, 1];
                if (Exists(a) && Exists(b)) Physics.IgnoreLayerCollision(Get(a), Get(b), true);
            }
        }
    }
}
