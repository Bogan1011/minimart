using UnityEngine;

namespace MiniMart.World
{
    /// <summary>Scene object that tells ProductBox.Spawn which prefab to use.</summary>
    public sealed class ProductBoxFactory : MonoBehaviour
    {
        [SerializeField] private ProductBox prefab;

        public static ProductBoxFactory Instance { get; private set; }
        public ProductBox Prefab => prefab;

        public void SetPrefab(ProductBox boxPrefab) => prefab = boxPrefab;

        private void OnEnable() => Instance = this;
        private void OnDisable() { if (Instance == this) Instance = null; }
    }
}
