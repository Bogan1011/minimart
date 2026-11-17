using MiniMart.Simulation.Catalogue;
using UnityEngine;

namespace MiniMart.Products
{
    public enum PackageMass { Light, Medium, Heavy }

    /// <summary>
    /// One SKU (blueprint §6.2 / §17.6). Created by MiniMart ▸ Import Prototype Catalogue from the
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
        [SerializeField] private string description = "";
        [Tooltip("Fictional EAN-13 style code shown on packs and used by the scanner.")]
        [SerializeField] private string barcode = "";
        [Tooltip("Category / licence key, e.g. essentials. See ProductCategoryDefinition.")]
        [SerializeField] private string categoryKey = "";

        [Header("Package")]
        [Tooltip("Prototype pack shape: can, bottle, jar, cup, chips, pouch, sack, carton, eggs, block, tub, flat, apple ...")]
        [SerializeField] private string packageType = "";
        [SerializeField] private string packSize = "";
        [Tooltip("Rough package size in metres (w, h, d). Used for shelf visuals.")]
        [SerializeField] private Vector3 packageDimensions = new Vector3(0.08f, 0.12f, 0.08f);
        [SerializeField] private PackageMass massClass = PackageMass.Light;

        [Header("Storage")]
        [SerializeField] private ProductKind kind = ProductKind.Dry;
        [Min(1)] [SerializeField] private int unitsPerBox = 10;
        [Tooltip("Business days before it expires. 0 = never expires.")]
        [Min(0)] [SerializeField] private int shelfLifeDays;

        [Header("Economy (₹ per unit)")]
        [Min(1)] [SerializeField] private int supplierCost = 1;
        [Tooltip("MRP: the most shoppers expect to pay.")]
        [Min(1)] [SerializeField] private int mrp = 1;
        [Tooltip("Starting selling price. Players change prices in game; that lives in store state, not here.")]
        [Min(1)] [SerializeField] private int defaultSellingPrice = 1;

        [Header("Look")]
        [SerializeField] private Color primaryColor = Color.white;
        [SerializeField] private Color secondaryColor = Color.white;
        [SerializeField] private Sprite icon;
        [SerializeField] private GameObject unitPrefab;

        public string ProductId => productId;
        public int PrototypeIndex => prototypeIndex;
        public string DisplayName => displayName;
        public string Brand => brand;
        public string Description => description;
        public string Barcode => barcode;
        public string CategoryKey => categoryKey;
        public string PackageType => packageType;
        public string PackSize => packSize;
        public Vector3 PackageDimensions => packageDimensions;
        public PackageMass MassClass => massClass;
        public ProductKind Kind => kind;
        public int UnitsPerBox => unitsPerBox;
        public int ShelfLifeDays => shelfLifeDays;
        public int SupplierCost => supplierCost;
        /// <summary>IProduct.BasePrice is the MRP: what shoppers compare the selling price against.</summary>
        public int BasePrice => mrp;
        public int Mrp => mrp;
        public int DefaultSellingPrice => defaultSellingPrice;
        public Color PrimaryColor => primaryColor;
        public Color SecondaryColor => secondaryColor;
        public Sprite Icon => icon;
        public GameObject UnitPrefab => unitPrefab;

#if UNITY_EDITOR
        /// <summary>Editor-only setter used by the catalogue importer.</summary>
        public void EditorSet(string id, int index, string name, string brandName, string size, string desc,
            ProductKind productKind, int perBox, int lifeDays, int cost, int price, string category,
            Color primary, Color secondary, string shape, string code, PackageMass mass)
        {
            productId = id; prototypeIndex = index; displayName = name; brand = brandName; packSize = size;
            description = desc; kind = productKind; unitsPerBox = perBox; shelfLifeDays = lifeDays;
            supplierCost = cost; mrp = price; defaultSellingPrice = price; categoryKey = category;
            primaryColor = primary; secondaryColor = secondary; packageType = shape; barcode = code; massClass = mass;
        }
#endif

        /// <summary>Runtime construction for PlayMode tests and procedural setups.</summary>
        public static ProductDefinition CreateRuntime(string id, string name, ProductKind productKind,
            int perBox, int cost, int price, int lifeDays = 0, Color? color = null, string shape = "box")
        {
            var p = CreateInstance<ProductDefinition>();
            p.name = id;
            p.productId = id; p.displayName = name; p.kind = productKind; p.unitsPerBox = perBox;
            p.supplierCost = cost; p.mrp = price; p.defaultSellingPrice = price; p.shelfLifeDays = lifeDays;
            p.primaryColor = color ?? Color.white; p.secondaryColor = Color.white; p.packageType = shape;
            return p;
        }

        public override string ToString() => displayName;
    }
}
