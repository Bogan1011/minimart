using MiniMart.World;
using UnityEngine;

namespace MiniMart.Products
{
    /// <summary>
    /// Builds the visual for one product unit (blueprint §17.5 ProductView). Grey-box for now: the
    /// package type picks a silhouette (can → cylinder, apple → sphere, everything else → block) so
    /// shelves read at a glance. Uses the product's unitPrefab when one is assigned.
    /// </summary>
    public static class ProductView
    {
        public enum Silhouette { Block, Cylinder, Round }

        public static Silhouette SilhouetteFor(string packageType)
        {
            switch (packageType)
            {
                case "can": case "bottle": case "jar": case "cup": case "tub": case "icetub": case "oil": case "paste":
                    return Silhouette.Cylinder;
                case "apple": case "tomato": case "onion": case "potato":
                    return Silhouette.Round;
                default:
                    return Silhouette.Block;
            }
        }

        /// <summary>One unit fitting inside <paramref name="cell"/> (metres), bottom resting at <paramref name="localPos"/>.</summary>
        public static GameObject Create(ProductDefinition product, Transform parent, Vector3 localPos, Vector3 cell)
        {
            GameObject go;
            if (product != null && product.UnitPrefab != null)
            {
                go = Object.Instantiate(product.UnitPrefab, parent, false);
                go.transform.localPosition = localPos;
                return go;
            }

            var shape = SilhouetteFor(product != null ? product.PackageType : null);
            Color c = product != null ? product.PrimaryColor : Color.white;
            switch (shape)
            {
                case Silhouette.Cylinder:
                {
                    float d = Mathf.Min(cell.x, cell.z) * 0.85f, h = cell.y * 0.85f;
                    go = ProtoBuilder.Primitive(PrimitiveType.Cylinder, "Unit");
                    go.transform.SetParent(parent, false);
                    go.transform.localPosition = localPos + new Vector3(0, h / 2f, 0);
                    go.transform.localScale = new Vector3(d, h / 2f, d);   // the cylinder mesh is 2 m tall
                    break;
                }
                case Silhouette.Round:
                {
                    float d = Mathf.Min(cell.x, Mathf.Min(cell.y, cell.z)) * 0.9f;
                    go = ProtoBuilder.Primitive(PrimitiveType.Sphere, "Unit");
                    go.transform.SetParent(parent, false);
                    go.transform.localPosition = localPos + new Vector3(0, d / 2f, 0);
                    go.transform.localScale = Vector3.one * d;
                    break;
                }
                default:
                {
                    var size = cell * 0.85f;
                    go = ProtoBuilder.Primitive(PrimitiveType.Cube, "Unit");
                    go.transform.SetParent(parent, false);
                    go.transform.localPosition = localPos + new Vector3(0, size.y / 2f, 0);
                    go.transform.localScale = size;
                    break;
                }
            }
            ProtoBuilder.DestroyCollider(go);   // shelf products are slot-placed, not physical (§9.1 State A)
            ProtoBuilder.Tint(go.GetComponent<Renderer>(), c);
            return go;
        }
    }
}
