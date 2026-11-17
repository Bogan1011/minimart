using System;
using System.Collections.Generic;
using UnityEngine;

namespace MiniMart.Core
{
    public enum MessageKind { Info, Good, Bad, Spend }

    /// <summary>
    /// Short toasts for the HUD ("Sold out: Cola", "Binned 10 × Bread"). Gameplay posts here; the HUD
    /// only displays. Will be replaced by a networked event channel in Phase 3.
    /// </summary>
    public static class GameMessages
    {
        public readonly struct Message
        {
            public readonly string Text;
            public readonly MessageKind Kind;
            public readonly float Time;

            public Message(string text, MessageKind kind, float time)
            {
                Text = text; Kind = kind; Time = time;
            }
        }

        private const int MaxKept = 8;
        private static readonly List<Message> Recent = new List<Message>();

        public static event Action<Message> Posted;

        public static IReadOnlyList<Message> RecentMessages => Recent;

        public static void Post(string text, MessageKind kind = MessageKind.Info)
        {
            if (string.IsNullOrEmpty(text)) return;
            var m = new Message(text, kind, Time.unscaledTime);
            Recent.Add(m);
            if (Recent.Count > MaxKept) Recent.RemoveAt(0);
            Posted?.Invoke(m);
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStatics()
        {
            Recent.Clear();
            Posted = null;
        }
    }
}
