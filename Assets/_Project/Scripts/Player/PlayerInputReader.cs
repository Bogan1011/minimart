using UnityEngine;
using UnityEngine.InputSystem;

namespace MiniMart.Player
{
    /// <summary>
    /// Keyboard/mouse (and basic gamepad) bindings, defined in code so the project has no input
    /// asset to wire up yet. Controls match the prototype: WASD, Shift sprint, E/left-click use,
    /// Q/right-click drop, R empty a fixture, Esc frees the mouse.
    /// </summary>
    [DefaultExecutionOrder(-50)]
    public sealed class PlayerInputReader : MonoBehaviour
    {
        private InputAction move, look, sprint, interact, drop, empty, release;

        public Vector2 Move => move?.ReadValue<Vector2>() ?? Vector2.zero;
        public Vector2 Look => look?.ReadValue<Vector2>() ?? Vector2.zero;
        public bool SprintHeld => sprint != null && sprint.IsPressed();
        public bool InteractPressed => interact != null && interact.WasPressedThisFrame();
        public bool DropPressed => drop != null && drop.WasPressedThisFrame();
        public bool EmptyPressed => empty != null && empty.WasPressedThisFrame();

        /// <summary>True while the game has the mouse. Actions other than look/move are ignored otherwise.</summary>
        public bool HasFocus => Cursor.lockState == CursorLockMode.Locked;

        private void Awake()
        {
            move = new InputAction("Move", InputActionType.Value);
            move.AddCompositeBinding("2DVector")
                .With("Up", "<Keyboard>/w").With("Down", "<Keyboard>/s")
                .With("Left", "<Keyboard>/a").With("Right", "<Keyboard>/d");
            move.AddCompositeBinding("2DVector")
                .With("Up", "<Keyboard>/upArrow").With("Down", "<Keyboard>/downArrow")
                .With("Left", "<Keyboard>/leftArrow").With("Right", "<Keyboard>/rightArrow");
            move.AddBinding("<Gamepad>/leftStick");

            look = new InputAction("Look", InputActionType.Value);
            look.AddBinding("<Mouse>/delta");
            look.AddBinding("<Gamepad>/rightStick").WithProcessor("scaleVector2(x=12,y=12)");

            sprint = new InputAction("Sprint", InputActionType.Button);
            sprint.AddBinding("<Keyboard>/leftShift");
            sprint.AddBinding("<Gamepad>/leftStickPress");

            interact = new InputAction("Interact", InputActionType.Button);
            interact.AddBinding("<Keyboard>/e");
            interact.AddBinding("<Mouse>/leftButton");
            interact.AddBinding("<Gamepad>/buttonSouth");

            drop = new InputAction("Drop", InputActionType.Button);
            drop.AddBinding("<Keyboard>/q");
            drop.AddBinding("<Mouse>/rightButton");
            drop.AddBinding("<Gamepad>/buttonEast");

            empty = new InputAction("Empty", InputActionType.Button);
            empty.AddBinding("<Keyboard>/r");
            empty.AddBinding("<Gamepad>/buttonWest");

            release = new InputAction("ReleaseMouse", InputActionType.Button);
            release.AddBinding("<Keyboard>/escape");
        }

        private void OnEnable()
        {
            move.Enable(); look.Enable(); sprint.Enable(); interact.Enable(); drop.Enable(); empty.Enable(); release.Enable();
        }

        private void OnDisable()
        {
            move.Disable(); look.Disable(); sprint.Disable(); interact.Disable(); drop.Disable(); empty.Disable(); release.Disable();
        }

        private void OnDestroy()
        {
            move.Dispose(); look.Dispose(); sprint.Dispose(); interact.Dispose(); drop.Dispose(); empty.Dispose(); release.Dispose();
        }

        private void Update()
        {
            if (release.WasPressedThisFrame())
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
            else if (!HasFocus && Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
            {
                // the click that captures the mouse is not also an interaction
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
                skipInteractFrame = Time.frameCount;
            }
        }

        private int skipInteractFrame = -1;

        /// <summary>Interact, but not on the frame the click was used to capture the mouse.</summary>
        public bool InteractPressedInGame => HasFocus && InteractPressed && Time.frameCount != skipInteractFrame;
    }
}
