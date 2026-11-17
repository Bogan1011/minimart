using System.Collections;
using System.Linq;
using MiniMart.Data;
using MiniMart.Interaction;
using MiniMart.Player;
using MiniMart.Simulation.Catalogue;
using MiniMart.Simulation.Inventory;
using MiniMart.World;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace MiniMart.Tests
{
    /// <summary>
    /// The Sprint 1 demo loop with real GameObjects: pick up a box, stock a shelf, see the count,
    /// drop and empty without duplicating or losing anything.
    /// </summary>
    public class CarryAndStockTests
    {
        private GameObject floor;
        private GameObject player;
        private InteractionController hands;
        private ShelfFixture shelf;
        private ShelfFixture fridge;
        private ProductDefinition bread, cola, milk;

        [SetUp]
        public void SetUp()
        {
            floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.transform.position = new Vector3(0, -0.1f, 0);
            floor.transform.localScale = new Vector3(20, 0.2f, 20);

            bread = ProductDefinition.CreateRuntime("bread-loaf", "Bread Loaf", ProductKind.Dry, 10, 37, 45, 2, new Color(0.85f, 0.63f, 0.36f));
            cola = ProductDefinition.CreateRuntime("cola-can", "Cola Can", ProductKind.Dry, 24, 32, 40);
            milk = ProductDefinition.CreateRuntime("milk-packet", "Milk Packet", ProductKind.Chilled, 16, 26, 30, 3);

            shelf = FixtureBuilder.Build(FixtureDefinition.CreateRuntime(FixtureKind.Shelf), new Vector3(0, 0, 3), Quaternion.Euler(0, 180, 0));
            fridge = FixtureBuilder.Build(FixtureDefinition.CreateRuntime(FixtureKind.Fridge), new Vector3(3, 0, 3), Quaternion.Euler(0, 180, 0));

            player = PlayerRigBuilder.Build(Vector3.zero, withHud: false, withCamera: true);
            hands = player.GetComponent<InteractionController>();
        }

        [TearDown]
        public void TearDown()
        {
            // immediate, so the next test starts with an empty ProductBox.All
            foreach (var b in ProductBox.All.ToArray()) Object.DestroyImmediate(b.gameObject);
            Object.DestroyImmediate(player);
            Object.DestroyImmediate(shelf.gameObject);
            Object.DestroyImmediate(fridge.gameObject);
            Object.DestroyImmediate(floor);
        }

        private ProductBox SpawnBox(ProductDefinition p, Vector3 at) =>
            ProductBox.Spawn(BoxContents.FreshFromSupplier(p), at, Quaternion.identity);

        private void Use(IInteractable target)
        {
            hands.ForceTarget(target);
            hands.PressPrimary();
        }

        private void UseSecondary(IInteractable target)
        {
            hands.ForceTarget(target);
            hands.PressSecondary();
        }

        [UnityTest]
        public IEnumerator PickUpCarryAndStockAShelf()
        {
            var box = SpawnBox(bread, new Vector3(0, 0.3f, 1));
            yield return null;

            Use(box);
            Assert.IsTrue(hands.Carry.IsCarrying);
            Assert.AreSame(box, hands.Carry.Carried);
            Assert.IsTrue(box.IsHeld);
            Assert.AreEqual(hands.Carry.HoldPoint, box.transform.parent, "box should ride on the hold point");

            hands.ForceTarget(shelf);
            Assert.IsTrue(hands.CurrentPrompt.PrimaryEnabled);
            StringAssert.StartsWith("Stock Bread Loaf (0/24)", hands.CurrentPrompt.Primary);

            hands.PressPrimary();
            yield return null;

            Assert.AreEqual(10, shelf.Stock.Quantity, "the whole box goes on");
            Assert.IsFalse(hands.Carry.IsCarrying, "an empty box disappears");
            Assert.IsTrue(box == null, "empty box destroyed");
            Assert.AreEqual(10, shelf.GetComponent<FixtureStockView>().VisibleUnits, "shelf shows the new count");
        }

        [UnityTest]
        public IEnumerator PartlyStockedBoxStaysInHands()
        {
            shelf.Stock.SetContents(cola, 20, null);
            var box = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            yield return null;

            Use(box);
            Use(shelf);
            Assert.AreEqual(24, shelf.Stock.Quantity);
            Assert.IsTrue(hands.Carry.IsCarrying);
            Assert.AreEqual(20, hands.Carry.Carried.Contents.Units);

            hands.ForceTarget(shelf);
            Assert.IsFalse(hands.CurrentPrompt.PrimaryEnabled);
            Assert.AreEqual("This one is full", hands.CurrentPrompt.Primary);
        }

        [UnityTest]
        public IEnumerator WrongFixtureIsRefusedAndNothingMoves()
        {
            var box = SpawnBox(milk, new Vector3(0, 0.3f, 1));
            yield return null;
            Use(box);
            Use(shelf);
            Assert.AreEqual(0, shelf.Stock.Quantity);
            Assert.AreEqual(16, hands.Carry.Carried.Contents.Units);
            Assert.AreEqual("Milk Packet goes in a fridge", hands.CurrentPrompt.Primary);

            Use(fridge);
            Assert.AreEqual(16, fridge.Stock.Quantity);
            Assert.IsFalse(hands.Carry.IsCarrying);
        }

        [UnityTest]
        public IEnumerator DropPutsTheBoxBackInTheWorldUnchanged()
        {
            var box = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            yield return null;
            Use(box);
            Assert.IsTrue(hands.Carry.Drop());
            Assert.IsFalse(hands.Carry.IsCarrying);
            Assert.IsFalse(box.IsHeld);
            Assert.IsNull(box.transform.parent);
            Assert.IsFalse(box.GetComponent<Rigidbody>().isKinematic);

            for (int i = 0; i < 30; i++) yield return new WaitForFixedUpdate();
            Assert.Greater(box.transform.position.y, -0.05f, "box rests on the floor, not through it");
            Assert.AreEqual(24, box.Contents.Units);
            Assert.AreEqual(1, ProductBox.All.Count, "no duplicate boxes");
        }

        [UnityTest]
        public IEnumerator CannotPickUpASecondBox()
        {
            var a = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            var b = SpawnBox(bread, new Vector3(1, 0.3f, 1));
            yield return null;
            Use(a);
            hands.ForceTarget(b);
            Assert.IsFalse(hands.CurrentPrompt.PrimaryEnabled);
            hands.PressPrimary();
            Assert.AreSame(a, hands.Carry.Carried);
            Assert.IsFalse(b.IsHeld);
        }

        [UnityTest]
        public IEnumerator EmptyingAShelfHandsYouItsStock()
        {
            shelf.Stock.SetContents(bread, 7, 1);
            shelf.RefreshView();
            yield return null;

            UseSecondary(shelf);
            Assert.IsTrue(shelf.Stock.IsEmpty);
            Assert.IsTrue(hands.Carry.IsCarrying);
            Assert.AreSame(bread, hands.Carry.Carried.Contents.Product);
            Assert.AreEqual(7, hands.Carry.Carried.Contents.Units);
            Assert.AreEqual(1, hands.Carry.Carried.Contents.DaysLeft);
            Assert.AreEqual(0, shelf.GetComponent<FixtureStockView>().VisibleUnits);

            // and back on again: nothing gained, nothing lost
            Use(shelf);
            Assert.AreEqual(7, shelf.Stock.Quantity);
            Assert.IsFalse(hands.Carry.IsCarrying);
        }

        [UnityTest]
        public IEnumerator CannotEmptyWhileCarrying()
        {
            shelf.Stock.SetContents(bread, 7, 1);
            var box = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            yield return null;
            Use(box);
            hands.ForceTarget(shelf);
            hands.PressSecondary();
            Assert.AreEqual(7, shelf.Stock.Quantity);
            Assert.AreSame(box, hands.Carry.Carried);
        }

        [UnityTest]
        public IEnumerator ExpiredStockIsClearedAsWaste()
        {
            fridge.Stock.SetContents(milk, 6, 0);
            yield return null;
            int before = MiniMart.Core.SessionStats.WasteValue;
            UseSecondary(fridge);
            Assert.IsTrue(fridge.Stock.IsEmpty);
            Assert.IsFalse(hands.Carry.IsCarrying, "expired stock is binned, not handed over");
            Assert.AreEqual(before + 6 * 26, MiniMart.Core.SessionStats.WasteValue);
        }

        [UnityTest]
        public IEnumerator LeavingWhileCarryingDropsTheBox()
        {
            var box = SpawnBox(cola, new Vector3(0, 0.3f, 1));
            yield return null;
            Use(box);
            hands.Carry.enabled = false;   // what happens when a player object is disabled/removed
            Assert.IsFalse(box.IsHeld);
            Assert.IsNull(box.transform.parent);
            Assert.AreEqual(24, box.Contents.Units);
        }
    }
}
