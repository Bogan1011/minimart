using UnityEngine;
using UnityEngine.SceneManagement;

namespace MiniMart.Core
{
    /// <summary>
    /// First scene in the build. Sets global defaults, then loads the main menu. Services
    /// (save, session, audio) will be created here as they arrive.
    /// </summary>
    public sealed class GameBootstrap : MonoBehaviour
    {
        [SerializeField] private string firstScene = SceneNames.MainMenu;
        [SerializeField] private int targetFrameRate = 120;

        private void Awake()
        {
            Application.targetFrameRate = targetFrameRate;
            DontDestroyOnLoad(gameObject);
            Debug.Log($"MiniMart Mayhem {Application.version} starting");
        }

        private void Start()
        {
            SceneManager.LoadScene(firstScene);
        }
    }
}
