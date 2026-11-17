using MiniMart.Core;
using MiniMart.Handling;
using MiniMart.Interaction;
using MiniMart.UI;
using UnityEngine;

namespace MiniMart.Player
{
    /// <summary>
    /// Builds the first-person player: CharacterController body, camera at eye height, a hold point
    /// for boxes, input, movement, interaction, carry and HUD. Used by the editor (to save the Player
    /// prefab) and by PlayMode tests.
    /// </summary>
    public static class PlayerRigBuilder
    {
        public const float Height = 1.8f;
        public const float Radius = 0.33f;
        public const float EyeHeight = 1.65f;

        public static GameObject Build(Vector3 position, bool withHud = true, bool withCamera = true)
        {
            var root = new GameObject("Player");
            root.SetActive(false);
            root.transform.position = position;

            var cc = root.AddComponent<CharacterController>();
            cc.height = Height;
            cc.radius = Radius;
            cc.center = new Vector3(0, Height / 2f, 0);
            cc.stepOffset = 0.3f;
            cc.skinWidth = 0.03f;

            // visible body for other players later; no collider (the CharacterController is the collider)
            var body = MiniMart.World.ProtoBuilder.Primitive(PrimitiveType.Capsule, "Body");
            Object.DestroyImmediate(body.GetComponent<Collider>());
            body.transform.SetParent(root.transform, false);
            body.transform.localPosition = new Vector3(0, Height / 2f, 0);
            body.transform.localScale = new Vector3(Radius * 2f, Height / 2f, Radius * 2f);
            body.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.ShadowsOnly;

            var pivot = new GameObject("CameraPivot").transform;
            pivot.SetParent(root.transform, false);
            pivot.localPosition = new Vector3(0, EyeHeight, 0);
            Camera cam = null;
            if (withCamera)
            {
                cam = pivot.gameObject.AddComponent<Camera>();
                cam.nearClipPlane = 0.05f;
                cam.fieldOfView = 75f;
                cam.allowMSAA = false;   // iGPU budget: MSAA off (see Docs/WebAndLAN.md)
                pivot.gameObject.AddComponent<AudioListener>();
                pivot.gameObject.tag = "MainCamera";
            }

            var hold = new GameObject("HoldPoint").transform;
            hold.SetParent(pivot, false);
            hold.localPosition = new Vector3(0f, -0.45f, 0.65f);   // low and close so the box doesn't block the view (§8.4)

            root.AddComponent<PlayerInputReader>();
            var pc = root.AddComponent<PlayerController>();
            pc.SetCameraPivot(pivot);
            var carry = root.AddComponent<CarryController>();
            carry.SetHoldPoint(hold);
            var ic = root.AddComponent<PlayerInteractionController>();
            if (cam != null) ic.SetCamera(cam);
            if (withHud) root.AddComponent<HudOverlay>();

            GameLayers.Set(root, GameLayers.Player);
            root.SetActive(true);
            return root;
        }
    }
}
