using UnityEngine;

namespace MiniMart.World
{
    /// <summary>
    /// Builds grey-box geometry from primitives. Used by the editor scene builder and PlayMode tests,
    /// so both make exactly the same objects. Replace with authored prefabs in Phase 5.
    /// </summary>
    public static class ProtoBuilder
    {
        private static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static MaterialPropertyBlock block;
        private static Font font;
        private static Material shared;

        /// <summary>
        /// The one material every grey-box part uses (colour comes from property blocks). The editor
        /// scene builder sets this to a saved asset; at runtime one is made on first use.
        /// </summary>
        public static Material SharedMaterial
        {
            get
            {
                if (shared == null)
                {
                    var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                    shared = new Material(shader) { name = "ProtoLit (runtime)" };
                }
                return shared;
            }
            set => shared = value;
        }

        /// <summary>
        /// When set (by the editor scene builder), Block() gives each colour its own saved material
        /// instead of a property block, because property blocks are not saved into scenes or prefabs.
        /// </summary>
        public static System.Func<Color, Material> MaterialForColor { get; set; }

        public static GameObject Primitive(PrimitiveType type, string name)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.GetComponent<Renderer>().sharedMaterial = SharedMaterial;
            return go;
        }

        /// <summary>A coloured cube. Collider kept only when <paramref name="solid"/> is true.</summary>
        public static GameObject Block(string name, Transform parent, Vector3 localPos, Vector3 size, Color color, bool solid = false)
        {
            var go = Primitive(PrimitiveType.Cube, name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = size;
            if (!solid) DestroyCollider(go);
            var r = go.GetComponent<Renderer>();
            var mat = MaterialForColor?.Invoke(color);
            if (mat != null) r.sharedMaterial = mat;
            else Tint(r, color);
            return go;
        }

        public static void Tint(Renderer r, Color color)
        {
            if (r == null) return;
            if (block == null) block = new MaterialPropertyBlock();
            r.GetPropertyBlock(block);
            block.SetColor(BaseColor, color);
            block.SetColor(ColorId, color);
            r.SetPropertyBlock(block);
        }

        public static TextMesh Label(string name, Transform parent, Vector3 localPos, string text, float charSize = 0.05f, Color? color = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            var tm = go.AddComponent<TextMesh>();
            if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            tm.font = font;
            go.GetComponent<MeshRenderer>().sharedMaterial = font.material;
            tm.text = text;
            tm.fontSize = 64;
            tm.characterSize = charSize;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.alignment = TextAlignment.Center;
            tm.color = color ?? Color.white;
            return tm;
        }

        public static void DestroyCollider(GameObject go)
        {
            var c = go.GetComponent<Collider>();
            if (c != null) Object.DestroyImmediate(c);   // immediate: a just-built part must not be hit by a raycast this frame
        }

        public static Color Hex(string hex, Color fallback)
        {
            if (!string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex, out var c)) return c;
            return fallback;
        }
    }
}
