using MiniMart.Core;
using UnityEngine;

namespace MiniMart.UI
{
    /// <summary>
    /// Placeholder main menu (01_MainMenu, IMGUI). Blueprint §5.3 wants Play, Host, Join, Settings,
    /// Credits and Exit over an animated store background; this is the functional stub.
    /// </summary>
    public sealed class MainMenuController : MonoBehaviour
    {
        private GUIStyle title, button, note;

        private void Start()
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        private void OnGUI()
        {
            if (title == null)
            {
                title = new GUIStyle(GUI.skin.label) { fontSize = 48, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
                title.normal.textColor = new Color(1f, 0.85f, 0.3f);
                button = new GUIStyle(GUI.skin.button) { fontSize = 22 };
                note = new GUIStyle(GUI.skin.label) { fontSize = 14, alignment = TextAnchor.MiddleCenter };
            }

            float w = 340f, h = 48f, gap = 10f, x = (Screen.width - w) / 2f, y = Screen.height * 0.28f;
            GUI.Label(new Rect(0, y - 110, Screen.width, 80), "MiniMart Mayhem", title);
            if (GUI.Button(new Rect(x, y, w, h), "Play (solo)", button)) SceneLoader.Load(SceneNames.StoreWorld);
            y += h + gap;
            if (GUI.Button(new Rect(x, y, w, h), "Host / Join on LAN", button)) SceneLoader.Load(SceneNames.Lobby);
            y += h + gap;
            if (GUI.Button(new Rect(x, y, w, h), "Test: physics", button)) SceneLoader.Load(SceneNames.TestPhysics);
            y += h + gap;
            if (GUI.Button(new Rect(x, y, w, h), "Test: customers", button)) SceneLoader.Load(SceneNames.TestNPC);
#if !UNITY_WEBGL || UNITY_EDITOR
            y += h + gap;
            if (GUI.Button(new Rect(x, y, w, h), "Exit", button)) Application.Quit();   // no Exit in a browser tab
#endif
            GUI.Label(new Rect(0, Screen.height - 34, Screen.width, 24), $"Build {Application.version} · {Application.platform}", note);
        }
    }
}
