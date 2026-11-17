using System.Collections.Generic;
using UnityEngine;

namespace MiniMart.Interaction
{
    /// <summary>
    /// Tints an object's renderers while it is targeted. Uses property blocks, so no material
    /// copies are made. Works with URP Lit (_BaseColor) and Built-in Standard (_Color).
    /// Placeholder until an outline shader is chosen.
    /// </summary>
    public sealed class InteractableHighlight : MonoBehaviour
    {
        private static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");

        [SerializeField] private Color tint = new Color(1f, 0.95f, 0.6f);
        [SerializeField] [Range(0f, 1f)] private float strength = 0.35f;

        private readonly Dictionary<Renderer, Color> original = new Dictionary<Renderer, Color>();
        private MaterialPropertyBlock block;
        private bool lit;

        public bool IsHighlighted => lit;

        public void SetHighlighted(bool on)
        {
            if (on == lit) return;
            lit = on;
            if (block == null) block = new MaterialPropertyBlock();

            if (on)
            {
                original.Clear();
                foreach (var r in GetComponentsInChildren<Renderer>())
                {
                    if (r.GetComponent<TextMesh>() != null) continue;
                    Color c = CurrentColor(r);
                    original[r] = c;
                    Apply(r, Color.Lerp(c, tint, strength));
                }
            }
            else
            {
                foreach (var kv in original)
                    if (kv.Key != null) Apply(kv.Key, kv.Value);
                original.Clear();
            }
        }

        private Color CurrentColor(Renderer r)
        {
            r.GetPropertyBlock(block);
            if (block.HasColor(BaseColor)) return block.GetColor(BaseColor);
            if (block.HasColor(ColorId)) return block.GetColor(ColorId);
            var mat = r.sharedMaterial;
            if (mat != null && mat.HasProperty(BaseColor)) return mat.GetColor(BaseColor);
            if (mat != null && mat.HasProperty(ColorId)) return mat.GetColor(ColorId);
            return Color.white;
        }

        private void Apply(Renderer r, Color c)
        {
            r.GetPropertyBlock(block);
            block.SetColor(BaseColor, c);
            block.SetColor(ColorId, c);
            r.SetPropertyBlock(block);
        }

        private void OnDisable() => SetHighlighted(false);
    }
}
