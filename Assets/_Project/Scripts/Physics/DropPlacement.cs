using MiniMart.Core;
using UnityEngine;

namespace MiniMart.Handling
{
    /// <summary>
    /// Finds a safe place to put a box down (blueprint §8.5): not inside a wall, fixture or another box,
    /// not under the floor, and not on the far side of a wall from the player.
    /// </summary>
    public static class DropPlacement
    {
        private static readonly Collider[] Overlaps = new Collider[16];

        /// <param name="player">The dropping player's root (its colliders are ignored).</param>
        /// <param name="halfExtents">Half size of the box being dropped.</param>
        /// <param name="ignore">The box itself, if it already has colliders in the world.</param>
        public static bool TryFind(Transform player, Vector3 halfExtents, Transform ignore, out Vector3 position, out Quaternion rotation)
        {
            Vector3 forward = Vector3.ProjectOnPlane(player.forward, Vector3.up);
            if (forward.sqrMagnitude < 0.001f) forward = Vector3.forward;
            forward.Normalize();
            rotation = Quaternion.LookRotation(forward, Vector3.up);
            Vector3 chest = player.position + Vector3.up * 1.0f;

            // in front first, then closer, then a little to each side
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            Vector3[] offsets =
            {
                forward * 0.9f, forward * 0.65f, forward * 0.65f + right * 0.45f, forward * 0.65f - right * 0.45f,
                right * 0.6f, -right * 0.6f,
            };

            int blockers = GameLayers.DropBlockerMask;
            foreach (var off in offsets)
            {
                Vector3 probe = chest + off;
                // line of sight from the player's chest: never drop through a wall
                if (Physics.Linecast(chest, probe, out var wallHit, blockers, QueryTriggerInteraction.Ignore) && !IsOwn(wallHit.collider, player, ignore))
                    continue;
                // find the floor under the spot
                if (!Physics.Raycast(probe, Vector3.down, out var floor, 2.5f, blockers, QueryTriggerInteraction.Ignore)) continue;
                if (IsOwn(floor.collider, player, ignore)) continue;
                if (Vector3.Angle(floor.normal, Vector3.up) > 30f) continue;   // too steep (e.g. side of a fixture)
                Vector3 centre = floor.point + Vector3.up * (halfExtents.y + 0.01f);
                if (centre.y > chest.y) continue;                               // would end up on top of something tall
                if (Blocked(centre, halfExtents * 0.95f, rotation, blockers, player, ignore)) continue;
                position = centre;
                return true;
            }

            position = player.position;
            return false;
        }

        private static bool Blocked(Vector3 centre, Vector3 half, Quaternion rot, int mask, Transform player, Transform ignore)
        {
            int n = Physics.OverlapBoxNonAlloc(centre, half, Overlaps, rot, mask, QueryTriggerInteraction.Ignore);
            for (int i = 0; i < n; i++) if (!IsOwn(Overlaps[i], player, ignore)) return true;
            return false;
        }

        private static bool IsOwn(Collider c, Transform player, Transform ignore) =>
            c != null && (c.transform.IsChildOf(player) || (ignore != null && c.transform.IsChildOf(ignore)));
    }
}
