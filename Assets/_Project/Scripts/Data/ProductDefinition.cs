using MiniMart.Simulation.Catalogue;
using UnityEngine;

namespace MiniMart.Data
{
    /// <summary>
    /// One product in the catalogue. Created by MiniMart ▸ Import Prototype Catalogue from the
    /// prototype's game.js data; edit the asset to rebalance.
    /// </summary>
    [CreateAssetMenu(menuName = "MiniMart/Product", fileName = "Product")]
    public sealed class ProductDefinition : ScriptableObject, IProduct
    {
        [Header("Identity")]
        [Tooltip("Stable id used by saves and networking, e.g. cola-can. Don't change after release.")]
        [SerializeField] private string productId = "";
        [Tooltip("Index in the prototype's PRODUCTS array (for cross-checking only).")]
        [SerializeField] private int prototypeIndex = -1;
        [SerializeField] private string displayName = "";
        [SerializeField] private string brand = "";
        [SerializeField] private string packSize = "";
        [SerializeField] private string description = "";

        [Header("Storage")]
        [SerializeField] private ProductKind kind = ProductKind.Dry;
        [Min(1)] [SerializeField] private int unitsPerBox = 10;
        [Tooltip("Business days before it expires. 0 = never expires.")]
        [Min(0)] [SerializeField] private int shelfLifeDays;

        [Header("Economy (₹ per unit)")]
        [Min(1)] [SerializeField] private int supplierCost = 1;
        [Tooltip("MRP: what shoppers expect to pay.")]
        [Min(1)] [SerializeField] private int basePrice = 1;
        [Tooltip("Key of the licence that unlocks this product, e.g. essentials.")]
        [SerializeField] private string licenceKey = "";

        [Header("Look")]
        [SerializeField] private Color primaryColor = Color.white;
        [SerializeField] private Color secondaryColor = Color.white;
        [Tooltip("Packaging shape from the prototype (can, bottle, jar, ...). Art reference only.")]
        [SerializeField] private string packShape = "";
        [SerializeField] private Sprite icon;
        [SerializeField] private GameObject unitPrefab;

        public string ProductId => productId;
        public int PrototypeIndex => prototypeIndex;
        public string DisplayName => displayName;
        public string Brand => brand;
        public string PackSize => packSize;
        public string Description => description;
        public ProductKind Kind => kind;
        public int UnitsPerBox => unitsPerBox;
        public int ShelfLifeDays => shelfLifeDays;
        public int SupplierCost => supplierCost;
        public int BasePrice => basePrice;
        public string LicenceKey => licenceKey;
        public Color PrimaryColor => primaryColor;
        public Color SecondaryColor => secondaryColor;
        public string PackShape => packShape;
        public Sprite Icon => icon;
        public GameObject UnitPrefab => unitPrefab;

#if UNITY_EDITOR
        /// <summary>Editor-only setter used by the catalogue importer and tests.</summary>
        public void EditorSet(string id, int index, string name, string brandName, string size, string desc,
            ProductKind productKind, int perBox, int lifeDays, int cost, int price, string licence,
            Color primary, Color secondary, string shape)
        {
            productId = id; prototypeIndex = index; displayName = name; brand = brandName; packSize = size;
            description = desc; kind = productKind; unitsPerBox = perBox; shelfLifeDays = lifeDays;
            supplierCost = cost; basePrice = price; licenceKey = licence;
            primaryColor = primary; secondaryColor = secondary; packShape = shape;
        }
#endif

        /// <summary>Runtime construction for PlayMode tests and procedural setups.</summary>
        public static ProductDefinition CreateRuntime(string id, string name, ProductKind productKind,
            int perBox, int cost, int price, int lifeDays = 0, Color? color = null)
        {
            var p = CreateInstance<ProductDefinition>();
            p.name = id;
            p.productId = id; p.displayName = name; p.kind = productKind; p.unitsPerBox = perBox;
            p.supplierCost = cost; p.basePrice = price; p.shelfLifeDays = lifeDays;
            p.primaryColor = color ?? Color.white; p.secondaryColor = Color.white;
            return p;
        }

        public override string ToString() => displayName;
    }
}
