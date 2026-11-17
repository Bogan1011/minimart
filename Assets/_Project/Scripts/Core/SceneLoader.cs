using UnityEngine.SceneManagement;

namespace MiniMart.Core
{
    /// <summary>Loads a scene through 04_Loading so there's always progress feedback (blueprint §19.6).</summary>
    public static class SceneLoader
    {
        public static string Pending { get; private set; }

        public static void Load(string scene)
        {
            Pending = scene;
            SceneManager.LoadScene(SceneNames.Loading);
        }

        /// <summary>Called by the loading screen once it has taken the pending scene.</summary>
        public static string TakePending()
        {
            string s = Pending;
            Pending = null;
            return string.IsNullOrEmpty(s) ? SceneNames.MainMenu : s;
        }
    }
}
