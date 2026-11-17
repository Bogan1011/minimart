using MiniMart.Core;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace MiniMart.UI
{
    /// <summary>
    /// Placeholder main menu (IMGUI) for Sprint 1. Replace with the real UI in Phase 4.
    /// </summary>
    public sealed class MainMenuController : MonoBehaviour
    {
        private GUIStyle title;
        private GUIStyle button;

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
            }

            float w = 320f, h = 52f, x = (Screen.width - w) / 2f, y = Screen.height * 0.35f;
            GUI.Label(new Rect(0, y - 120, Screen.width, 80), "MiniMart Mayhem", title);
            if (GUI.Button(new Rect(x, y, w, h), "Start shift", button)) SceneManager.LoadScene(SceneNames.Supermarket);
            if (GUI.Button(new Rect(x, y + h + 12, w, h), "Test map", button)) SceneManager.LoadScene(SceneNames.TestMap);
            if (GUI.Button(new Rect(x, y + 2 * (h + 12), w, h), "Quit", button)) Application.Quit();
            GUI.Label(new Rect(10, Screen.height - 30, 400, 24), $"Build {Application.version} · Sprint 1");
        }
    }
}
