using System.Collections;
using System.Linq;
using MiniMart.Fixtures;
using MiniMart.Interaction;
using MiniMart.Inventory;
using MiniMart.Player;
using MiniMart.Products;
using MiniMart.Simulation.Catalogue;
using MiniMart.Simulation.Inventory;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace MiniMart.Tests
{
    /// <summary>
    /// The Sprint 1 loop with real GameObjects, on the blueprint's rules: pick up, open, stock one unit
    /// per press into an aimed slot, take back, empty a slot, store on a rack, bin, and drop safely.
    /// </summary>
    public class CarryAndStockTests
    {
        private GameObject floor;
        private GameObject player;
        private PlayerInteractionController hands;
        private ShelfFixture shelf;
        private ShelfFixture fridge;
        private ProductDefinition bread, cola, milk;
        private readonly System.Collections.Generic.List<GameObject> extras = new System.Collections.Generic.List<GameObject>();

        [SetUp]
        public void SetUp()
        {
            floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.transform.position = new Vector3(0, -0.1f, 0);
            floor.transform.localScale = new Vector3(20, 0.2f, 20);

            bread = ProductDefinition.CreateRuntime("bread-loaf", "Bread Loaf", ProductKind.Dry, 10, 37, 45, 2, new Color(0.85f, 0.63f, 0.36f), "loaf");
            cola = ProductDefinition.CreateRuntime("cola-can", "Cola Can", ProductKind.Dry, 24, 32, 40, 0, null, "can");
            milk = ProductDefinition.CreateRuntime("milk-packet", "Milk Packet", ProductKind.Chilled, 16, 26, 30, 3);

            shelf = FixtureBuilder.Build(FixtureDefinition.CreateRuntime(FixtureKind.Shelf), new Vector3(0, 0, 3), Quaternion.Euler(0, 180, 0));
            fridge = FixtureBuilder.Build(FixtureDefinition.CreateRuntime(FixtureKind.Fridge), new Vector3(3, 0, 3), Quaternion.Euler(0, 180, 0));

            player = PlayerRigBuilder.Build(Vector3.zero, withHud: false, withCamera: true);
            hands = player.GetComponent<PlayerInteractionController>();
        }

        [TearDown]
        public void TearDown()
        {
            // immediate, so the next test starts with an empty ProductBoxController.All
            foreach (var b in ProductBoxController.All.ToArray()) Object.DestroyImmediate(b.gameObject);
            if (player != null) Object.DestroyImmediate(player);
            Object.DestroyImmediate(shelf.gameObject);
            Object.DestroyImmediate(fridge.gameObject);
            Object.DestroyImmediate(floor);
            foreach (var go in extras) if (go != null) Object.DestroyImmediate(go);
            extras.Clear();
        }

        private ProductBoxController SpawnBox(ProductDefinition p, Vector3 at) =>
            ProductBoxController.Spawn(BoxContents.FreshFromSupplier(p), at, Quaternion.identity);

        private void Use(IInteractable target, Vector3? aim = null)
        {
            hands.ForceTarget(target, aim);
            hands.PressPrimary();
        }

        private void UseSecondary(IInteractable target, Vector3? aim = null)
        {
            hands.ForceTarget(target, aim);
            hands.PressSecondary();
        }

        private Vector3 SlotAim(ShelfFixture f, int slot) => f.Slots[slot].WorldCentre;

        private ProductBoxController PickUpOpen(ProductDefinition p)
        {
            var box = SpawnBox(p, new Vector3(0, 0.3f, 1));
            Use(box);
            Assert.IsTrue(hands.Carry.OpenCarried(), "open the box");
            return box;
        }

        private GameObject Wall(Vector3 centre, Vector3 size)
        {
            var w = GameObject.CreatePrimitive(PrimitiveType.Cube);
            w.transform.position = centre;
            w.transform.localScale = size;
            extras.Add(w);
            return w;
        }

        // ------------------------------------------------------------------ carry and stock

        [UnityTest]
        public IEnumerator SealedBoxMustBeOpenedBeforeStocking()
        {
            var box = SpawnBox(bread, new Vector3(0, 0.3f, 1));
            yield return null;
            Use(box);
            Assert.IsTrue(hands.Carry.IsCarrying);
            Assert.AreEqual(hands.Carry.HoldPoint, box.transform.parent, "box rides on the hold point");
            Assert.AreEqual(BoxState.Held, box.Contents.State);

            hands.ForceTarget(shelf, SlotAim(shelf, 0));
            Assert.IsFalse(hands.CurrentPrompt.PrimaryEnabled);
            Assert.AreEqual("Open the box first [F]", hands.CurrentPrompt.Primary);

            Assert.IsTrue(hands.Carry.OpenCarried());
            Assert.AreEqual(BoxState.Opened, box.Contents.State);
            hands.RefreshPrompt();
            Assert.IsTrue(hands.CurrentPrompt.PrimaryEnabled);
            Assert.IsTrue(hands.CurrentPrompt.Repeatable, "hold E to keep stocking");
            Assert.AreEqual("Stock Bread Loaf (0/4)", hands.CurrentPrompt.Primary);
        }

        [UnityTest]
        public IEnumerator EachPressStocksOneUnitIntoTheAimedSlot()
        {
            var box = PickUpOpen(bread);
            yield return null;

            Use(shelf, SlotAim(shelf, 3));
            Use(shelf, SlotAim(shelf, 3));
            yield return null;

            Assert.AreEqual(2, shelf.Stock.Slot(3).Quantity);
            Assert.AreEqual(2, shelf.Stock.Quantity, "only the aimed slot");
            Assert.AreEqual(8, box.Contents.Units);
            Assert.AreEqual(2, shelf.Slots[3].VisibleUnits, "the slot shows the new count");
        }

        [UnityTest]
        public IEnumerator EmptyBoxStaysInHandsUntilBinned()
        {
            var box = PickUpOpen(bread);
            for (int i = 0; i < 10; i++) Use(shelf, SlotAim(shelf, i < 4 ? 0 : i < 8 ? 1 : 2));
            yield return null;

            Assert.AreEqual(10, shelf.Stock.Quantity);
            Assert.IsTrue(hands.Carry.IsCarrying, "an empty box doesn't vanish");
            Assert.AreEqual(BoxState.Empty, box.Contents.State);

            var binGo = GameObject.CreatePrimitive(PrimitiveType.Cube);
            extras.Add(binGo);
            var bin = binGo.AddComponent<WasteBin>();
            hands.ForceTarget(bin);
            Assert.AreEqual("Throw away the empty box", hands.CurrentPrompt.Primary);
            hands.PressPrimary();
            yield return null;
            Assert.IsFalse(hands.Carry.IsCarrying);
            Assert.IsTrue(box == null, "binned box destroyed");
        }

        [UnityTest]
        public IEnumerator SlotHoldingAnotherProductIsRefused()
        {
            shelf.Stock.SetSlot(0, cola, 2, null);
            var box = PickUpOpen(bread);
            yield return null;

            hands.ForceTarget(shelf, SlotAim(shelf, 0));
            Assert.IsFalse(hands.CurrentPrompt.PrimaryEnabled);
            Assert.AreEqual("This slot holds Cola Can", hands.CurrentPrompt.Primary);
            hands.PressPrimary();
            Assert.AreEqual(10, box.Contents.Units, "nothing moved");
            Assert.AreEqual(2, shelf.Stock.Quantity);
        }

        [UnityTest]
        public IEnumerator WrongFixtureIsRefusedAndNothingMoves()
        {
            var box = PickUpOpen(milk);
            yield return null;
            hands.ForceTarget(shelf, SlotAim(shelf, 0));
            Assert.IsFalse(hands.CurrentPrompt.PrimaryEnabled);
            Assert.AreEqual("Milk Packet goes in a fridge", hands.CurrentPrompt.Primary);
            hands.PressPrimary();
            Assert.AreEqual(0, shelf.Stock.Quantity);
            Assert.AreEqual(16, box.Contents.Units);

            Use(fridge, SlotAim(fridge, 0));
            Assert.AreEqual(1, fridge.Stock.Quantity);
        }

        [UnityTest]
        public IEnumerator SecondaryTakesOneBack()
        {
            var box = PickUpOpen(cola);
            Use(shelf, SlotAim(shelf, 1));
            Use(shelf, SlotAim(shelf, 1));
            yield return null;

            hands.ForceTarget(shelf, SlotAim(shelf, 1));
            Assert.AreEqual("Take one back", hands.CurrentPrompt.Secondary);
            hands.PressSecondary();
            Assert.AreEqual(1, shelf.Stock.Slot(1).Quantity);
            Assert.AreEqual(23, box.Contents.Units);
        }

        [UnityTest]
        public IEnumerator EmptyingASlotPutsItsStockInYourHands()
        {
            shelf.Stock.SetSlot(4, bread, 3, 1);
            shelf.RefreshView();
            yield return null;

            UseSecondary(shelf, SlotAim(shelf, 4));
            Assert.IsTrue(hands.Carry.IsCarrying);
            var c = hands.Carry.Carried.Contents;
            Assert.AreEqual(3, c.Units);
            Assert.AreEqual(1, c.DaysLeft);
            Assert.IsTrue(c.IsOpen);
            Assert.IsTrue(shelf.Stock.Slot(4).IsEmpty);
        }

        [UnityTest]
        public IEnumerator ClearingExpiredStockIsWasteNotABox()
        {
            fridge.Stock.SetSlot(0, milk, 4, 0);
            yield return null;
            hands.ForceTarget(fridge, SlotAim(fridge, 0));
            Assert.AreEqual("Clear it out", hands.CurrentPrompt.Secondary);
            hands.PressSecondary();
            Assert.IsFalse(hands.Carry.IsCarrying);
            Assert.AreEqual(0, fridge.Stock.Quantity);
        }

        [UnityTest]
        public IEnumerator EmptyingWithFullHandsIsNotOffered()
        {
            shelf.Stock.SetSlot(0, cola, 4, null);
            var box = PickUpOpen(bread);
            yield return null;
            UseSecondary(shelf, SlotAim(shelf, 0));
            Assert.AreEqual(4, shelf.Stock.Slot(0).Quantity, "stock stays put");
            Assert.AreSame(box, hands.Carry.Carried);
        }

        // ------------------------------------------------------------------ storage

        [UnityTest]
        public IEnumerator BoxesGoOnAndComeOffTheStorageRack()
        {
            var rack = StorageRackBuilder.Build(new Vector3(-3, 0, 2), Quaternion.Euler(0, 180, 0));
            extras.Add(rack);
            var slot = rack.GetComponentInChildren<StorageSlot>();
            var box = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            yield return null;

            Use(box);
            hands.ForceTarget(slot);
            Assert.AreEqual("Store Cola Can box", hands.CurrentPrompt.Primary);
            hands.PressPrimary();
            yield return null;

            Assert.IsFalse(hands.Carry.IsCarrying);
            Assert.AreSame(box, slot.Occupant);
            Assert.AreEqual(BoxState.Stored, box.Contents.State);
            Assert.IsTrue(box.GetComponent<Rigidbody>().isKinematic, "stored boxes are kinematic");

            Use(box);
            Assert.IsTrue(hands.Carry.IsCarrying);
            Assert.IsFalse(slot.IsOccupied, "slot freed on pick-up");
        }

        // ------------------------------------------------------------------ dropping

        [UnityTest]
        public IEnumerator DroppedBoxSettlesThenGoesKinematic()
        {
            var box = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            yield return null;
            Use(box);
            Assert.IsTrue(hands.Carry.Drop());
            Assert.AreEqual(BoxState.OnGround, box.Contents.State);
            Assert.IsNull(box.transform.parent);

            float t = 0f;
            while (box.IsSettling && t < 5f) { t += Time.deltaTime; yield return null; }
            Assert.IsFalse(box.IsSettling, "settled within 5 s");
            Assert.IsTrue(box.GetComponent<Rigidbody>().isKinematic, "back to state A once at rest");
            Assert.Greater(box.transform.position.y, 0f, "on top of the floor, not in it");
        }

        [UnityTest]
        public IEnumerator NoRoomAgainstWallsKeepsTheBoxInHand()
        {
            // walls in front and on both sides, closer than any drop spot
            Wall(new Vector3(0, 1.2f, 0.5f), new Vector3(3f, 2.4f, 0.2f));
            Wall(new Vector3(-0.5f, 1.2f, 0), new Vector3(0.2f, 2.4f, 2f));
            Wall(new Vector3(0.5f, 1.2f, 0), new Vector3(0.2f, 2.4f, 2f));
            var box = SpawnBox(cola, new Vector3(0, 0.3f, -1.5f));
            Physics.SyncTransforms();
            yield return null;

            Use(box);
            Assert.IsFalse(hands.Carry.Drop(), "nowhere safe to put it");
            Assert.IsTrue(hands.Carry.IsCarrying);
            Assert.AreSame(box, hands.Carry.Carried);
        }

        [UnityTest]
        public IEnumerator PlayerLeavingDropsTheBox()
        {
            var box = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            yield return null;
            Use(box);
            hands.Carry.DropBeforeLeaving();
            Object.DestroyImmediate(player);
            yield return null;
            Assert.IsTrue(box != null, "the box outlives the player");
            Assert.IsFalse(box.IsHeld);
            Assert.IsNull(box.transform.parent, "box left in the world, not on the player");
            Assert.AreEqual(BoxState.OnGround, box.Contents.State);
        }
    }
}
