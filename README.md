# MiniMart Mayhem (Unity)

First-person co-op supermarket game, rebuilt in **Unity 6.3 LTS + C#** (URP, Input System) from the browser
prototype in `prototype/`. It ships as a **web build played over LAN**: one PC runs the game server and serves
the page, and everyone, host included, plays in Chrome or Edge.

Governing spec: `Docs/MiniMart_Blueprint.md`. Where the blueprint assumes Steam or a Windows installer,
`Docs/WebAndLAN.md` overrides it. Prototype rules and numbers: `Docs/BehaviourSpec.md`.

This is **Phase 0 + Sprint 1**: walk around a small shop, pick up a delivery box, open it, stock products one
at a time into shelf slots, take stock back, store boxes on a rack, bin empties, and put boxes down safely,
without ever duplicating or losing stock.

Nothing here has been opened in Unity yet: it was written and syntax-checked without an Editor or C# compiler.
Expect to fix a few compile errors on first open (see "First open" below).

## Set up (about 15 minutes)

1. **Unity Hub ▸ Installs**: Unity **6.3 LTS** with the **Web Build Support** module.
2. **New project ▸ Universal 3D** template, named `MiniMartMayhem`. (It sets up URP, the Input System and the
   Test Framework.)
3. Close the Editor. Copy `Assets/_Project`, `Docs`, `README.md`, `.gitignore` and `.gitattributes` into the
   project folder, merging with what's there.
4. Reopen. If Unity asks to enable the new Input System backends, say **Yes**.
   *Project Settings ▸ Player ▸ Active Input Handling* must be **Input System Package (New)** or **Both**.
5. **File ▸ Build Profiles ▸ Web ▸ Switch Platform.**
6. **MiniMart ▸ Set Up Project (layers, web, graphics).** Adds the blueprint's collision layers, applies the web
   player settings (WebGL 2, gzip, run in background) and trims the URP asset for Intel Iris Xe.
7. **MiniMart ▸ Import Prototype Catalogue.** Creates 36 products, 7 categories, 4 fixture types, 4 store levels
   and 9 upgrades under `Assets/_Project/ScriptableObjects`.
8. **MiniMart ▸ Build Scenes.** Creates the prefabs and scenes `00_Bootstrap` … `06_TestNPC` and adds them to
   Build Settings in order.
9. Press **Play** in `03_StoreWorld` (opens automatically).

## Play it in a browser on the LAN

1. **MiniMart ▸ Build Web Player** writes the build to `Builds/Web`.
2. On the PC that will host, serve that folder, for example `npx http-server Builds/Web -p 8080` or
   `python -m http.server 8080 --directory Builds/Web`.
3. On each PC, open `http://<host-ip>:8080` in Chrome or Edge.

Sprint 1 is single-player per browser: the Unity server build that hosts shared games arrives with the
multiplayer proof of concept (blueprint Week 4). See `Docs/WebAndLAN.md`.

## Controls

| Key | Action |
|---|---|
| Click | capture the mouse (browsers need a click before pointer lock) |
| `W` `A` `S` `D` · `Shift` | walk 4.5 m/s · sprint 6.5 m/s (not while carrying) |
| Mouse | look |
| `E` / left-click | pick up a box · stock one unit (hold to repeat) · store on a rack · bin a box |
| `F` | open the box you're carrying |
| `R` | carrying: take one unit back into your box · empty-handed: empty the slot you're looking at into a box (expired stock goes to waste) |
| `Q` / right-click | put the box down (only where there's room) |
| `Esc` | free the mouse |

## Sprint 1 checklist (do these in the Editor)

In **03_StoreWorld**:

- [ ] You start in the storage room facing the yellow delivery pad with 11 boxes on it.
- [ ] Look at a box: it brightens and the prompt says `[E] Pick up Bread Loaf box (10)`.
- [ ] Pick it up; walking is slower and you can't sprint. Look at a shelf: `Open the box first [F]`.
- [ ] Press `F`: the lid comes off. Look at a shelf slot: `[E] Stock Bread Loaf (0/4)`. Press E: one loaf appears.
      Hold E: loaves keep going in until the slot is full, then the next press needs another slot.
- [ ] Look at a fridge: `Bread Loaf goes in a shelf` (can't do it).
- [ ] Aim at a slot holding bread with an open cola box: `This slot holds Bread Loaf`.
- [ ] Empty the bread box: it stays in your hands as an empty box. Throw it in the green waste bin.
- [ ] Empty-handed, `R` on a stocked slot: you're holding an open box with that stock; the slot is empty.
- [ ] Carry a sealed box to the blue storage rack: `[E] Store Cola Can box`. It snaps into place; pick it up again.
- [ ] `Q` drops a box in front of you; it lands, settles and keeps its count. Face a wall up close and press `Q`:
      `No room to put the box down here`, and the box stays in your hands.
- [ ] Milk goes in the fridges, tomatoes and onions in the produce crates.

In **05_TestPhysics**: the fridge starts with 6 **expired** milk across three slots. `R` on each slot clears it
as waste (₹52 a slot); fresh milk goes into the other slots, never onto the expired ones. Try dropping boxes
in the corner, in the doorway, against the step and on the steep ramp (refused), and pick boxes off the stack.

## Tests

*Window ▸ General ▸ Test Runner*.

- **EditMode** (`Tests/EditMode`): slot layouts and capacities, one-unit stocking and slot choice, box states
  and allowed moves, take-back, emptying (good stock to a box, expired to waste), freshness merging, shoppers
  never taking expired stock, unit conservation, and the catalogue (36 products, 7 categories, barcodes, store
  levels; imported assets match the JSON, skipped until step 7 has been run).
- **PlayMode** (`Tests/PlayMode`): the loop with real GameObjects: open before stocking, one unit per press into
  the aimed slot, empty box stays in hand until binned, wrong slot or fixture refused, take one back, empty a
  slot, clear expired stock, storage rack, drop settles to kinematic, no room by walls, a leaving player drops
  their box.

## Layout (blueprint §17.4)

```
Assets/_Project/
  Scripts/
    Simulation/   MiniMart.Simulation: pure C# rules (no UnityEngine). Inventory/StockRules, BoxContents, FixtureStock
    Core/         GameBootstrap, SceneNames, SceneLoader, GameLayers, GameMessages, SessionStats
    Player/       PlayerController, PlayerInputReader, PlayerRigBuilder
    Interaction/  IInteractable, PlayerInteractionController, InteractableHighlight
    Physics/      CarryController, DropPlacement   (namespace MiniMart.Handling, see CodingConventions)
    Inventory/    ProductBoxController, StorageSlot, StorageRackBuilder, DeliveryPad, WasteBin, ProductBoxFactory
    Products/     ProductDefinition, ProductCategoryDefinition, ProductCatalogue, ProductView
    Fixtures/     FixtureDefinition, ShelfFixture, ShelfSlot, FixtureBuilder
    Progression/  StoreLevelDefinition, UpgradeDefinition
    UI/           HUD, main menu, lobby, loading screen (IMGUI placeholders)
    World/        ProtoBuilder (grey-box helpers)
    Editor/       ProjectSetup, CatalogueImporter, SceneBuilder
    Checkout/ Customers/ Employees/ Economy/ Incidents/ Networking/ Audio/ Persistence/ Platform/   for later
  Settings/Resources/Input/MiniMartControls.inputactions
  ScriptableObjects/  Products, Categories, Fixtures, StoreLevels, Upgrades, … and _Source/prototype-catalogue.json
  Art/ Audio/ Prefabs/ Scenes/
  Tests/EditMode, Tests/PlayMode, Tests/Multiplayer
Docs/  MiniMart_Blueprint.md, WebAndLAN.md, BehaviourSpec.md, CodingConventions.md, the MVP plan
prototype/  the original Node/Three.js prototype, untouched
```

Rules live in `MiniMart.Simulation` so the server can run them authoritatively and tests can cover them
without a scene. MonoBehaviours call into it; they never decide stock changes themselves.

## First open: what might need fixing

- **Input System not active** → errors in `PlayerInputReader`. Fix with step 4.
- **`MiniMartControls` not found** → the `.inputactions` file must stay under a `Resources` folder.
- **URP types missing in `ProjectSetup`** → the project isn't on URP; recreate it from the Universal 3D template.
- **Layer warnings** → run step 6. Missing layers fall back to Default, so the game still runs.
- **Text on fixtures, boxes or the rack is mirrored** → flip the label's Y rotation in the builder that made it.

## Not in Sprint 1 (by design)

Supplier ordering and the delivery timer, customers, checkout and payment, economy and day cycle, saving,
multiplayer, real art and audio. Next is the blueprint's **Target A**: one customer walking a NavMesh, a checkout
lane with scanning, cash payment and a receipt, and basic sound.
