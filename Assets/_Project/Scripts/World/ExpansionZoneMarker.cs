using UnityEngine;

namespace MiniMart.World
{
    /// <summary>
    /// Marks something that belongs to a later store level: a temporary wall to remove, or a zone to
    /// open. Progression (after Target A) finds these and opens them when the store expands to
    /// <see cref="Level"/>. Until then it only records intent.
    /// </summary>
    public sealed class ExpansionZoneMarker : MonoBehaviour
    {
        [SerializeField] private int level = 2;
        [SerializeField] private string levelName = "Mini Market";

        public int Level => level;
        public string LevelName => levelName;

        public void Configure(int storeLevel, string name)
        {
            level = storeLevel;
            levelName = name;
        }

        /// <summary>Opens the zone: a wall marker simply disappears.</summary>
        public void Open() => gameObject.SetActive(false);
    }
}
