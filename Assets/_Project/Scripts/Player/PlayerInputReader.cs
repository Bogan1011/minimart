using UnityEngine;
using UnityEngine.InputSystem;

namespace MiniMart.Player
{
    /// <summary>
    /// Reads the "Gameplay" map of the MiniMartControls input actions asset
    /// (Settings/Resources/Input/MiniMartControls.inputactions, blueprint §8.1 / §15.9). Rebind keys in
    /// that asset, not in code. Gameplay scripts read intent from here and never touch devices directly.
    ///
    /// Mouse capture: the first click captures the pointer (browsers require a click for pointer lock);
    /// Esc releases it (the browser does this itself on the web build).
    /// </summary>
    [DefaultExecutionOrder(-50)]
    public sealed class PlayerInputReader : MonoBehaviour
    {
        public const string ResourcePath = "Input/MiniMartControls";

        [Tooltip("Leave empty to load " + ResourcePath + " from Resources.")]
        [SerializeField] private InputActionAsset actions;

        private InputActionMap gameplay;
        private InputAction move, look, sprint, interact, secondary, drop, openBox, scan, pause;
        private int captureFrame = -1;

        public Vector2 Move => move != null && HasFocus ? move.ReadValue<Vector2>() : Vector2.zero;
        public Vector2 Look => look != null && HasFocus ? look.ReadValue<Vector2>() : Vector2.zero;
        public bool SprintHeld => sprint != null && sprint.IsPressed();
        public bool InteractPressed => interact != null && interact.WasPressedThisFrame();
        public bool InteractHeld => interact != null && interact.IsPressed();
        public bool SecondaryPressed => secondary != null && secondary.WasPressedThisFrame();
        public bool DropPressed => drop != null && drop.WasPressedThisFrame();
        public bool OpenBoxPressed => openBox != null && openBox.WasPressedThisFrame();
        public bool ScanPressed => scan != null && scan.WasPressedThisFrame();

        /// <summary>True while the game has the mouse.</summary>
        public bool HasFocus => Cursor.lockState == CursorLockMode.Locked;

        /// <summary>Interact, but not on the click that captured the mouse.</summary>
        public bool InteractPressedInGame => HasFocus && InteractPressed && Time.frameCount != captureFrame;

        public InputActionAsset Actions => actions;

        private void Awake()
        {
            if (actions == null) actions = Resources.Load<InputActionAsset>(ResourcePath);
            if (actions == null)
            {
                Debug.LogError($"PlayerInputReader: no input actions asset at Resources/{ResourcePath}.", this);
                return;
            }
            actions = Instantiate(actions);   // each player gets its own copy (split-screen/local tests later)
            gameplay = actions.FindActionMap("Gameplay", throwIfNotFound: true);
            move = gameplay.FindAction("Move");
            look = gameplay.FindAction("Look");
            sprint = gameplay.FindAction("Sprint");
            interact = gameplay.FindAction("Interact");
            secondary = gameplay.FindAction("Secondary");
            drop = gameplay.FindAction("Drop");
            openBox = gameplay.FindAction("OpenBox");
            scan = gameplay.FindAction("Scan");
            pause = gameplay.FindAction("Pause");
        }

        private void OnEnable() => gameplay?.Enable();
        private void OnDisable() => gameplay?.Disable();

        private void OnDestroy()
        {
            if (actions != null) Destroy(actions);
        }

        private void Update()
        {
            if (pause != null && pause.WasPressedThisFrame())
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
            else if (!HasFocus && Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
            {
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
                captureFrame = Time.frameCount;
            }
        }
    }
}
