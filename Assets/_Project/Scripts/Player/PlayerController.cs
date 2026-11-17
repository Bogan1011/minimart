using UnityEngine;

namespace MiniMart.Player
{
    /// <summary>
    /// First-person walk, sprint and mouse look on a CharacterController. The controller owns movement;
    /// the camera pivot only pitches, so the two never fight (blueprint §6.1). No jump. Starting values
    /// are the blueprint's §8.1 tuning targets: walk 4.5 m/s, sprint 6.5 m/s, eye height 1.65 m.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [RequireComponent(typeof(PlayerInputReader))]
    public sealed class PlayerController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform cameraPivot;

        [Header("Movement (m/s)")]
        [SerializeField] private float walkSpeed = 4.5f;
        [SerializeField] private float sprintSpeed = 6.5f;
        [Tooltip("Not in the blueprint; boxes are heavier than single products (§8.4). Tune in playtest.")]
        [SerializeField] private float carrySpeed = 3.5f;
        [SerializeField] private float acceleration = 20f;
        [SerializeField] private float gravity = -20f;

        [Header("Look")]
        [Tooltip("Degrees per mouse count.")]
        [SerializeField] private float mouseSensitivity = 0.12f;
        [SerializeField] private bool invertY;
        [SerializeField] private float pitchLimit = 85f;

        private CharacterController body;
        private PlayerInputReader input;
        private Vector3 planarVelocity;
        private float verticalVelocity;
        private float pitch;

        /// <summary>Set by the carry system; carrying slows you down and blocks sprinting.</summary>
        public bool IsCarrying { get; set; }
        public bool IsSprinting { get; private set; }
        public Transform CameraPivot => cameraPivot;

        public float MouseSensitivity { get => mouseSensitivity; set => mouseSensitivity = Mathf.Max(0.001f, value); }
        public bool InvertY { get => invertY; set => invertY = value; }

        public void SetCameraPivot(Transform pivot) => cameraPivot = pivot;

        private void Awake()
        {
            body = GetComponent<CharacterController>();
            input = GetComponent<PlayerInputReader>();
            if (cameraPivot == null)
            {
                var cam = GetComponentInChildren<Camera>();
                if (cam != null) cameraPivot = cam.transform;
            }
        }

        private void Update()
        {
            Look(input.Look);   // zero unless the game has the mouse
            Move(input.Move, input.SprintHeld, Time.deltaTime);
        }

        private void Look(Vector2 delta)
        {
            transform.Rotate(0f, delta.x * mouseSensitivity, 0f, Space.Self);
            pitch = Mathf.Clamp(pitch + delta.y * mouseSensitivity * (invertY ? 1f : -1f), -pitchLimit, pitchLimit);
            if (cameraPivot != null) cameraPivot.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }

        private void Move(Vector2 stick, bool sprintHeld, float dt)
        {
            if (stick.sqrMagnitude > 1f) stick.Normalize();
            IsSprinting = sprintHeld && !IsCarrying && stick.sqrMagnitude > 0.01f;
            float speed = IsCarrying ? carrySpeed : IsSprinting ? sprintSpeed : walkSpeed;

            Vector3 wish = (transform.right * stick.x + transform.forward * stick.y) * speed;
            planarVelocity = Vector3.MoveTowards(planarVelocity, wish, acceleration * dt);

            if (body.isGrounded && verticalVelocity < 0f) verticalVelocity = -2f;   // keep snapped to the floor
            verticalVelocity += gravity * dt;

            body.Move((planarVelocity + Vector3.up * verticalVelocity) * dt);
        }
    }
}
