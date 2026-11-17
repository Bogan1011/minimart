using MiniMart.Core;
using MiniMart.Interaction;
using MiniMart.Player;
using UnityEngine;

namespace MiniMart.UI
{
    /// <summary>
    /// Sprint 1 HUD drawn with IMGUI: crosshair, interaction prompt, what you're carrying, toasts and
    /// a controls card. Deliberately throwaway; the real HUD (UI Toolkit) arrives with Phase 4 UI.
    /// It only reads game state, it never changes it.
    /// </summary>
    public sealed class HudOverlay : MonoBehaviour
    {
        [SerializeField] private float toastSeconds = 4f;

        private InteractionController interaction;
        private PlayerInputReader input;
        private GUIStyle prompt, promptOff, small, toast, big;

        private void Awake()
        {
            interaction = GetComponent<InteractionController>();
            input = GetComponent<PlayerInputReader>();
        }

        private void Styles()
        {
            if (prompt != null) return;
            prompt = new GUIStyle(GUI.skin.label) { fontSize = 20, alignment = TextAnchor.MiddleCenter, richText = true };
            prompt.normal.textColor = Color.white;
            promptOff = new GUIStyle(prompt);
            promptOff.normal.textColor = new Color(1f, 0.6f, 0.5f);
            small = new GUIStyle(GUI.skin.label) { fontSize = 14, richText = true };
            small.normal.textColor = Color.white;
            toast = new GUIStyle(GUI.skin.box) { fontSize = 15, alignment = TextAnchor.MiddleLeft, wordWrap = true };
            big = new GUIStyle(GUI.skin.label) { fontSize = 28, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            big.normal.textColor = Color.white;
        }

        private void OnGUI()
        {
            if (interaction == null) return;
            Styles();
            float w = Screen.width, h = Screen.height;

            // crosshair
            GUI.Label(new Rect(w / 2f - 6, h / 2f - 12, 12, 24), "+", prompt);

            // prompt under the crosshair
            var p = interaction.CurrentPrompt;
            float y = h / 2f + 40;
            if (!string.IsNullOrEmpty(p.Primary))
            {
                string text = p.PrimaryEnabled ? $"<b>[E]</b> {p.Primary}" : p.Primary;
                Shadowed(new Rect(0, y, w, 28), text, p.PrimaryEnabled ? prompt : promptOff);
                y += 28;
            }
            if (!string.IsNullOrEmpty(p.Secondary) && p.SecondaryEnabled)
                Shadowed(new Rect(0, y, w, 28), $"<b>[R]</b> {p.Secondary}", prompt);

            // carried box
            string carried = interaction.Carry.Describe();
            Shadowed(new Rect(20, h - 70, 600, 26), carried != null ? $"Carrying: <b>{carried}</b>   <b>[Q]</b> drop" : "Hands free", small);
            Shadowed(new Rect(20, h - 44, 600, 26), $"Stocked this session: {SessionStats.UnitsStocked}   Waste: ₹{SessionStats.WasteValue}", small);

            // toasts, newest at the bottom
            var msgs = GameMessages.RecentMessages;
            float ty = 20;
            for (int i = 0; i < msgs.Count; i++)
            {
                var m = msgs[i];
                if (Time.unscaledTime - m.Time > toastSeconds) continue;
                GUI.Box(new Rect(w - 420, ty, 400, 30), m.Text, toast);
                ty += 34;
            }

            // controls
            Shadowed(new Rect(20, 16, 420, 120),
                "WASD move · Shift sprint · Mouse look\nE / left-click use · Q / right-click drop\nR empty a fixture · Esc free the mouse", small);

            if (input != null && !input.HasFocus)
            {
                GUI.color = new Color(0, 0, 0, 0.45f);
                GUI.DrawTexture(new Rect(0, 0, w, h), Texture2D.whiteTexture);
                GUI.color = Color.white;
                GUI.Label(new Rect(0, h / 2f - 30, w, 60), "Click to play", big);
            }
        }

        private static void Shadowed(Rect r, string text, GUIStyle style)
        {
            var c = style.normal.textColor;
            style.normal.textColor = new Color(0, 0, 0, 0.8f);
            GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), text, style);
            style.normal.textColor = c;
            GUI.Label(r, text, style);
        }

    }
}
