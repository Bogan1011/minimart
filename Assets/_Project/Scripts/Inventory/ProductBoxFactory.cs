using UnityEngine;

namespace MiniMart.Inventory
{
    /// <summary>Scene object that tells ProductBoxController.Spawn which box prefab to use.</summary>
    public sealed class ProductBoxFactory : MonoBehaviour
    {
        [SerializeField] private ProductBoxController prefab;

        public static ProductBoxFactory Instance { get; private set; }
        public ProductBoxController Prefab => prefab;

        public void SetPrefab(ProductBoxController boxPrefab) => prefab = boxPrefab;

        private void OnEnable() => Instance = this;
        private void OnDisable() { if (Instance == this) Instance = null; }
    }
}
