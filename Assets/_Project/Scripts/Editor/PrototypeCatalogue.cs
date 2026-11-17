using System;
using MiniMart.Simulation.Catalogue;

namespace MiniMart.EditorTools
{
    /// <summary>
    /// Shape of ScriptableObjects/_Source/prototype-catalogue.json (extracted from the prototype's
    /// game.js). Field names match the JSON so JsonUtility can read it.
    /// </summary>
    [Serializable]
    public sealed class PrototypeCatalogue
    {
        public string source;
        public ProductRow[] products;
        public LicenceRow[] licences;
        public LevelRow[] storeLevels;
        public UpgradeRow[] upgrades;

        [Serializable]
        public sealed class ProductRow
        {
            public int id;
            public string key, name, brand, size, kind;
            public int cost, basePrice, unitsPerBox, shelfLifeDays;
            public string color, color2, shape, art, desc, licence;
        }

        [Serializable]
        public sealed class LicenceRow
        {
            public string key, name;
            public int level, cost;
            public int[] productIds;
        }

        [Serializable]
        public sealed class LevelRow
        {
            public int level;
            public string name, desc;
            public int cost, served, rep, rent, cap, crowd;
        }

        [Serializable]
        public sealed class UpgradeRow
        {
            public string key, name, desc;
            public int level, max, wage;
            public int[] cost;
        }

        public static ProductKind ParseKind(string kind)
        {
            switch (kind)
            {
                case "dry": return ProductKind.Dry;
                case "chilled": return ProductKind.Chilled;
                case "frozen": return ProductKind.Frozen;
                case "produce": return ProductKind.Produce;
                default: throw new FormatException($"Unknown product kind '{kind}'");
            }
        }
    }
}
