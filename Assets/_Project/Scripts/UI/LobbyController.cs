using MiniMart.Core;
using UnityEngine;

namespace MiniMart.UI
{
    /// <summary>
    /// 02_Lobby placeholder (blueprint §5.4). LAN networking arrives with the multiplayer phase: one PC
    /// runs the MiniMart server build, which also serves the web page; every player, host included,
    /// joins from a browser (see Docs/WebAndLAN.md). For now Start just loads the store solo.
    /// </summary>
    public sealed class LobbyController : MonoBehaviour
    {
        private bool ready;
        private GUIStyle big, text, button;

        private void OnGUI()
        {
            if (big == null)
            {
                big = new GUIStyle(GUI.skin.label) { fontSize = 34, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
                text = new GUIStyle(GUI.skin.label) { fontSize = 18, alignment = TextAnchor.UpperCenter, wordWrap = true };
                button = new GUIStyle(GUI.skin.button) { fontSize = 20 };
            }
            float w = 520f, x = (Screen.width - w) / 2f, y = Screen.height * 0.18f;
            GUI.Label(new Rect(0, y, Screen.width, 50), "Lobby", big);
            GUI.Label(new Rect(x, y + 60, w, 120),
                "LAN co-op is not built yet. When it is, this screen shows everyone connected to the store server on your network, who is ready, and lets the host start the day.",
                text);
            GUI.Box(new Rect(x, y + 180, w, 40), $"You (host)    {(ready ? "READY" : "not ready")}");
            if (GUI.Button(new Rect(x, y + 240, w / 2f - 5, 46), ready ? "Not ready" : "Ready", button)) ready = !ready;
            GUI.enabled = ready;
            if (GUI.Button(new Rect(x + w / 2f + 5, y + 240, w / 2f - 5, 46), "Start session", button)) SceneLoader.Load(SceneNames.StoreWorld);
            GUI.enabled = true;
            if (GUI.Button(new Rect(x, y + 300, w, 40), "Back to menu", button)) SceneLoader.Load(SceneNames.MainMenu);
        }
    }
}
