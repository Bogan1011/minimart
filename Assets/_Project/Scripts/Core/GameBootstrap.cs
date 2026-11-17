using UnityEngine;
using UnityEngine.SceneManagement;

namespace MiniMart.Core
{
    /// <summary>
    /// First scene in the build (00_Bootstrap). Sets global defaults, then loads the main menu. Audio,
    /// settings, save and network services will be created here as they arrive (blueprint §5.2).
    /// </summary>
    public sealed class GameBootstrap : MonoBehaviour
    {
        [SerializeField] private string firstScene = SceneNames.MainMenu;
        [Tooltip("Desktop/editor only. On the web the browser paces frames (requestAnimationFrame, normally 60 Hz).")]
        [SerializeField] private int targetFrameRate = 60;

        private void Awake()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            Application.targetFrameRate = -1;   // let the browser drive frames; a fixed rate here causes stutter
#else
            Application.targetFrameRate = targetFrameRate;
#endif
            Application.runInBackground = true; // keep simulating when the tab or window loses focus
            DontDestroyOnLoad(gameObject);
            Debug.Log($"MiniMart Mayhem {Application.version} starting on {Application.platform}");
        }

        private void Start() => SceneManager.LoadScene(firstScene);
    }
}
