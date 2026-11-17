# MiniMart Mayhem
## Professional Unity & C# Game Design and Production Blueprint

**Document version:** 1.0  
**Date:** 17 November 2026  
**Target engine:** Unity 6.3 LTS  
**Primary language:** C#  
**Rendering pipeline:** Universal Render Pipeline (URP)  
**Target platform:** Windows PC / Steam  
**Game format:** First-person, co-operative supermarket management simulation  
**Initial multiplayer target:** Up to 8 players  
**Project status:** Existing browser-based Three.js prototype being migrated to Unity

---

# 1. Executive Overview

## 1.1 Game vision

MiniMart Mayhem is a first-person cooperative supermarket management game in which players build, operate and expand their own retail business.

Players begin with a small neighbourhood shop. They order products, unload deliveries, organise storage, stock shelves, set prices, serve customers, operate checkout counters, manage employees and deal with everyday store problems.

As the business grows, players unlock more products, expand the building, add new departments, hire employees and improve store operations.

The experience should feel physical and entertaining. Players should be able to pick up boxes, carry products, place items on shelves, move around the store, work together at the checkout and watch customers interact with the environment.

The game should combine:

- The satisfying physical interactions of a first-person simulation.
- The progression and business-management loop of a retail tycoon game.
- The unpredictable situations of a cooperative multiplayer game.
- A detailed, visually appealing supermarket environment.
- A humorous but believable retail atmosphere.

The goal is not to reproduce another game's code, maps, art or proprietary mechanics. Supermarket Together is a useful reference for the broader cooperative supermarket-management genre, but MiniMart Mayhem should have its own identity, interface, environments, assets, balancing and implementation.

## 1.2 Core design pillars

### Pillar 1 — Physical interaction

Important shop activities should happen inside the 3D world.

Players should physically:

- Pick up product boxes.
- Carry deliveries.
- Unpack products.
- Stock shelves.
- Organise storage.
- Pick up dropped objects.
- Clean spills.
- Scan products.
- Handle checkout transactions.
- Interact with doors, equipment and store facilities.

Menus should support management tasks, but they should not replace every physical interaction.

### Pillar 2 — Cooperative gameplay

Every major role should contribute to the operation of the store.

Example team:

- Player 1 manages deliveries and warehouse storage.
- Player 2 stocks shelves and fridges.
- Player 3 manages checkout.
- Player 4 handles cleaning, customers and store problems.

Players should be able to change roles at any time.

### Pillar 3 — A believable supermarket

The store must look like a place customers could realistically shop in.

Fixtures, products, price labels, checkout counters, lighting, storage, signs and decoration should feel connected.

The visual quality of the shop is a major part of the experience. A fully stocked supermarket should look considerably more impressive than the initial corner shop.

### Pillar 4 — Progression that changes gameplay

Upgrades should create new activities, not just increase numbers.

Examples:

- More licences introduce new product categories.
- Larger storage areas improve delivery management.
- More checkout counters reduce waiting time.
- Cashier employees automate checkout.
- CCTV helps detect theft.
- Refrigeration enables chilled products.
- Freezers unlock frozen products.
- Store expansion introduces new layouts and customer capacity.

### Pillar 5 — Readable, reliable simulation

The simulation should be complex enough to feel alive, but not so complicated that players cannot understand it.

Every important system should communicate:

- What is happening?
- Why is it happening?
- What can the player do?
- What will happen if the player ignores it?

---

# 2. Existing Prototype — Features to Preserve

The existing project is a browser-based 3D multiplayer prototype using Three.js, Node.js and WebSockets.

The migration should preserve the useful gameplay design and simulation behaviour while rebuilding the rendering, interaction, physics and networking layers for Unity.

## 2.1 Existing project structure

The reviewed archive contains:

- `game.js` — Core game simulation.
- `server.js` — Server-side multiplayer functionality.
- `public/client.js` — Browser client logic.
- `public/scene.js` — Three.js scene construction.
- `public/packaging.js` — Product packaging.
- `public/props.js` — Environment objects and props.
- `public/style.css` — Browser interface styling.
- `game.test.js` — Simulation tests.
- `bots.js` — Automated player/test support.
- `ui.js` — Interface tests.
- `play.js` — Gameplay test support.
- Screenshots showing the shop floor, aisles, fridges, checkout, produce section, car park and nighttime environment.

These files should be treated as the original design reference. Their game rules and content should be reviewed before replacing them with new implementations.

## 2.2 Existing store layout

The initial corner shop contains:

| Fixture | Starting quantity |
|---|---:|
| Shelves | 8 |
| Fridges | 2 |
| Produce stands | 2 |
| Checkout counters | 2 |

The fully expanded prototype layout supports:

| Fixture | Expanded quantity |
|---|---:|
| Shelves | 56 |
| Fridges | 19 |
| Freezers | 4 |
| Produce stands | 8 |
| Checkout lanes | 6 |

These values are the existing prototype's design targets. They should not automatically become the final Unity limits. Performance testing and the actual store layout will determine the final limits.

## 2.3 Existing store zones

The original design includes:

1. Sales floor.
2. Storage room.
3. Delivery area.
4. Pallet and storage racking.
5. Order terminal.
6. Waste bin.
7. Notice board.
8. Checkout area.
9. Glass storefront.
10. Sliding entrance doors.
11. Exterior parking.
12. Cars and trolley corral.
13. Trees, street lights and road.

The Unity version should preserve these spaces and improve their visual presentation.

## 2.4 Existing product system

The prototype contains 36 products across seven product lines:

1. Daily Essentials.
2. Kitchen Staples.
3. Personal Care.
4. Dairy & Fruit.
5. Breakfast & Treats.
6. Frozen Foods.
7. Premium / Imported.

Packaging formats include:

- Cans.
- Bottles.
- Jars.
- Instant noodle cups.
- Chips bags.
- Milk pouches.
- Flour sacks.
- Juice cartons.
- Egg cartons.
- Packaged blocks.
- Tubs.
- Pizza boxes.
- Individual produce items.

Produce models include apples, tomatoes, onions, potatoes and bananas.

Product artwork includes front and side labels, size information, vegetarian marking, nutrition or directions, best-before date, MRP and barcode.

**Important:** Keep the existing fictional brand and product identity. Do not replace the Indian-inspired retail theme with generic foreign products unless a later design decision explicitly changes the direction.

## 2.5 Existing management and gameplay systems

The following features are part of the existing design and should be carried into the Unity specification:

- Product ordering.
- Product pricing.
- Supplier deliveries.
- Product licences.
- Inventory.
- Shelf restocking.
- Storage management.
- Customer browsing.
- Customer queues.
- Manual checkout.
- Automated cashiers.
- Cash payments.
- Card payments.
- UPI payments.
- Cash drawer and change.
- Receipt generation.
- Shoplifting.
- Cleaning and spills.
- Product freshness and expiry.
- Daily rent and wages.
- Store upgrades.
- Staff hiring.
- Store progression.
- Weather.
- Time progression.
- Save and load.
- Multiplayer crew management.

## 2.6 Existing store progression

| Level | Store stage | New facilities / additions | Daily customer target |
|---|---|---|---:|
| 1 | Corner Shop | 8 shelves, 2 fridges, 2 produce stands, tills 1–2 | 34 |
| 2 | Mini Market | +10 shelves, +3 fridges, +2 produce stands, tills 3–4 | 60 |
| 3 | Supermarket | +20 shelves, chilled wall with +7 fridges, 4 freezers | 92 |
| 4 | Superstore | +18 shelves, +7 fridges, +4 produce stands, tills 5–6 | 130 |

The daily customer numbers are balancing targets from the prototype, not a guarantee of the number of NPCs that must be rendered or simulated simultaneously.

---

# 3. Scope and Development Priorities

A common mistake in simulation games is attempting to develop the entire store before the basic gameplay is enjoyable.

The Unity migration should be divided into three clear targets.

## 3.1 Target A — Vertical Slice

This is the first fully playable test environment.

It should contain:

- One small supermarket section.
- One player.
- One shelf.
- One product.
- One delivery box.
- One storage position.
- One customer.
- One checkout lane.
- One working payment.
- Basic lighting and sound.

The player must be able to:

1. Receive a delivery.
2. Pick up a box.
3. Carry it.
4. Open or unpack it.
5. Take a product.
6. Stock the shelf.
7. Watch a customer select the product.
8. Process that customer through checkout.
9. Receive money.
10. See inventory update correctly.

The vertical slice is complete only when this sequence works reliably.

Do not create dozens of finished products, advanced NPCs or the full store before this loop works.

## 3.2 Target B — MVP

The Minimum Viable Product should contain:

- One complete supermarket map.
- Initial corner shop and upgradeable store areas.
- Sales floor.
- Storage room.
- Exterior and delivery area.
- 36 products.
- Seven product licences.
- Four progression levels.
- Shelves, fridges, freezers and produce stands.
- Product delivery and physical stocking.
- Customer browsing and checkout queues.
- Manual checkout.
- Cash, card and UPI payments.
- Basic cashier automation.
- Employee management.
- Theft and CCTV.
- Cleaning and spills.
- Product freshness and expiry.
- Store opening and closing.
- Day and night cycle.
- Economy, rent and wages.
- Save/load.
- Basic weather.
- Co-op multiplayer for up to 8 players.
- Settings, HUD, minimap and management interfaces.

The initial release should have fewer systems working properly rather than many unfinished systems.

## 3.3 Target C — Post-MVP

Possible future features:

- Larger online sessions.
- More product categories.
- More store maps.
- Additional departments.
- Self-checkout.
- Advanced employee roles.
- More detailed staff progression.
- Advanced build mode.
- Additional vehicles.
- More exterior locations.
- Special events.
- Seasonal products.
- More weather effects.
- Online customer package preparation.
- Additional store customisation.
- More sophisticated NPC behaviour.

Do not allow post-MVP features to delay the first complete and enjoyable game.

---

# 4. Gameplay Design

## 4.1 Main gameplay loop

The main gameplay loop is:

**Prepare → Order → Receive → Store → Stock → Open → Serve → Close → Review → Expand**

### Preparation phase

Before opening, players can:

- Review stock levels.
- Place supplier orders.
- Move boxes into storage.
- Restock shelves.
- Change product prices.
- Assign employees.
- Repair equipment.
- Clean the store.
- Configure checkout lanes.

### Business phase

When the store opens:

- Customers enter.
- Customers browse.
- Customers select products.
- Customers may ask for assistance.
- Customers join checkout queues.
- Players and employees process purchases.
- Some customers may steal products.
- Spills and operational problems may occur.
- Stock levels decline.

### Closing phase

At closing time:

- New customer entry stops.
- Remaining customers finish shopping.
- Checkout lanes complete existing transactions.
- Daily revenue is calculated.
- Lost inventory and theft are calculated.
- Rent and wages are charged.
- Expired products are identified.
- Daily statistics are displayed.

### Progression phase

Players use available money and progression rewards to:

- Unlock licences.
- Purchase upgrades.
- Expand the building.
- Hire staff.
- Buy equipment.
- Increase the range of products.

## 4.2 Store operating hours

The existing prototype operates from 08:00 to 22:00.

Preserve that schedule as the initial default.

The time system must distinguish:

- Real multiplayer session time.
- In-game clock time.
- Store opening state.
- Customer arrival schedules.
- Daily settlement time.

Do not use `Time.timeScale` as the only source of business time. Multiplayer time should be controlled by the authoritative game session.

## 4.3 Store states

The store should have these states:

| State | Behaviour |
|---|---|
| Setup | Players prepare stock, orders and fixtures |
| Opening | Doors open and customer entry begins |
| Open | Normal customer simulation |
| Busy | High demand and queue pressure |
| Closing | New entry stops |
| Settlement | Daily financial results are calculated |
| Overnight | Freshness, wages and scheduled events are processed |

State transitions must be controlled by the server/host in multiplayer.

---

# 5. World and Scene Architecture

## 5.1 Unity scene strategy

Use a persistent bootstrap scene and load the store world separately.

Recommended scene structure:

```text
Assets/
  _Project/
    Scenes/
      00_Bootstrap.unity
      01_MainMenu.unity
      02_Lobby.unity
      03_StoreWorld.unity
      04_Loading.unity
      05_TestPhysics.unity
      06_TestNPC.unity
```

The main store world can be organised into reusable sections or additive scene content when the project grows.

Do not create a separate Unity scene for every aisle. Aisles should generally be prefab-based components within the store world.

## 5.2 Bootstrap scene

Purpose:

- Initialise settings.
- Load configuration.
- Initialise audio.
- Initialise save services.
- Prepare networking services.
- Load the main menu.

Important objects:

- `GameBootstrap`
- `AudioManager`
- `SettingsManager`
- `SaveManager`
- `NetworkSessionManager`
- Loading screen canvas
- Application event system

The bootstrap scene should not contain the actual supermarket geometry.

## 5.3 Main menu scene

Required interface:

- Play.
- Host Game.
- Join Game.
- Server browser or invite flow.
- Settings.
- Credits.
- Exit.

Visual direction:

The menu should show a stylised supermarket environment, preferably with a subtle animated camera or background activity.

Avoid a plain default Unity canvas.

## 5.4 Lobby scene

Required functionality:

- Player list.
- Host indicator.
- Ready state.
- Session information.
- Invite friends.
- Start session.
- Return to main menu.

The host chooses the game session settings.

The lobby should verify that the required players have completed loading before gameplay begins.

## 5.5 Store world

The main store should contain these zones:

### A. Exterior

Objects:

- Main building.
- Store sign.
- Glass storefront.
- Entrance doors.
- Exterior windows.
- Parking spaces.
- Cars.
- Road.
- Pavement.
- Trolley bay.
- Trees.
- Shrubs.
- Street lights.
- Outdoor rubbish bin.
- Delivery area.
- Loading door.
- Exterior wall lights.
- Optional neighbouring buildings.

Visual requirements:

- Players should immediately recognise the shop entrance.
- The store name must be readable from outside.
- The interior should be visible through the storefront glass.
- The parking area should have enough space for player movement.
- The delivery zone must be visually distinct from the customer entrance.

### B. Entrance

Objects:

- Sliding glass doors.
- Door sensor.
- Welcome mat.
- Entrance signage.
- Opening-hours sign.
- Shopping baskets.
- Shopping trolleys.
- Promotional display.
- Security camera.

Behaviour:

- Doors open automatically for approaching customers.
- Doors open for players.
- Doors close after a configurable delay.
- Customers cannot enter when the store is closed.
- Emergency/manual door states may be considered later.

### C. Sales floor

This is the main gameplay area.

Objects:

- Gondola shelves.
- Wall shelves.
- End-cap shelves.
- Corner shelves.
- Promotional displays.
- Product boxes.
- Price tags.
- Promotional tags.
- Floor markings.
- Aisle signs.
- Hanging signs.
- Ceiling lights.
- Ceiling vents.
- Decorative plants.
- Shopping baskets.
- Shopping trolleys.
- CCTV cameras.
- Customer-service signs.
- Waste bins.

The sales floor must have clear walkways and enough room for customers, players and trolleys.

### D. Checkout zone

Objects:

- Checkout counters.
- Conveyor belts.
- Barcode scanners.
- Customer displays.
- Cash registers.
- Cash drawers.
- Card terminals.
- UPI QR display.
- Receipt printers.
- Bagging areas.
- Queue barriers.
- Promotional impulse-buy racks.
- Checkout lights.
- Checkout identification signs.
- Customer queue markers.

The checkout should be visually recognisable from the entrance and easy to navigate.

### E. Refrigerated section

Objects:

- Upright fridges.
- Chilled wall units.
- Glass doors.
- Internal shelves.
- Internal lights.
- Temperature displays.
- Product price rails.
- Condensation effects.
- Optional refrigeration sound and compressor effects.

Products must be visually distinguishable from ordinary ambient shelves.

### F. Frozen section

Objects:

- Freezer cabinets.
- Glass lids or doors.
- Frozen product baskets.
- Temperature controls.
- Freezer price tags.
- Internal lighting.
- Frost/condensation details.

Frozen food should not be assigned to ordinary shelves.

### G. Produce section

Objects:

- Produce tables.
- Wooden or metal produce crates.
- Loose produce.
- Product labels.
- Digital or printed price signs.
- Produce scales.
- Shopping bags.
- Waste containers.
- Decorative greenery.

Produce should use individual models or grouped displays, rather than only rectangular product boxes.

### H. Storage room

Objects:

- Pallet racks.
- Storage shelves.
- Delivery boxes.
- Pallets.
- Floor storage markers.
- Ordering terminal.
- Stock overview board.
- Waste bin.
- Fire extinguisher.
- Staff-only signs.
- Loading door.
- Ceiling lights.
- Floor markings.
- Optional trolley and hand truck.

This space should communicate that deliveries and inventory are managed here.

### I. Manager office

Recommended for the later MVP stage.

Objects:

- Desk.
- Chair.
- Computer.
- Monitor.
- Keyboard.
- Telephone.
- Filing cabinet.
- Notice board.
- Clock.
- Store plans.
- Financial reports.
- Staff schedule display.
- Decoration.

Functions:

- Staff management.
- Store financial summary.
- Product and supplier reports.
- Upgrade overview.
- Store progression.

### J. Staff room

Optional for the first MVP, but useful for future immersion.

Objects:

- Lockers.
- Bench.
- Table.
- Chairs.
- Refrigerator.
- Water dispenser.
- Clock.
- Notice board.
- Staff schedule.

It does not need complex gameplay in the first release.

---

# 6. Complete Object and Asset Catalogue

Every environment object should have an asset definition, prefab owner and interaction classification.

## 6.1 Player

Required objects:

- First-person camera.
- Player body.
- Arms.
- Hands.
- Walking animation.
- Sprinting animation.
- Carrying animation.
- Interaction animation.
- Scanner-holding animation.
- Cleaning animation.
- Pickup/drop animation.
- Footstep audio.
- Interaction audio.

Required components:

- `CharacterController` or a deliberately designed Rigidbody controller.
- Camera.
- Input handler.
- Interaction controller.
- Carry controller.
- Player network identity.
- Audio emitter.
- Player state component.

Do not allow the camera and player body to fight over the same movement authority.

## 6.2 Products

Every product should be data-driven.

Each SKU should define:

- Unique product ID.
- Display name.
- Product category.
- Licence requirement.
- Purchase cost.
- Selling price.
- MRP.
- Package type.
- Package dimensions.
- Package mass class.
- Shelf compatibility.
- Storage compatibility.
- Cold-storage requirement.
- Expiry/freshness data.
- Barcode.
- Product icon.
- Product model/prefab.
- Product material set.
- Box quantity.
- Supplier information.

Product prefab examples:

| Package type | Recommended visual representation |
|---|---|
| Can | Cylindrical metal can |
| Bottle | Bottle with cap and label |
| Jar | Glass or plastic jar |
| Noodle cup | Tall cylindrical cup |
| Chips | Flexible bag with inflated silhouette |
| Milk pouch | Soft pouch with folded top |
| Flour | Rectangular or sack-shaped bag |
| Juice | Carton or bottle |
| Eggs | Moulded egg carton |
| Block | Rectangular wrapped package |
| Tub | Plastic tub with lid |
| Pizza | Flat cardboard box |
| Produce | Individual fruit/vegetable model |

Do not use one generic box model for every product. Package silhouettes are important to visual recognition.

## 6.3 Product boxes

Every product box should define:

- Product ID.
- Quantity.
- Box dimensions.
- Weight class.
- Brand artwork.
- Delivery label.
- Box condition.
- Opening state.
- Remaining quantity.
- Storage compatibility.

Visual details:

- Printed brand/logo area.
- Product name.
- Quantity.
- Barcode or delivery code.
- Cardboard seams.
- Tape.
- Shipping symbols.
- Slightly varied cardboard material.

Possible interaction states:

`Delivered → On Ground → Held → Stored → Opened → Empty → Discarded`

A product box should not be represented by dozens of independently simulated rigidbodies.

## 6.4 Shelving fixtures

Prefab types:

- Single-sided gondola.
- Double-sided gondola.
- Wall shelf.
- End-cap shelf.
- Corner fixture.
- Half-height display.
- Promotional island.

Every fixture should have:

- Frame model.
- Shelves.
- Shelf edge.
- Price rail.
- Mounting points.
- Product slot positions.
- Interaction bounds.
- Optional signage.
- Optional decoration points.

Products should be placed using predefined fixture slots. Do not make every shelf placement depend on free physical stacking.

## 6.5 Checkout equipment

Each checkout prefab should consist of modular elements:

1. Counter body.
2. Conveyor belt.
3. Scanner.
4. Customer display.
5. Cash register.
6. Cash drawer.
7. Card reader.
8. UPI payment display.
9. Receipt printer.
10. Bagging section.
11. Checkout light.
12. Queue guide.

The scanner should provide:

- Visual scan feedback.
- Barcode confirmation.
- Scan sound.
- Valid product state.
- Invalid product feedback.
- Price display.

The conveyor belt should visually move products toward the bagging area. It does not need a fully physical conveyor simulation. Use a controlled animation path.

## 6.6 Shopping equipment

Objects:

- Shopping basket.
- Shopping trolley.
- Trolley handle.
- Basket handle.
- Wheel assemblies.
- Optional trolley child seat.
- Trolley parking area.

A trolley should use stable movement and collision behaviour. Do not simulate every wheel independently unless there is a strong gameplay reason.

## 6.7 Cleaning objects

Objects:

- Mop.
- Mop bucket.
- Spill decal.
- Cleaning particles.
- Wet-floor sign.
- Floor bin.
- Waste container.
- Cleaning station.

A spill should have:

- Spawn position.
- Spill type.
- Radius.
- Severity.
- Visual decal.
- Customer satisfaction effect.
- Cleaning progress.
- Completion state.

The mop animation should visually correspond to the cleaning action.

## 6.8 Security objects

Objects:

- CCTV camera.
- CCTV monitor.
- Door alarm.
- Security signage.
- Optional security desk.
- Incident alert icon.

CCTV should be a gameplay system, not only a decorative prop.

It should influence detection or incident reporting through defined simulation rules.

## 6.9 Decoration and world props

Objects:

- Posters.
- Promotional banners.
- Hanging aisle signs.
- Wall clocks.
- Plants.
- Ceiling fans or vents.
- Lights.
- Wall panels.
- Electrical boxes.
- Fire extinguishers.
- Floor mats.
- Rubbish bins.
- Cleaning signage.
- Store logo.
- Exterior advertising panels.

Decoration should improve visual quality without creating unnecessary collision and rendering cost.

---

# 7. Visual Direction and Art Bible

## 7.1 Recommended art direction

Use **stylised realism**.

The game should look like a recognisable supermarket, but it does not need photorealistic assets.

Recommended balance:

- Realistic object proportions.
- Clean readable geometry.
- High-quality product labels.
- Attractive lighting.
- Detailed materials.
- Slightly exaggerated visual feedback.
- Readable colour and shape differences.
- Consistent object scale.

Avoid extremely low-poly visuals, flat unlit surfaces and placeholder packaging in the commercial build.

## 7.2 Scale standards

Use:

**1 Unity unit = 1 metre.**

These are initial design standards for MiniMart Mayhem, not measurements copied from the reference game.

| Object | Starting dimensions |
|---|---|
| Human character | 1.65–1.85 m tall |
| Door | 2.1–2.3 m high |
| Main aisle | 2.0–2.4 m wide |
| Secondary aisle | 1.5–1.8 m wide |
| Standard shelf | 1.8–2.1 m high |
| Checkout counter | 0.85–0.95 m high |
| Ceiling | 3.0–3.6 m high |

Validate these dimensions with a player controller and NPCs before creating the final store.

## 7.3 Product visual quality

A product should be recognisable from normal gameplay distance.

Required standards:

- Unique silhouette.
- Correct package proportions.
- Clear front-facing brand artwork.
- Side artwork where visible.
- Readable colour palette.
- Correct price information.
- Barcode placement.
- Product category identity.
- Appropriate roughness and gloss.

Text-heavy packaging does not need to be legible from across the store. The package must be recognisable from a normal shelf-viewing distance.

## 7.4 Shelf presentation

A shelf should look stocked, not randomly populated.

Rules:

- Align products consistently.
- Keep package fronts facing outward.
- Use a coherent row structure.
- Avoid visible intersections.
- Use slightly varied placement only where appropriate.
- Make empty spaces easy to identify.
- Place price labels below or close to the matching product.
- Use promotional labels sparingly.

## 7.5 Interior lighting

The supermarket should have bright, comfortable retail lighting.

Use:

- URP-compatible lighting.
- Baked lighting for static architecture where appropriate.
- Realtime lighting only where required.
- Reflection probes in suitable zones.
- Light probes for moving characters and props.
- Emissive materials for signs and displays.
- Soft shadowing.
- Controlled exposure.

Avoid making every ceiling light a costly realtime shadow-casting light.

## 7.6 Exterior lighting

The exterior should feel different from the interior.

During the day:

- Natural daylight.
- Soft shadows.
- Window reflections.
- Visible parking.
- Exterior sign.

At night:

- Darker environment.
- Lit storefront.
- Entrance lights.
- Street lamps.
- Interior light visible through glass.
- Optional OPEN sign.

The nighttime store should feel inviting rather than completely dark.

## 7.7 Weather

The existing prototype includes:

- Clear.
- Rain.
- Festival.
- Heatwave.

Recommended Unity presentation:

| Condition | Visual / audio changes |
|---|---|
| Clear | Bright daylight and normal ambience |
| Rain | Rain particles, wet ground, rain audio |
| Festival | Decorative elements and optional event lighting |
| Heatwave | Stronger sunlight, warmer colour ambience, optional demand modifiers |

Weather should not change business values randomly without a clear gameplay rule.

---

# 8. Player Controller and Interaction Design

## 8.1 Player movement

Required movement:

- Walk.
- Sprint.
- Look.
- Interact.
- Pickup.
- Drop.
- Carry.
- Use equipment.
- Scan.
- Clean.
- Open management interfaces.

Movement should feel responsive and predictable.

Initial tuning targets:

| Setting | Starting target |
|---|---:|
| Walk speed | 4.5 m/s |
| Sprint speed | 6.5 m/s |
| Camera height | 1.65 m |
| Interaction reach | 2.5 m |
| Interaction ray width | Small, configurable |
| Camera sensitivity | Configurable |

These are initial tuning values and must be play-tested.

Use the Unity Input System and create action maps for:

- Gameplay.
- UI.
- Vehicle/trolley interaction, if introduced.
- Menu.

Support keyboard and mouse first. Controller support should be designed into the action map even if its full tuning comes later.

## 8.2 Interaction system

Use a central interaction interface.

Conceptual C# interface:

```csharp
public interface IInteractable
{
    string GetInteractionPrompt();
    bool CanInteract(PlayerInteractionContext context);
    void Interact(PlayerInteractionContext context);
}
```

An object should provide a prompt based on its state.

Examples:

- Pick up box.
- Stock shelf.
- Open order terminal.
- Use checkout.
- Clean spill.
- Open cash drawer.
- Change price.
- Interact with CCTV.

Do not hardcode all object logic inside the player controller.

## 8.3 Interaction priority

When multiple objects are in range, choose the best valid target.

Recommended priority:

1. Object directly in the centre of the view.
2. Valid object within interaction range.
3. Object with the smallest viewing angle.
4. Nearest valid object as a tie-breaker.

The player should never receive prompts for objects through solid walls.

## 8.4 Pickup and carry system

Pickup sequence:

1. Player aims at an object.
2. Interaction prompt appears.
3. Player presses interact.
4. Server validates object state and range.
5. Object changes to held state.
6. Object attaches to the carry anchor.
7. Carry animation plays.
8. Held object becomes visible and consistent for other players.

Carry rules:

- One main carried object at a time for the MVP.
- Product boxes should be heavier than individual products.
- Carrying should not block the camera.
- Held objects should not collide unpredictably with the player.
- The object should remain stable during normal movement.

## 8.5 Drop system

When the player drops an object:

1. The host validates the action.
2. The carry state clears.
3. The object is detached.
4. It is placed at a safe drop position.
5. Dynamic physics is enabled only when needed.
6. The object settles.
7. The final position is synchronised.

Prevent objects from being dropped inside walls, beneath the floor or inside inaccessible fixtures.

## 8.6 Interaction feedback

Every important action should have at least two feedback channels:

- Visual.
- Audio.
- UI text.
- Animation.
- Controller vibration, where supported.

Examples:

| Action | Feedback |
|---|---|
| Pickup | Hand animation and pickup sound |
| Drop | Drop animation and impact sound |
| Successful stock | Product snaps into slot and inventory updates |
| Invalid stock | Clear message and no inventory loss |
| Scan | Barcode flash and scanner beep |
| Payment | Payment confirmation animation |
| Out of stock | Empty shelf visual and stock warning |
| Cleaning | Spill gradually disappears |

---

# 9. Physics and Collision Architecture

## 9.1 Core physics philosophy

Do not use full physics simulation for every object in the supermarket.

A supermarket contains potentially hundreds or thousands of visible products. Simulating all of them with active rigidbodies is unnecessary and will create performance and stability problems.

Use three object states.

### State A — Displayed / stored

Used for:

- Products on shelves.
- Products in fridges.
- Products in freezers.
- Products in boxes.
- Products in storage slots.

Behaviour:

- No active dynamic Rigidbody.
- Product position controlled by the fixture or container.
- Product slot is authoritative.
- Collider is disabled or simplified when the object does not need physical interaction.

### State B — Held

Used for:

- Carried product.
- Carried box.
- Held equipment.

Behaviour:

- Object follows a carry anchor.
- Physics is disabled or kinematic.
- Collision with player is suppressed.
- Held state is synchronised.

### State C — Dropped / dynamic

Used for:

- Dropped boxes.
- Dropped products.
- Loose movable equipment where necessary.

Behaviour:

- Rigidbody enabled.
- Collision enabled.
- Gravity enabled.
- Object settles.
- Server validates final location.

This approach provides physical interaction without simulating every product continuously.

## 9.2 Object-specific physics

| Object | Physics approach |
|---|---|
| Store architecture | Static colliders |
| Walls and floors | Static colliders |
| Shelving | Static or simplified colliders |
| Products on shelf | Slot-based, no dynamic physics |
| Product held by player | Kinematic / carry anchor |
| Product dropped on floor | Rigidbody while settling |
| Delivery box on floor | Rigidbody or stable placement |
| Delivery box carried | Kinematic |
| Trolley | Stable constrained movement |
| Shopping basket | Simple collider and controlled movement |
| Door | Animated / controlled sliding movement |
| Customer | NavMesh movement with collider |
| Checkout belt product | Animated along a fixed path |
| Spill | Trigger/decal-based interaction |
| Price tag | Static fixture child |

## 9.3 Collision layers

Create explicit Unity layers.

Suggested layers:

- `World`
- `Player`
- `PlayerInteraction`
- `NPC`
- `Product`
- `ProductBox`
- `Fixture`
- `Checkout`
- `Trolley`
- `Trigger`
- `Decoration`
- `UI`

Configure the Physics collision matrix intentionally.

Examples:

- Decoration does not need to collide with products.
- Held products should not collide with the carrying player.
- Interaction rays should ignore irrelevant decorative objects.
- NPCs should not be blocked by invisible trigger volumes.
- Product collisions should be simplified where possible.

## 9.4 Shelf placement

Use named product slots.

Each fixture should have a collection of slots.

Each slot should define:

- Position.
- Rotation.
- Product compatibility.
- Capacity.
- Occupancy.
- Price label position.
- Optional front-facing direction.

When a player stocks a product:

1. Validate the fixture.
2. Validate the product type.
3. Validate available capacity.
4. Consume one unit from the carried source.
5. Assign the product to a valid slot.
6. Update inventory.
7. Update the visual model.
8. Confirm the action to all players.

Use snapping rather than freehand placement as the default.

A later advanced placement mode may allow finer decoration.

## 9.5 Box opening

When a player opens a box:

- The box state changes.
- The contents become accessible.
- The remaining quantity decreases as products are removed.
- The box displays its remaining quantity where appropriate.
- Empty boxes can be discarded or recycled.

Do not create a separate network object for every item inside a box unless the player actually removes that item.

## 9.6 Trolley behaviour

Trolleys should be fun to use but not physically chaotic.

Recommended:

- Controlled forward movement.
- Turn smoothing.
- Stable wheel presentation.
- Limited acceleration.
- Controlled collision.
- Network interpolation.
- Optional basket capacity.

Avoid high-friction, multi-Rigidbody wheel systems for the first version.

## 9.7 Door behaviour

Use a controlled sliding animation or motor-like movement.

The door should:

- Detect approaching players and customers.
- Open.
- Remain open while the entrance is occupied.
- Close after a delay.
- Stop if something blocks it.
- Synchronise its state in multiplayer.

A fully simulated physics door is not required.

## 9.8 Physics test requirements

Create a dedicated `TestPhysics` scene.

Test:

- Pickup from floor.
- Pickup from shelf.
- Drop on flat floor.
- Drop near walls.
- Drop near shelves.
- Drop beside other boxes.
- Box stacking.
- Carrying through doors.
- Carrying around corners.
- Shelf snapping.
- Fridge placement.
- Multiplayer pickup ownership.
- Simultaneous pickup requests.
- Disconnect while carrying an object.

A feature is not complete until these tests pass reliably.

---

# 10. Customer AI

## 10.1 Customer types

Preserve the existing customer categories:

| Type | Gameplay behaviour |
|---|---|
| Regular | Normal browsing and purchasing |
| Rushed | Faster movement and fewer browsing delays |
| Bulk / trolley | Larger shopping list and basket |
| Loyalty | Repeat customer or loyalty-oriented behaviour |

Customer type should influence shopping decisions, movement, purchase quantity and patience.

## 10.2 Customer lifecycle

A customer should follow a state machine.

```text
Spawn
  ↓
Enter Store
  ↓
Select Shopping List
  ↓
Navigate to Product
  ↓
Search Shelf
  ↓
Select Product
  ↓
Continue Shopping?
  ├── Yes → Navigate to Next Product
  └── No  → Find Checkout
                 ↓
              Queue
                 ↓
              Checkout
                 ↓
              Payment
                 ↓
              Exit Store
```

Additional states:

- Waiting for staff assistance.
- Unable to find product.
- Queue abandoned.
- Theft attempt.
- Detected theft.
- Frustrated.
- Leaving store.

## 10.3 Customer shopping logic

The customer should:

1. Receive a shopping list.
2. Identify the required products.
3. Find compatible fixtures.
4. Navigate to a suitable shelf.
5. Check the stock.
6. Select an available product.
7. Add the item to the shopping basket.
8. Continue or move to checkout.

Customer decisions should be based on actual stock availability.

A customer must not purchase a product that does not exist in the store's sellable inventory.

## 10.4 Navigation

Use Unity AI Navigation and NavMesh for customers.

Recommended:

- Static navigation surfaces.
- Baked navigation for the main store.
- Local avoidance where supported.
- Queue positions as explicit targets.
- Waypoints for special movement.
- Recovery when NPCs become stuck.

The store must have enough walking clearance for customer navigation.

Do not rely on random destinations. Customers should navigate to meaningful targets.

## 10.5 Customer performance

Do not run expensive AI logic every frame.

Suggested update approach:

- Movement updates at normal frame or navigation frequency.
- Shopping decisions run on scheduled intervals.
- Distant NPCs use lower-frequency decision updates.
- Inactive NPCs can be simplified.
- NPCs are pooled where practical.

## 10.6 Customer satisfaction

Factors may include:

- Product availability.
- Queue time.
- Cleanliness.
- Store organisation.
- Product pricing.
- Customer assistance.
- Store facilities.

Satisfaction should influence business outcomes through understandable rules.

For example, consistently long queues should reduce satisfaction rather than randomly penalising the business.

---

# 11. Checkout and Payment System

## 11.1 Manual checkout

The player should:

1. Stand at an active checkout.
2. Receive a waiting customer.
3. Move products onto the conveyor or scan point.
4. Scan each product.
5. Review the total.
6. Choose payment method.
7. Complete payment.
8. Provide change if required.
9. Print or display the receipt.
10. Release the customer.

## 11.2 Scan behaviour

Each product scan should:

- Confirm product identity.
- Validate that the product belongs to the customer's basket.
- Read the current selling price.
- Add the line item.
- Update the displayed bill.
- Play scanner audio.
- Provide visible scan feedback.

Prevent duplicate scanning.

The host/server must be responsible for the transaction result.

## 11.3 Payment methods

Preserve:

- Cash.
- Card.
- UPI.

### Cash

The cash drawer contains notes and coins.

The transaction should calculate:

- Total amount.
- Amount received.
- Required change.
- Available denominations.
- Final drawer balance.

The interface should make mistakes understandable. Do not silently complete an invalid payment.

### Card

A simple card-terminal interaction is sufficient for the MVP.

The player can confirm payment and receive success or failure feedback.

### UPI

The player or cashier triggers a simulated UPI payment.

Display:

- QR or payment prompt.
- Pending state.
- Success state.
- Failure state.

This is a fictional in-game payment system, not a real payment integration.

## 11.4 Receipt contents

A receipt should include:

- Store name.
- Date and time.
- Transaction ID.
- Product names.
- Item quantities.
- Individual prices.
- Subtotal.
- GST or tax line if the economy design uses it.
- Total.
- Payment method.
- Amount received.
- Change.
- Thank-you message.

The exact tax rules should be configurable and should not be assumed to represent actual Indian tax compliance.

## 11.5 Checkout queues

Each checkout has a defined queue capacity.

The prototype's capacity and behaviour should be preserved where supported by its existing rules; the Unity version should make queue capacity configurable.

Customers should:

- Choose the nearest open suitable checkout.
- Join an available queue position.
- Respect queue order.
- Leave appropriately when a queue is unavailable or exceeds patience.
- Move to another open checkout where possible.

Use queue markers rather than letting every NPC independently calculate arbitrary waiting positions.

---

# 12. Employee System

## 12.1 Initial employee roles

The existing prototype includes:

- Cashier.
- Stock clerk.

Preserve these roles for the MVP.

Possible later roles:

- Storage worker.
- Security.
- Technician.
- Packaging.
- Manufacturing.

These additional roles are future expansion opportunities, not MVP dependencies.

## 12.2 Cashier

Responsibilities:

- Handle checkout.
- Scan customer baskets.
- Complete payment.
- Release customer.
- Maintain queue throughput.

## 12.3 Stock clerk

Responsibilities:

- Identify low-stock shelves.
- Fetch compatible inventory.
- Restock shelves.
- Return empty boxes to waste or recycling.
- Avoid blocking customers.

## 12.4 Employee management

The manager interface should allow:

- Hiring.
- Firing.
- Assigning role.
- Changing work area.
- Viewing wage.
- Viewing status.
- Viewing experience.
- Enabling/disabling work.

Employees should have visible and understandable working states.

## 12.5 Employee AI architecture

Employees should reuse navigation and interaction systems where possible.

Do not create completely separate AI logic for every job type.

Use shared systems:

- Navigation.
- Task assignment.
- Work priority.
- Interaction.
- Inventory access.
- Work animation.

Each role should implement its own task behaviour.

---

# 13. Economy, Inventory and Progression

## 13.1 Inventory model

Inventory must be split into meaningful locations.

Recommended categories:

- Supplier/delivery inventory.
- Ground boxes.
- Storage inventory.
- Shelf inventory.
- Fridge inventory.
- Freezer inventory.
- Shopping basket inventory.
- Checkout inventory.
- Sold inventory.
- Wasted inventory.
- Expired inventory.

The UI should not display a single stock number if the stock is physically distributed across the store.

## 13.2 Product ordering

The ordering system should support:

- Product selection.
- Product category selection.
- Quantity selection.
- Total order cost.
- Available money.
- Supplier delivery time.
- Delivery location.

The player should be able to see which products are out of stock or running low.

## 13.3 Deliveries

Delivery lifecycle:

```text
Order Created
    ↓
Supplier Processing
    ↓
Delivery Scheduled
    ↓
Delivery Arrives
    ↓
Boxes Spawn at Delivery Zone
    ↓
Players Move Boxes
    ↓
Storage / Shelf
```

Delivery boxes must be tied to the underlying order and inventory data.

A box should not create stock twice when moved or opened.

## 13.4 Pricing

Players should be able to adjust selling prices.

Each product should show:

- Purchase cost.
- Selling price.
- MRP.
- Profit margin.
- Promotion state.

Pricing should influence customer purchasing behaviour in a controlled and understandable way.

## 13.5 Financial settlement

Daily financial reporting should include:

- Gross sales.
- Product cost.
- Profit.
- Rent.
- Employee wages.
- Theft losses.
- Waste losses.
- Upgrade expenditure.
- Order expenditure.
- Final balance.

Keep gross revenue and actual profit separate.

## 13.6 Product freshness

Products that require freshness management should contain:

- Manufacture or delivery date.
- Expiry date.
- Remaining freshness.
- Storage requirement.
- Expiry state.

Freshness should progress using in-game time rather than a frame-by-frame system.

The expired-product behaviour must be explicit:

- Is it unsellable?
- Does it reduce satisfaction?
- Does it require disposal?
- Can it be discounted before expiry?

These rules should be configurable by product category.

## 13.7 Store upgrades

Preserve existing upgrades:

- Card and UPI.
- Faster scanner.
- Air conditioning.
- CCTV and door alarm.
- Express supplier.
- Radio advertisements.
- Deep shelving.
- Cashier hiring.
- Stock clerk hiring.

Every upgrade should have:

- Unique ID.
- Price.
- Prerequisites.
- Description.
- Visual change where relevant.
- Gameplay effect.
- Save-state value.

## 13.8 Progression

Use the existing four-level store progression as the initial structure.

Unlock conditions should consider:

- Business performance.
- Revenue.
- Product availability.
- Store upgrades.
- Product licences.
- Expansion cost.

Avoid requiring players to grind the same task repeatedly without introducing new gameplay.

---

# 14. Theft, Cleaning and Incidents

## 14.1 Shoplifting

Theft should be a clear but unpredictable store-management challenge.

Possible behaviour:

- Customer selects product.
- Customer attempts to conceal or retain an item.
- Customer avoids checkout.
- Security detects or misses the incident.
- Player can intervene.
- Financial loss is calculated if theft succeeds.

Do not copy another game's proprietary theft equations. Implement and balance an original system.

Relevant variables may include:

- Store security level.
- CCTV coverage.
- Customer behaviour type.
- Store progression.
- Time of day.
- Detection chance.
- Player intervention.

## 14.2 CCTV

CCTV should:

- Have a defined coverage area.
- Be placed in valid locations.
- Display a camera status.
- Contribute to theft detection.
- Provide understandable feedback.

A later office monitor may show selected camera feeds, but do not make live multi-camera rendering an MVP dependency.

## 14.3 Cleaning

Spills can appear during store operation.

A spill should:

- Be visible.
- Affect customer satisfaction.
- Be interactable.
- Have a cleaning progress state.
- Disappear on completion.
- Update the shared simulation.

The mop should be a physical tool in the player's hands.

## 14.4 Other incidents

Possible future incidents:

- Equipment malfunction.
- Refrigerator temperature issue.
- Delivery delay.
- Broken shelf.
- Queue congestion.
- Customer complaint.

Only include incidents that connect to an actual gameplay system.

---

# 15. User Interface and HUD

## 15.1 Main HUD

Required elements:

- Crosshair.
- Interaction prompt.
- Current carried item.
- Money.
- Store time.
- Store status.
- Current objective or task.
- Notification area.
- Multiplayer player indicators.

Avoid filling the screen with permanent information.

## 15.2 Inventory interface

Show:

- Product name.
- Category.
- Quantity.
- Storage location.
- Selling price.
- Purchase price.
- Expiry status, where relevant.

## 15.3 Ordering interface

Show:

- Categories.
- Available products.
- Product images.
- Order quantities.
- Cost per item.
- Total order cost.
- Delivery estimate.
- Available funds.

## 15.4 Pricing interface

Show:

- Product name.
- Current price.
- MRP.
- Purchase cost.
- Margin.
- Price adjustment.
- Promotion indicator.

## 15.5 Employee interface

Show:

- Employee name.
- Role.
- Wage.
- Status.
- Assigned area.
- Hire/fire controls.

## 15.6 Checkout UI

Show:

- Customer basket.
- Scanned items.
- Quantity.
- Unit price.
- Total.
- Payment type.
- Payment status.
- Change.

## 15.7 Daily report

Show:

- Customers served.
- Revenue.
- Profit/loss.
- Wages.
- Rent.
- Theft.
- Waste.
- Customer satisfaction.
- Stock shortages.
- Upgrade unlock progress.

## 15.8 Minimap

Preserve the existing minimap concept.

It should show:

- Store outline.
- Player location.
- Other players.
- Important zones.
- Checkout counters.
- Storage.
- Customer locations only if useful.

Do not show every product or every NPC on the minimap.

## 15.9 Controls

Preserve the existing control concepts where practical.

Existing prototype controls include:

| Input | Existing action |
|---|---|
| WASD | Movement |
| Mouse | Look |
| Sprint key | Sprint |
| E / left-click | Interact |
| Q / right-click | Drop |
| R | Empty fixture |
| Space | Scan / checkout |
| Number keys | Cash drawer |
| O / P / U | Ordering, pricing, upgrades |
| Tab | Crew |
| M | Minimap |
| H | Help |
| Enter | Open store |

The Unity implementation should use configurable input actions. Do not hardcode these controls directly into every gameplay script.

---

# 16. Multiplayer Architecture

## 16.1 Multiplayer requirement

The existing prototype is designed for up to 8 players.

Keep 8 players as the initial Unity target.

Do not build for 16 players before the 8-player experience is stable.

## 16.2 Recommended networking model

Use a host-authoritative architecture for the initial release.

The host is responsible for validating and owning important simulation state.

Examples:

- Store money.
- Inventory.
- Product prices.
- Product orders.
- Delivery creation.
- Customer AI.
- Employee AI.
- Checkout transactions.
- Theft outcomes.
- Upgrade state.
- Store progression.
- Day settlement.
- Save state.

Clients submit requests. The host validates them and broadcasts the resulting state changes.

## 16.3 Client requests

Examples:

- Move player.
- Pick up box.
- Drop box.
- Stock product.
- Move box to storage.
- Open terminal.
- Place order.
- Change product price.
- Scan product.
- Select payment.
- Clean spill.
- Hire employee.
- Buy upgrade.

Every important request must be validated.

## 16.4 Validation rules

Validate:

- Player distance.
- Player permissions.
- Object ownership.
- Object state.
- Product compatibility.
- Inventory availability.
- Currency availability.
- Checkout state.
- Transaction status.
- Duplicate requests.
- Whether the store is open or closed.

Never let a client directly set the store balance, inventory quantity or transaction result.

## 16.5 Network object strategy

Not every visible object needs a network identity.

Network important stateful objects:

- Players.
- Carried delivery boxes.
- Important movable items.
- Active equipment where necessary.
- Customer state where it cannot be represented by replicated simulation state.
- Shared interactive fixtures.
- Checkout transactions.

Static products already assigned to shelf slots can often be represented by replicated fixture inventory data and local visual prefabs.

## 16.6 Synchronisation

Use:

- Network variables for persistent shared values.
- RPCs for requests and events.
- Network transforms for suitable player/object movement.
- Host authority for important economy transactions.
- Interpolation for remote player movement.
- Reliable messages for critical state changes.

Do not transmit full world state every frame.

## 16.7 Disconnect handling

Handle:

- Player leaves while carrying a box.
- Host disconnects.
- Client disconnects during checkout.
- Player disconnects during an order.
- Player disconnects while cleaning.
- Reconnection or session rejoin.
- Save recovery.

A disconnect must not duplicate or destroy inventory.

## 16.8 Networking framework selection

Evaluate these options in a short technical prototype:

- Netcode for GameObjects.
- Mirror.
- Fish-Networking.

For a Unity-native workflow, Netcode for GameObjects is a sensible first candidate. Its official documentation lists support for Unity 6 and later.

However, the project should not commit to a networking framework before testing:

- Host migration expectations.
- Eight-player performance.
- Object ownership.
- RPC patterns.
- Physics synchronisation.
- Scene loading.
- Lobby/invite flow.
- Steam integration.

Lock the framework after a documented multiplayer proof of concept.

---

# 17. Unity Technical Architecture

## 17.1 Engine version

Use Unity 6.3 LTS as the initial production baseline.

Freeze the editor version and package versions for the team. Do not upgrade halfway through a feature milestone without reviewing dependencies.

Unity identifies the 6.3 LTS release as supported through December 2027.

## 17.2 Rendering

Use URP.

Reasons:

- Suitable for a stylised first-person environment.
- Flexible lighting.
- Good performance options.
- Material and shader ecosystem.
- Suitable for PC development.
- Practical for a small team.

## 17.3 Core packages

Evaluate and lock:

- Unity Input System.
- Universal Render Pipeline.
- AI Navigation.
- Unity Test Framework.
- TextMeshPro.
- Multiplayer networking package.
- Steam integration library.
- Cinemachine only if required for specific cameras or presentation.
- Addressables if asset streaming or content management needs justify them.

Avoid adding packages without a specific requirement.

## 17.4 Recommended project directory

```text
Assets/
  _Project/
    Art/
      Characters/
      Environment/
      StoreFixtures/
      Products/
      Packaging/
      Props/
      Materials/
      Textures/
      UI/
      VFX/

    Audio/
      Ambience/
      Footsteps/
      Interaction/
      Checkout/
      UI/
      Music/

    Prefabs/
      Player/
      NPC/
      Products/
      Boxes/
      Shelves/
      Checkout/
      Storage/
      Props/
      Doors/
      UI/

    Scenes/

    ScriptableObjects/
      Products/
      Categories/
      Employees/
      Customers/
      Upgrades/
      StoreLevels/
      Economy/
      Audio/
      Settings/

    Scripts/
      Core/
      Player/
      Interaction/
      Physics/
      Inventory/
      Products/
      Fixtures/
      Checkout/
      Customers/
      Employees/
      Economy/
      Progression/
      Incidents/
      World/
      Networking/
      UI/
      Audio/
      Persistence/
      Platform/

    Settings/
    Tests/
      EditMode/
      PlayMode/
      Multiplayer/
```

## 17.5 Core C# systems

| System | Main responsibility |
|---|---|
| `GameBootstrap` | Application initialisation |
| `SessionManager` | Game session lifecycle |
| `NetworkSessionManager` | Network startup and shutdown |
| `GameClock` | In-game time |
| `PlayerController` | Player movement |
| `PlayerInteractionController` | Detect and use objects |
| `CarryController` | Pickup, carry and drop |
| `InventoryManager` | Shared inventory rules |
| `ProductDefinition` | Product data |
| `ProductView` | Product visual representation |
| `ProductBoxController` | Box interaction |
| `FixtureManager` | Shelf and fixture state |
| `ShelfSlot` | Product placement |
| `SupplierManager` | Orders and deliveries |
| `StoreManager` | Store operation state |
| `CheckoutManager` | Checkout logic |
| `PaymentManager` | Payment validation |
| `CustomerManager` | Customer lifecycle |
| `CustomerAI` | NPC behaviour |
| `EmployeeManager` | Employee lifecycle |
| `EmployeeAI` | Staff tasks |
| `EconomyManager` | Money and settlement |
| `ProgressionManager` | Store levels and unlocks |
| `IncidentManager` | Theft, spills and incidents |
| `DayCycleManager` | Day/night and weather |
| `SaveManager` | Persistent save data |
| `AudioManager` | Audio routing |
| `UIManager` | Interface coordination |

Do not put all gameplay logic inside one large `GameManager` class.

## 17.6 ScriptableObjects

Use ScriptableObjects for content data.

Examples:

### ProductDefinition

```text
Product ID
Display Name
Category
Licence Requirement
Prefab
Icon
Purchase Cost
Selling Price
MRP
Barcode
Package Type
Package Size
Weight Class
Expiry Duration
Storage Requirement
Supplier
Box Quantity
```

### ProductCategoryDefinition

```text
Category ID
Name
Description
Product List
Licence Requirement
Category Icon
```

### StoreLevelDefinition

```text
Level ID
Name
Unlock Conditions
Expansion Cost
Allowed Fixtures
Customer Target
Available Product Categories
```

### UpgradeDefinition

```text
Upgrade ID
Name
Description
Cost
Prerequisites
Gameplay Effect
Optional Visual Effect
```

Keep changing content separate from code.

---

# 18. Save System

## 18.1 Data to save

- Store level.
- Store balance.
- Product licences.
- Product prices.
- Product inventory.
- Shelf and fixture contents.
- Storage contents.
- Active orders.
- Employee list.
- Employee roles.
- Upgrades.
- Store opening state.
- Game day.
- Game time.
- Weather state.
- Player/session settings.
- Relevant world object state.

## 18.2 Save architecture

Use serialisable data models rather than serialising complete Unity GameObjects.

Save identifiers and state.

On load:

1. Read save data.
2. Validate schema version.
3. Load the correct store scene.
4. Restore player positions.
5. Restore fixtures.
6. Restore inventory.
7. Restore employees.
8. Restore economy.
9. Restore progression.
10. Rebuild visual representations.

## 18.3 Save safety

The save system should support:

- Manual saving.
- Autosaving.
- Save slots.
- Backup copy.
- Version number.
- Recovery from incomplete writes.

Use safe write procedures rather than overwriting the only save file during every autosave.

---

# 19. Performance and Optimisation

## 19.1 Performance philosophy

A supermarket has a large number of repeated objects.

The main performance risk is not a single expensive asset. It is the cumulative cost of:

- Products.
- Labels.
- Shelf slots.
- Materials.
- NPCs.
- Lights.
- Shadows.
- Physics.
- Network updates.
- UI updates.

## 19.2 Rendering optimisation

Use:

- GPU instancing where applicable.
- Static batching.
- LOD groups.
- Occlusion culling where useful.
- Texture atlases.
- Material sharing.
- Simplified collision meshes.
- Baked lighting for static areas.
- Limited realtime shadow lights.
- Object pooling.

Do not generate a unique material instance for every product unnecessarily.

## 19.3 NPC optimisation

- Pool NPCs.
- Limit active customer counts.
- Reduce distant AI update frequency.
- Avoid unnecessary path recalculation.
- Use simple state transitions.
- Avoid per-frame searches of every fixture.
- Cache valid shopping targets.

## 19.4 Product optimisation

- Use shared product meshes where appropriate.
- Use texture atlases for similar packaging.
- Disable unnecessary rigidbodies.
- Use slot-based data.
- Use simplified distant representations.
- Avoid unnecessary colliders.
- Spawn detailed visuals only when appropriate.

## 19.5 Network optimisation

- Send changes, not complete inventory snapshots every frame.
- Avoid excessive RPC calls.
- Batch related state updates.
- Synchronise only necessary moving objects.
- Keep customer decisions host-side.
- Use interpolation for remote movement.
- Separate high-frequency player motion from low-frequency shop simulation.

## 19.6 Performance targets

Initial targets for development:

| Metric | Target |
|---|---|
| Frame rate | 60 FPS target on agreed test hardware |
| Multiplayer | 8 players |
| Main store | Full MVP layout |
| AI | Stable customer navigation during busy periods |
| Save/load | No inventory duplication or loss |
| Network | No repeated transaction desynchronisation |
| Physics | Stable pickup, drop and stacking |
| Loading | Predictable scene transition with progress feedback |

These targets must be tested against an agreed PC specification before the team promises minimum hardware requirements.

Do not claim a fixed NPC count or exact FPS until measured.

---

# 20. Audio Design

Audio should make the store feel alive.

## 20.1 Ambience

- Supermarket background hum.
- Refrigeration.
- Air conditioning.
- Outside traffic.
- Rain.
- Night ambience.
- Customer crowd ambience.
- Checkout activity.

## 20.2 Interaction sounds

- Box pickup.
- Box drop.
- Shelf placement.
- Product placement.
- Door opening.
- Door closing.
- Scanner beep.
- Cash drawer.
- Card payment.
- UPI success.
- Receipt printer.
- Mop cleaning.
- UI confirmation.
- Error notification.

## 20.3 Character audio

- Footsteps.
- Running.
- Object handling.
- Short reactions.
- Customer chatter.
- Employee chatter.

Use audio variation so repeated actions do not sound identical every time.

## 20.4 Audio priorities

First implementation:

1. Player footsteps.
2. Pickup and drop.
3. Shelf stock.
4. Scanner.
5. Checkout.
6. Payment.
7. Door.
8. Background store ambience.

Voice acting is not required for the first MVP.

---

# 21. Testing and Quality Assurance

The browser prototype already includes automated simulation, WebSocket, UI and play-through testing.

The Unity project should preserve the practice of testing gameplay rules rather than relying only on manual play.

## 21.1 Test categories

### Unit / EditMode tests

- Product definitions.
- Pricing.
- Inventory.
- Stock placement.
- Payment calculations.
- Expiry.
- Progression conditions.
- Daily settlement.
- Upgrade requirements.

### PlayMode tests

- Pickup.
- Carry.
- Drop.
- Shelf placement.
- Box opening.
- Customer movement.
- Queue behaviour.
- Checkout interaction.
- Cleaning.
- Store opening and closing.

### Multiplayer tests

- Host creation.
- Client joining.
- Player movement.
- Box pickup.
- Box drop.
- Shelf stocking.
- Inventory consistency.
- Checkout transaction.
- Player disconnect.
- Host shutdown.
- Save-state consistency.

### Performance tests

- Fully stocked store.
- Many active customers.
- Maximum intended players.
- Multiple active checkout lanes.
- Storage filled with boxes.
- Busy exterior.
- Rain and nighttime lighting.

## 21.2 Critical edge cases

Test these deliberately:

- Two players try to pick up the same box.
- Two players stock the same shelf slot.
- Player disconnects while carrying a box.
- Box is dropped into a wall.
- Customer reaches a shelf that has just become empty.
- Customer targets a closed checkout.
- Customer queue becomes full.
- Payment is attempted twice.
- Player attempts to scan an invalid item.
- Store closes during an active checkout.
- Order arrives while a player disconnects.
- Autosave occurs during a transaction.
- Game loads while products are in storage.

## 21.3 Acceptance criteria

A feature is complete only when:

- It works in single-player.
- It works with more than one player where applicable.
- It handles invalid actions.
- It restores correctly after save/load.
- It has visual feedback.
- It has audio feedback where appropriate.
- It does not create inventory duplication.
- It does not create an unrecoverable stuck state.
- It passes the relevant automated tests.

---

# 22. Production Roadmap

The roadmap is milestone-based. Dates should be assigned after the first technical assessment and team capacity review.

## Phase 0 — Technical foundation

Deliverables:

- Unity 6.3 LTS project.
- URP configured.
- Git repository.
- Git LFS for large assets.
- Folder structure.
- Input System.
- Player controller.
- Basic test store.
- Basic lighting.
- Initial physics test.
- Initial architecture document.

Exit criteria:

- Project builds.
- Player moves.
- Camera works.
- Input is configurable.
- Store greybox loads consistently.

## Phase 1 — Physical gameplay vertical slice

Deliverables:

- Shelf prefab.
- Product prefab.
- Product box prefab.
- Carry anchor.
- Pickup/drop.
- Shelf snapping.
- Inventory update.
- One checkout.
- One customer.
- One payment.
- Basic sound.

Exit criteria:

A player can receive a delivery, stock one product, sell it to one customer and complete a transaction without errors.

## Phase 2 — Store simulation

Deliverables:

- Product catalogue.
- Product categories.
- Product licences.
- Multiple shelves.
- Fridges.
- Produce.
- Storage room.
- Ordering.
- Delivery.
- Customer AI.
- Checkout queues.
- Payment.
- Store time.
- Closing and settlement.

Exit criteria:

The store can operate through a complete in-game day.

## Phase 3 — Multiplayer

Deliverables:

- Host session.
- Client join.
- Player synchronisation.
- Shared box interaction.
- Shared stocking.
- Shared inventory.
- Shared checkout.
- Shared customer simulation.
- Disconnect handling.

Exit criteria:

Multiple players can operate the same store without duplicating or losing important game state.

## Phase 4 — Management and progression

Deliverables:

- Economy.
- Employee hiring.
- Cashier automation.
- Stock clerk automation.
- Upgrades.
- Product licences.
- Four store levels.
- Freshness.
- Expiry.
- Theft.
- CCTV.
- Cleaning.
- Daily reports.

Exit criteria:

The store has a functional management and progression loop.

## Phase 5 — Visual and audio production

Deliverables:

- Final product models.
- Final packaging.
- Shelves and fixtures.
- Checkout environment.
- Exterior.
- Lighting.
- Materials.
- Animations.
- Audio.
- UI polish.
- Weather.

Exit criteria:

The game no longer looks like a greybox prototype. Important gameplay actions are readable and polished.

## Phase 6 — Release preparation

Deliverables:

- Full regression testing.
- Multiplayer stress testing.
- Save testing.
- Performance profiling.
- Controller support.
- Steam integration.
- Build pipeline.
- Store page assets.
- Trailer capture.
- Tutorial.
- Final options menu.
- Credits and legal review.

Exit criteria:

A complete release candidate can be played from a fresh installation through a full store progression session.

---

# 23. First 30 Days — Recommended Execution Order

The first month should focus on proving the technical foundation and core interaction loop.

## Week 1 — Unity foundation

Create:

- Unity project.
- URP.
- Folder structure.
- Git repository.
- Main bootstrap scene.
- Test store scene.
- Player controller.
- Camera.
- Input actions.
- Lighting setup.
- Initial scale.

Deliverable:

A player can walk around a correctly scaled supermarket greybox.

## Week 2 — Objects and physics

Create:

- One product model.
- One product box.
- One shelf.
- One shelf slot system.
- Carry anchor.
- Pickup.
- Carry.
- Drop.
- Shelf placement.
- Inventory update.

Deliverable:

The player can move products from a box to a shelf.

## Week 3 — Customer and checkout

Create:

- One customer prefab.
- NavMesh.
- Customer movement.
- Product search.
- Product collection.
- Checkout queue.
- Scanner.
- Price calculation.
- Cash payment.
- Customer exit.

Deliverable:

One complete customer shopping transaction.

## Week 4 — Multiplayer proof of concept

Create:

- Host.
- Client.
- Player synchronisation.
- Box ownership.
- Shared pickup.
- Shared drop.
- Shared shelf state.
- Checkout state.
- Disconnect test.

Deliverable:

Two players can stock and operate the same shop without conflicting inventory state.

**Month-one success condition:** The team has proven that the game is technically feasible in Unity. It should not attempt to complete the full supermarket in the first month.

---

# 24. Asset Production Priorities

Create assets in the order that they contribute to gameplay.

## Priority 1 — Core gameplay assets

- Player arms.
- Product box.
- Product.
- Shelf.
- Shelf slot.
- Storage shelf.
- Checkout.
- Scanner.
- Customer.
- Shopping basket.
- Door.

## Priority 2 — Main store environment

- Floor.
- Walls.
- Ceiling.
- Lights.
- Gondola shelf variations.
- Fridge.
- Freezer.
- Produce display.
- Price tags.
- Aisle signs.
- Checkout area.
- Storage room.

## Priority 3 — Store personality

- Product branding.
- Posters.
- Promotional displays.
- Exterior sign.
- Plants.
- Decorations.
- Background vehicles.
- Street furniture.
- Office and staff room.

## Priority 4 — Polish

- Animation refinement.
- Materials.
- VFX.
- Detailed sounds.
- Additional customer variation.
- Weather.
- Cinematic presentation.

Do not spend the first month modelling small decorative objects while the pickup and stocking mechanics remain incomplete.

---

# 25. Development Rules

These rules should guide the project throughout production.

1. **Build reusable systems.** A shelf should be a reusable prefab, not a unique implementation for every aisle.
2. **Separate data from visuals.** Product data should not live inside the product mesh script.
3. **Keep multiplayer authority clear.** Clients request actions; the host validates important shared state.
4. **Do not simulate every product physically.** Use slot-based inventory and physics only when interaction requires it.
5. **Make interaction feedback immediate.** Players should know when an action succeeded.
6. **Use the same gameplay systems for players and employees where possible.**
7. **Test features before building more content on top of them.**
8. **Keep the original product identity.** Use fictional brands and packaging.
9. **Do not copy competitor assets.** Build original environments, UI, sounds and models.
10. **Profile before optimising blindly.** Measure rendering, CPU, physics, AI and network performance.
11. **Avoid monolithic managers.** Split systems by responsibility.
12. **Keep save data independent of scene object references.**
13. **Never trust clients with economy or inventory totals.**
14. **Use automated tests for critical simulation rules.**
15. **Do not increase player count until the current player target is stable.**

---

# 26. Major Risks and Mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Too many physical products | Physics and rendering cost | Slot-based displays and object pooling |
| Large scope | Delays a playable release | Lock the MVP and defer advanced features |
| Multiplayer inventory bugs | Duplication and lost items | Host-authoritative transactions |
| NPC pathfinding congestion | Customers become stuck | Dedicated queue positions and recovery |
| Poor object interaction | Game feels frustrating | Central interaction system and feedback |
| Weak visual quality | Store feels like a prototype | Art bible and asset quality gates |
| Save corruption | Players lose progression | Versioned saves and backup writes |
| Overloaded scripts | Difficult to maintain | Modular C# architecture |
| Excessive network traffic | Poor multiplayer experience | Event-driven state replication |
| Uncontrolled asset variation | Inconsistent visual identity | Prefab and material standards |

---

# 27. Definition of a Successful MVP

The MVP is successful when a group of players can:

1. Start a new store.
2. Enter the shop.
3. Order products.
4. Receive delivery boxes.
5. Move boxes into storage.
6. Open boxes.
7. Stock shelves.
8. Set prices.
9. Open the store.
10. Watch customers enter.
11. Watch customers browse and purchase.
12. Serve customers at checkout.
13. Complete cash, card and UPI transactions.
14. Hire and use employees.
15. Handle spills.
16. Detect or prevent theft.
17. Close the store.
18. Review daily results.
19. Save the game.
20. Load the game and continue.
21. Expand the store.
22. Unlock additional product categories.

All of these must work without serious inventory, transaction, save or multiplayer errors.

The store should also have a consistent visual identity. Players should be able to recognise products, identify fixtures, understand the layout and navigate the store without relying on constant UI guidance.

---

# 28. Final Technical Recommendation

Build MiniMart Mayhem as a modular Unity 6.3 LTS project using C# and URP.

The recommended order is:

**Player controller → Interaction → Product and box system → Shelf slots → Inventory → Customer AI → Checkout → Economy → Multiplayer → Employees → Progression → Visual polish.**

The most important technical decision is to separate the **simulation state** from the **3D visual representation**.

A product on a shelf should exist as inventory data and a shelf-slot assignment. Its model is the representation of that state. When a player picks it up, the state changes and the visual representation moves into the player's carry system. When it is dropped, the system changes the state again.

The same principle should apply to:

- Boxes.
- Shelves.
- Checkout.
- Customers.
- Employees.
- Store upgrades.
- Payments.
- Deliveries.

This architecture will make the game easier to test, save, load and synchronise across multiplayer clients.

The first milestone should not be a beautiful supermarket. It should be a small, stable and enjoyable supermarket interaction loop.

Once that loop works, expanding it into a full store becomes a content and systems-production problem rather than an uncertain technical experiment.

---

# 29. Reference Notes

## Existing project

The reviewed MiniMart browser prototype is the source of the existing gameplay scope, starting layout, expanded fixture counts, product categories, product packaging formats, controls, progression structure and management features described in this document.

Where this document introduces Unity-specific architecture, proposed dimensions, performance targets or production recommendations, those are design recommendations for the new implementation rather than claims about the original prototype.

## Genre reference

Supermarket Together is a public reference for cooperative supermarket-management gameplay. Its public Steam description highlights store expansion, a large product catalogue, additional departments, cleaning, shoplifting, CCTV and employee roles. These are useful genre reference points, not a specification of its internal implementation.

Public gameplay guides also describe product ordering, box delivery, storage, shelf stocking and checkout queues. Exact proprietary source code, internal AI implementation, physics configuration and networking architecture are not available from those public descriptions.

## Unity reference

The recommended engine baseline is Unity 6.3 LTS. Unity's release information lists support through December 2027. Netcode for GameObjects documentation lists support for Unity 6 and later. Package versions and compatibility must still be checked and locked during project setup.

---

**End of document.**