using MiniMart.Core;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace MiniMart.UI
{
    /// <summary>04_Loading: loads the pending scene asynchronously behind a progress bar.</summary>
    public sealed class LoadingScreen : MonoBehaviour
    {
        private AsyncOperation op;
        private string target;

        private void Start()
        {
            target = SceneLoader.TakePending();
            op = SceneManager.LoadSceneAsync(target);
        }

        private void OnGUI()
        {
            float p = op != null ? Mathf.Clamp01(op.progress / 0.9f) : 0f;
            float w = Mathf.Min(600f, Screen.width - 40f), x = (Screen.width - w) / 2f, y = Screen.height / 2f;
            GUI.Label(new Rect(x, y - 40, w, 30), $"Loading {target}…");
            GUI.Box(new Rect(x, y, w, 24), "");
            GUI.Box(new Rect(x + 2, y + 2, (w - 4) * p, 20), "");
        }
    }
}
