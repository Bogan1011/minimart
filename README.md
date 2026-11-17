# MiniMart Mayhem (Unity)

First-person co-op supermarket game, rebuilt in **Unity 6 + C#** from the browser prototype.
This folder is **Phase 0 + Sprint 1** of `MiniMart_Mayhem_Unity_CSharp_MVP_Plan.md`:

- `Docs/BehaviourSpec.md`: every number and rule from the prototype (products, prices, fixture capacities,
  licences, store levels, upgrades, day cycle, customers, checkout, goals), plus the preserve/change decisions
  and a prototype → Unity system map.
- A Unity project skeleton with the Sprint 1 loop: walk around a small shop, pick up a delivery box, carry it to
  the right fixture, stock it, watch the count change, drop it or empty a fixture back into a box, without
  duplicating or losing stock.

Nothing here has been opened in Unity yet: it was written without an Editor. Expect to fix a few
compile errors on first open (see "First open" below).

## Set up (about 10 minutes)

1. **Unity Hub ▸ New project ▸ Unity 6 LTS ▸ "Universal 3D" template.** Call it `MiniMartMayhem`.
   (The template configures URP, the Input System and the Test Framework, which this project needs.)
2. Close the Editor. Copy these into the new project folder, merging with what's there:
   `Assets/_Project`, `Assets/ThirdParty`, `Docs`, `README.md`, `.gitignore`, `.gitattributes`.
3. Reopen the project. If Unity asks to enable the new Input System backends, say **Yes** (it restarts).
   *Edit ▸ Project Settings ▸ Player ▸ Active Input Handling* must be **Input System Package (New)** or **Both**.
4. **MiniMart ▸ Import Prototype Catalogue.** Creates 36 products, 4 fixture types, 7 licences, 4 store levels
   and 9 upgrades as ScriptableObjects under `Assets/_Project/ScriptableObjects`.
5. **MiniMart ▸ Build Sprint 1 Scenes.** Creates the prefabs and the `Bootstrap`, `MainMenu`, `Supermarket`
   and `TestMaps/TestMap` scenes and adds them to Build Settings (Bootstrap first).
6. Press **Play** in `Supermarket` (opens automatically).

Git: `git init`, `git lfs install`, then commit. `.gitignore` and `.gitattributes` are ready.

## Controls

| Key | Action |
|---|---|
| Click | capture the mouse |
| `W` `A` `S` `D` · `Shift` | walk · sprint (not while carrying) |
| Mouse | look |
| `E` / left-click | pick up a box · stock the fixture you're looking at · throw a box in the waste bin |
| `Q` / right-click | drop the box |
| `R` | empty a fixture into a box (expired stock goes straight to waste) |
| `Esc` | free the mouse |

## Sprint 1 demo checklist (do these in the Editor)

In **Supermarket**:

- [ ] You start in the storage room facing the yellow delivery pad with 11 boxes on it.
- [ ] Look at a box: it brightens and the prompt says `[E] Pick up Bread Loaf box (10)`.
- [ ] Pick it up; walk through the doorway onto the shop floor; walking is slower and you can't sprint.
- [ ] Look at a fridge: `Bread Loaf goes in a shelf` (red, can't do it).
- [ ] Look at a shelf: `[E] Stock Bread Loaf (0/24)`. Press E: the box disappears and 10 blocks appear; the ticket says `10/24`.
- [ ] Stock a cola box (24) onto the same shelf: refused (`Holds Bread Loaf - empty it first`).
- [ ] Put cola on an empty shelf, then a second cola box: 24/24 and the second box stays in your hands with 24.
- [ ] `R` on the bread shelf: you're holding a 10-unit bread box again; the shelf is empty.
- [ ] `Q` drops a box in front of you; it lands on the floor and keeps its count. Drop facing a wall: it lands at your feet.
- [ ] Milk goes in the fridges, tomatoes and onions in the produce crates.
- [ ] Throw a box in the green waste bin: a toast shows the waste in ₹.

In **TestMap**: the fridge starts with 6 **expired** milk. `R` clears it as waste (₹156); stocking fresh milk
into it first is refused (`Expired Milk Packet here - clear it first`).

## Tests

*Window ▸ General ▸ Test Runner*.

- **EditMode** (`Tests/EditMode`): stocking rules (capacity, fixture kinds, locked fixtures, expiry, emptying,
  oldest-expiry merging, a randomised conservation test that units are never created or lost) and the
  catalogue (36 products, 7 licences, prices, store levels; imported assets match the JSON).
  The imported-asset tests are skipped until step 4 above has been run.
- **PlayMode** (`Tests/PlayMode`): the demo loop with real GameObjects: pick up, stock, partial stock,
  wrong fixture, drop and land on the floor, no second box, empty back into a box, can't empty while carrying,
  expired stock to waste, a disabled player drops their box.

## Layout

```
Assets/_Project/
  Scripts/
    Simulation/        MiniMart.Simulation: pure C# rules (no UnityEngine). Inventory/StockRules, Catalogue/...
    Data/              ProductDefinition, FixtureDefinition, ProductCatalogue, Licence/StoreLevel/Upgrade definitions
    Player/            PlayerController (CharacterController), PlayerInputReader (Input System), PlayerRigBuilder
    Interaction/       IInteractable, InteractionController (camera spherecast), CarryController, InteractableHighlight
    World/             ProductBox, ShelfFixture, FixtureStockView, DeliveryPad, WasteBin, grey-box builders
    Core/              GameBootstrap, GameMessages (toasts), SessionStats, SceneNames
    UI/                HudOverlay and MainMenuController (IMGUI placeholders)
    Editor/            Catalogue importer, Sprint 1 scene builder
    Networking/ Persistence/ Platform/ Audio/   empty, for later phases
  ScriptableObjects/_Source/prototype-catalogue.json   data extracted from the prototype's game.js
  Tests/EditMode, Tests/PlayMode
Docs/  BehaviourSpec.md, CodingConventions.md
```

Rules live in `MiniMart.Simulation` so the future multiplayer host can run them authoritatively and tests
can cover them without a scene. MonoBehaviours call into it; they never decide stock changes themselves.

## First open: what might need fixing

This was written and syntax-checked without a Unity Editor or C# compiler, so it has not been compiled.
Likely spots if something breaks:

- **Input System not active** → errors in `PlayerInputReader`. Fix with step 3.
- **Package versions**: `Rigidbody.linearVelocity` is Unity 6 API (guarded by `UNITY_6000_0_OR_NEWER`).
- **Pink materials** → the project isn't on URP. The scene builder looks for `Universal Render Pipeline/Lit` and
  falls back to `Standard`.
- **Text on fixtures/boxes is mirrored** → flip the label's Y rotation in `FixtureBuilder` / `ProductBox.BuildPrimitive`.

## Not in Sprint 1 (by design)

Supplier ordering and delivery timer, customers, checkout and payment, economy and day cycle, saving,
multiplayer, real art and audio. See the plan's Phase 2 onwards and `Docs/BehaviourSpec.md` for the rules
they will follow.
