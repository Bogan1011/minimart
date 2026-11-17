# MiniMart Mayhem: prototype behaviour spec

**Phase 0 deliverable.** This is the written reference for the Unity rebuild. Every number and rule
below was read from the browser prototype's simulation (`minimart-latest.zip` → `game.js`,
`server.js`, README), not from memory. Where the README and the code disagree, the code wins and
the difference is noted.

The prototype is the *design* reference, not code to port. Values here are the starting balance
for Unity and are expected to change in playtesting. The machine-readable copy of the catalogue,
licences, levels and upgrades is `Assets/_Project/ScriptableObjects/_Source/prototype-catalogue.json`; the Unity
importer (`MiniMart ▸ Import Prototype Catalogue`) turns it into ScriptableObjects.

Units: the prototype works on a tile grid where **1 tile = 2 m** in 3D. Speeds and distances below
are given in tiles with the metre value in brackets.

---

## 1. Global constants

| Constant | Value | Notes |
|---|---|---|
| Max players | 8 | `MAX_PLAYERS` |
| Starting cash | ₹5,000 | `MM_CASH` |
| Starting reputation | 50 (range 0–100) | clamped on every change |
| Starting store level | 1 (Corner Shop) | |
| Starting licences | Daily essentials only | |
| Starter stock | none | **Open question.** None in Sprint 1; the plan expects some. Needs Akshay's call before Target A. |
| Stock action | moves the whole box in one press | **Changed (blueprint):** open the box first, then one unit per press into a slot. |
| Empty box | disappears | **Changed (blueprint):** stays in hand until binned. |
| Drop | in front, or at your feet if blocked | **Changed (blueprint):** only to a safe spot, otherwise refused. |
| One product per fixture | yes | **Changed (blueprint):** one product per slot; capacities kept as slot totals (§3). |
| Units | 1 tile = 2 m | Metres. Blueprint tuning: walk 4.5, sprint 6.5, carrying 3.5 m/s; eye height 1.65 m; reach 2.5 m. |
| Interaction target | nearest in a cone | **Changed (blueprint):** the thing under the crosshair, else the smallest angle, then nearest; never through walls. |
| Platform | browser, Node server | **Web build over LAN** with a Unity server build, see `WebAndLAN.md`. |
| Price lock | at the shelf | **Keep** (README says "at scan"; the code locks at the shelf and scan just reads it). |
| Mobile touch controls | yes | Removed (out of scope per plan §4). |
| Browser saves | 3 slots, v2–v4 | New Unity save schema; no import unless requested. |
| Weather | affects footfall and spills | Keep the numbers, revisit after Phase 2 balance. |

## 17. Prototype feature → Unity system map

| Prototype (`game.js` / client) | Unity system |
|---|---|
| `PRODUCTS`, `LICENSES`, `STORE_LEVELS`, `UPGRADES` | `ProductDefinition`, `ProductCategoryDefinition`, `StoreLevelDefinition`, `UpgradeDefinition` ScriptableObjects |
| `probe`, `act`, `pull`, `drop` | `PlayerInteractionController` + `IInteractable`, `CarryController`, `DropPlacement` |
| `stockInto`, fixture `pid/qty/life`, `capOf` | `MiniMart.Simulation.Inventory.StockRules`, `FixtureStock`/`SlotStock` (+ `ShelfFixture`, `ShelfSlot`) |
| boxes, `pending`, `freeDeliverySpot` | `BoxContents`/`BoxRules`, `ProductBoxController`, `StorageSlot` + `SupplierManager` (Target A) |
| `movePlayer`, `freeAt`, `separate` | `PlayerController` on `CharacterController` |
| `spawnCustomer`, `stepCustomer` | `CustomerManager`, `CustomerAI` on NavMesh (Phase 2) |
| `scanStep`, `requestPayment`, `giveChange`, `finishSale` | `CheckoutManager`, `PaymentManager` (Phase 2) |
| `openStore`, `closeDay`, `clock` | `DayCycleManager` |
| `rollGoals`, `goalProgress` | `GoalManager` |
| `save`, `load` | `SaveManager` (new versioned schema) |
| `server.js` WebSocket, 30 Hz/15 Hz | Unity server build with a WebSocket transport; library chosen in the Week 4 proof of concept (`WebAndLAN.md`) |
