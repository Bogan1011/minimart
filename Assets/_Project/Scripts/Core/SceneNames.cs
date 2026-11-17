namespace MiniMart.Core
{
    /// <summary>Scene names from blueprint §5.1, as added to Build Settings by MiniMart ▸ Build Scenes.</summary>
    public static class SceneNames
    {
        public const string Bootstrap = "00_Bootstrap";
        public const string MainMenu = "01_MainMenu";
        public const string Lobby = "02_Lobby";
        public const string StoreWorld = "03_StoreWorld";
        public const string Loading = "04_Loading";
        public const string TestPhysics = "05_TestPhysics";
        public const string TestNPC = "06_TestNPC";

        public static readonly string[] BuildOrder = { Bootstrap, MainMenu, Lobby, StoreWorld, Loading, TestPhysics, TestNPC };
    }
}
