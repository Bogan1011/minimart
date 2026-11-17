# MiniMart Mayhem --- Unity & C# Migration Plan

**Document type:** Product requirements + technical migration plan\
**Project:** MiniMart Mayhem\
**Target platform:** Windows PC / Steam\
**Engine:** Unity 6 (LTS release selected at project kickoff)\
**Language:** C#\
**Document status:** Proposed baseline\
**Source reviewed:** `minimart-latest.zip` (README,
game/server/client/scene/packaging/props code and test files)

------------------------------------------------------------------------

## 1. Executive Summary

MiniMart Mayhem is a first-person cooperative supermarket simulation
game. The current browser prototype is built with Node.js, Three.js and
a custom WebSocket server. The project already contains a substantial
gameplay foundation: shared shop management, customer simulation,
stocking, checkout, cash handling, staff, upgrades, product licences,
store expansion, daily goals, weather, day/night, persistence and
multiplayer for up to eight players.

The decision is to **rebuild the game in Unity using C#**, targeting a
polished PC/Steam experience.

This is a deliberate engine migration, not a direct line-by-line code
conversion. The current prototype is the functional design reference.
Preserve its established gameplay rules and content where appropriate,
but redesign implementation around Unity scenes, prefabs,
ScriptableObjects, C# systems and a tested multiplayer architecture.

### Product direction

Create a fun, replayable co-op supermarket simulator where players work
together to prepare, stock, operate and expand a store. The first
release should deliver a complete gameplay loop, not just a technical
demo.

### Recommended initial targets

  -----------------------------------------------------------------------
  Area                                MVP target
  ----------------------------------- -----------------------------------
  Platform                            Windows PC

  Distribution                        Steam

  Perspective                         First-person

  Multiplayer                         Online co-op, up to 8 players

  Game mode                           One shared supermarket and shared
                                      economy

  Visual direction                    Polished stylized 3D; upgrade
                                      realism only where it adds value

  Session loop                        Prepare → Open → Serve customers →
                                      Close → Upgrade → Repeat

  Persistence                         Save shared store progression and
                                      player/session data safely

  Input                               Keyboard/mouse first; controller
                                      support after core controls
                                      stabilize
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 2. Existing Prototype --- Baseline Inventory

The following is based on the supplied project README and source
structure. These are features documented or represented in the current
prototype; they are not automatically considered production-ready in the
Unity version.

### 2.1 Current technology

  -----------------------------------------------------------------------
  Component                           Current implementation
  ----------------------------------- -----------------------------------
  3D rendering                        Three.js

  Game client                         Browser JavaScript

  Game simulation                     Node.js `game.js`

  Networking                          Custom RFC6455 WebSocket
                                      implementation in `server.js`

  Persistence                         Three JSON save slots

  World assets                        Runtime-generated geometry and
                                      canvas textures

  Automated tests                     Node simulation tests, WebSocket
                                      bot tests and Playwright browser
                                      tests
  -----------------------------------------------------------------------

### 2.2 Current gameplay/content inventory

-   First-person player movement, sprinting, looking and interaction.
-   Up to 8 players in one shared shop.
-   Room password, player join flow, chat and reconnect attempts.
-   Shared server-controlled game simulation.
-   36 products across 7 product licence lines.
-   Product boxes, packaging, produce models and supplier cartons.
-   Four fixture types: shelves, fridges, freezers and produce stands.
-   Storage room, delivery pad, supplier order terminal and waste bin.
-   Stock ordering, deliveries, carrying boxes, stocking and emptying
    fixtures.
-   Product prices, promotions and supplier purchase costs.
-   Customer types: regular, rushed, bulk/trolley and loyalty members.
-   Customer pathfinding, browsing, queues, checkout selection and
    walk-outs.
-   Shoplifting, thief interception, spills and cleaning.
-   Checkout scanning and itemized bills.
-   Cash, card and UPI payment flows.
-   Cash drawer, denominations, change handling and receipts.
-   GST shown on receipts.
-   Cashier and stock-clerk employees.
-   Store upgrades, product licences and four store expansion levels.
-   Daily goals, goal bonuses, reputation and loyalty club.
-   Fresh-product shelf life, expiry, waste and customer refusal of
    expired goods.
-   Rent, wages, daily closing summary and employee-of-the-day
    reporting.
-   Day clock, weather variations, sunrise, dusk and night.
-   Exterior, car park, parked cars, trolley corral, road and town
    backdrop.
-   Settings for sensitivity, invert Y, FOV, head bob, audio and
    graphics quality.
-   Minimap, help, crew board, HUD, panels and mobile touch controls.
-   Save/load slots, autosave and host-controlled reset/load actions.

### 2.3 Existing content values to preserve as design references

The prototype README defines these initial balancing values. Treat them
as **reference data**, not immutable final values; validate and
rebalance during playtesting.

  -----------------------------------------------------------------------
  System                              Current reference
  ----------------------------------- -----------------------------------
  Maximum players                     8

  Product catalogue                   36 products

  Product licence lines               7

  Store progression                   4 levels

  Initial store                       8 shelves, 2 fridges, 2 produce
                                      stands, 2 tills

  Fully expanded store                56 shelves, 19 fridges, 4 freezers,
                                      8 produce stands, 6 tills

  Day clock                           08:00--22:00

  Default open duration in prototype  300 seconds

  Initial cash                        ₹5,000

  Store levels                        Corner Shop, Mini Market,
                                      Supermarket, Superstore

  Save slots                          3 JSON slots

  Multiplayer networking tick         30 Hz simulation; 15 Hz snapshots
                                      (prototype implementation)
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 3. MVP Definition

### MVP objective

A player can launch the game, create or join a co-op session, operate a
supermarket with friends, complete multiple business days, earn money,
purchase stock and upgrades, expand the store, save progression and
return later.

**MVP is complete only when the full loop works reliably in a packaged
Windows build and in online multiplayer.**

### 3.1 MVP feature checklist

#### A. Game foundation and player controls

-   [ ] Unity project with a clean, documented folder structure.
-   [ ] First-person controller with walking, sprinting, jumping only if
    needed by level design, and mouse look.
-   [ ] Interaction system with clear targeting/highlighting and
    interaction prompts.
-   [ ] Pick up, carry, place and drop product boxes.
-   [ ] Player collision with walls, shelves, counters, fixtures and
    props.
-   [ ] Player names and distinct player appearance/colour.
-   [ ] Basic player animation: idle, walk, run and carry.
-   [ ] Pause menu and basic settings.
-   [ ] Keyboard/mouse controls.
-   [ ] Consistent interaction behaviour in solo-hosted and multiplayer
    sessions.

#### B. Multiplayer and session flow

-   [ ] Host can create a session.
-   [ ] Players can join through Steam invitations/lobby or a documented
    join flow.
-   [ ] Private/friends-only session option.
-   [ ] Support up to 8 players in one store for MVP.
-   [ ] Player join/leave notifications.
-   [ ] Player movement and animation synchronization.
-   [ ] Synchronization of carried boxes and important interactable
    objects.
-   [ ] Shared store state: money, stock, orders, prices, upgrades, day
    phase and customer activity.
-   [ ] Server/host-authoritative validation of purchases, sales,
    inventory and progression.
-   [ ] Reconnection handling with a clear result if a player drops.
-   [ ] Session owner/host migration policy documented; if host
    migration is not supported in MVP, show a clear host-disconnect
    message and protect saved progress.
-   [ ] Basic in-game text chat.
-   [ ] Prevent duplicate transactions and invalid/out-of-range
    interactions.
-   [ ] Multiplayer tests for 2, 4 and 8 concurrent players.

#### C. Supermarket world

-   [ ] One complete, navigable supermarket map.
-   [ ] Exterior entrance and sliding/automatic doors.
-   [ ] Shop floor and storage room.
-   [ ] Delivery area and supplier drop-off point.
-   [ ] Shelves for dry goods.
-   [ ] Fridges for chilled goods.
-   [ ] Freezers for frozen goods.
-   [ ] Produce stands/crates for fruit and vegetables.
-   [ ] Checkout counters and customer queue positions.
-   [ ] Waste bin and cleaning supplies.
-   [ ] Basic car park/exterior dressing to establish the setting.
-   [ ] Collision and navigation geometry tested throughout the map.
-   [ ] Store layout supports the initial size and all planned MVP
    expansion zones.

#### D. Product catalogue and inventory

-   [ ] MVP catalogue containing the current 36 prototype products,
    unless a documented scope change is approved.
-   [ ] Product data stored as Unity ScriptableObjects or equivalent
    data assets.
-   [ ] Product category and storage type: dry, chilled, frozen or
    produce.
-   [ ] Product name, icon/model, pack size, base price and supplier
    cost.
-   [ ] Product licence/availability rules.
-   [ ] Product box model and contents/count.
-   [ ] Shelf/fridge/freezer/produce fixture capacity.
-   [ ] Order stock from the supplier terminal.
-   [ ] Deliveries arrive after a defined delay.
-   [ ] Carry boxes from delivery area to the correct fixture.
-   [ ] Stock individual products into compatible fixtures.
-   [ ] Remove/empty stock from fixtures into boxes.
-   [ ] Track stock quantity accurately across deliveries, fixtures,
    checkout and waste.
-   [ ] Low-stock and sold-out alerts.
-   [ ] Expiry tracking for products with a shelf life.
-   [ ] Expired goods visibly marked and refused by customers.
-   [ ] Expired products can be removed and disposed of.
-   [ ] No item duplication or loss during multiplayer interactions.

#### E. Customer AI and shopping

-   [ ] Customers spawn and leave through store entrances.
-   [ ] Customer navigation around fixtures and other obstacles.
-   [ ] Customer types: regular, rushed and bulk/trolley.
-   [ ] Customer selects products based on availability, price and
    preference.
-   [ ] Customer moves to the correct fixture and takes available
    products.
-   [ ] Customer reacts to out-of-stock products.
-   [ ] Customer moves to a checkout and joins a queue.
-   [ ] Customer patience/waiting time and walk-out behaviour.
-   [ ] Customer purchase basket and bill data.
-   [ ] Customer leaves after successful checkout.
-   [ ] Customer spawn rate and daily customer cap are configurable.
-   [ ] NPC navigation remains stable when players or staff block paths.
-   [ ] Customer AI performance tested at peak store population.

#### F. Checkout, payment and receipts

-   [ ] Player can operate a checkout lane.
-   [ ] Customer basket appears as a live bill.
-   [ ] Scan products one at a time.
-   [ ] Bill shows product, quantity, unit price and total.
-   [ ] Price is fixed at the time of scanning.
-   [ ] Customer requests payment after all products are scanned.
-   [ ] Cash payment flow.
-   [ ] Cash drawer with supported note/coin denominations.
-   [ ] Player gives change and completes the sale.
-   [ ] Incorrect change is handled with a clear financial/reputation
    consequence.
-   [ ] Card payment flow.
-   [ ] UPI payment flow.
-   [ ] Payment device upgrade gates card/UPI availability if retaining
    prototype progression.
-   [ ] Receipt shows bill number, products, subtotal/total, payment
    method, change and GST.
-   [ ] Successful checkout updates store cash, sales, stock, goals and
    reputation exactly once.
-   [ ] NPC cashier can complete checkout autonomously if staff are part
    of the MVP staff scope.

#### G. Store operations and business economy

-   [ ] Shared store wallet/cash balance.
-   [ ] Supplier purchase cost and product selling price.
-   [ ] Player can set product prices.
-   [ ] Customer purchase decisions respond to price.
-   [ ] Promotions with a configurable maximum number of active
    promotions (prototype reference: 3).
-   [ ] Sales revenue and supplier costs tracked.
-   [ ] Daily rent and employee wages deducted at closing.
-   [ ] Daily profit/loss summary.
-   [ ] Reputation score.
-   [ ] Daily goals (three active goals based on prototype design).
-   [ ] Goal rewards and reputation impact.
-   [ ] Clear warnings for insufficient cash and unavailable purchases.
-   [ ] Economy values are data-driven and configurable for balancing.

#### H. Employees and automation

-   [ ] Hire cashier employee(s).
-   [ ] Cashier finds/uses an available checkout and processes
    customers.
-   [ ] Cashier handles payment and correct change.
-   [ ] Hire stock clerk employee(s).
-   [ ] Stock clerk transports boxes and stocks compatible fixtures.
-   [ ] Staff have simple navigation and task states.
-   [ ] Employee wages deducted daily.
-   [ ] Staff capacity/limits and hiring costs are configurable.
-   [ ] Employees do not duplicate stock or get permanently stuck.
-   [ ] Basic staff status visible to players.

#### I. Progression, upgrades and licences

-   [ ] Four store progression levels based on the prototype:
    -   [ ] Level 1 --- Corner Shop.
    -   [ ] Level 2 --- Mini Market.
    -   [ ] Level 3 --- Supermarket.
    -   [ ] Level 4 --- Superstore.
-   [ ] Store expansion requires defined cash, customers served and
    reputation.
-   [ ] Expansion opens new physical areas and fixtures.
-   [ ] Seven product licence groups.
-   [ ] Licence purchase unlocks products for ordering/selling.
-   [ ] Equipment upgrades, with clear costs and effects.
-   [ ] Preserve the prototype upgrade concepts where feasible:
    -   [ ] Card & UPI machine.
    -   [ ] Fast barcode scanner.
    -   [ ] Air conditioning.
    -   [ ] CCTV + door alarm.
    -   [ ] Express supplier.
    -   [ ] Radio advertising.
    -   [ ] Deep shelving.
-   [ ] Upgrade state persists between sessions/days.
-   [ ] Progression UI shows requirements, costs and benefits.
-   [ ] Expansion cannot be purchased twice or when requirements are
    unmet.

#### J. Events, hazards and product freshness

-   [ ] Shoplifters can steal goods.
-   [ ] Players can catch/intercept shoplifters.
-   [ ] CCTV upgrade affects shoplifting frequency/behaviour if
    retained.
-   [ ] Spills can occur.
-   [ ] Player can clean spills using a mop interaction.
-   [ ] Fresh goods age between business days.
-   [ ] Expired products cannot be sold.
-   [ ] Waste disposal is supported.
-   [ ] Customer walk-outs and reputation effects are visible.
-   [ ] Weather/day conditions can affect ambience; gameplay effects
    should be added only if balanced and tested.

#### K. Day cycle and game loop

-   [ ] Prep phase: no customer traffic and no running store clock.
-   [ ] Players order stock, stock fixtures, set prices and review
    goals.
-   [ ] Players collectively open the store.
-   [ ] Open phase: customers arrive and the store operates.
-   [ ] Players serve customers, restock, clean and handle theft.
-   [ ] Closing phase prevents new customers and allows a short grace
    period to finish operations.
-   [ ] End-of-day processing ages products, calculates sales, rent,
    wages and bonuses.
-   [ ] Daily summary/receipt shows business results.
-   [ ] Players continue to the next day.
-   [ ] Day number, cash, reputation, store level and progression
    persist.

#### L. UI, UX and accessibility basics

-   [ ] Main menu.
-   [ ] Host/join session screen.
-   [ ] Player name/profile display.
-   [ ] In-game HUD with money, day, phase and key alerts.
-   [ ] Interaction prompts.
-   [ ] Inventory/carry state indicator.
-   [ ] Supplier ordering panel.
-   [ ] Price and promotion panel.
-   [ ] Upgrade/licence panel.
-   [ ] Checkout bill and cash drawer UI.
-   [ ] Receipt and end-of-day summary.
-   [ ] Crew/player list.
-   [ ] Minimap or clear navigation aid.
-   [ ] Settings for mouse sensitivity, FOV, audio volume and graphics
    quality.
-   [ ] Clear error, reconnect and session-full messages.
-   [ ] UI scales correctly at common PC resolutions and aspect ratios.

#### M. Audio and visual presentation

-   [ ] Consistent stylized 3D art direction.
-   [ ] Distinct models/materials for products and fixtures.
-   [ ] Basic customer and employee models.
-   [ ] Character animations for movement, carrying and checkout tasks.
-   [ ] Store ambience.
-   [ ] Footsteps and interaction sounds.
-   [ ] Stocking, scanning, cash drawer and payment sounds.
-   [ ] Customer feedback sounds/voice barks where appropriate.
-   [ ] Day/night lighting.
-   [ ] Basic weather ambience.
-   [ ] Audio settings and mute/volume controls.
-   [ ] Performance-friendly lighting, shadows, materials and asset
    budgets.

#### N. Save system and reliability

-   [ ] Save shared store progression.
-   [ ] Save day number, cash, reputation, store level and upgrades.
-   [ ] Save licences, prices and promotions.
-   [ ] Save stock quantities and expiry data.
-   [ ] Save employee state.
-   [ ] Save completed progression/goals as required.
-   [ ] Autosave at safe checkpoints.
-   [ ] Save on normal session shutdown where possible.
-   [ ] Versioned save format and migration strategy.
-   [ ] Corrupt-save handling and backup/recovery.
-   [ ] Prevent two sessions from overwriting the same save.
-   [ ] Clearly communicate who owns the shared save/session.

#### O. Steam/Windows delivery

-   [ ] Windows build that launches without a browser or local Node.js
    server.
-   [ ] Steam app integration.
-   [ ] Steam lobby/session creation and friend invites.
-   [ ] Steam identity mapped safely to a player.
-   [ ] Basic achievements only if time permits; not a blocker for the
    first MVP.
-   [ ] Crash/error logging.
-   [ ] Graphics settings and resolution selection.
-   [ ] First-launch onboarding/tutorial.
-   [ ] Build version display.
-   [ ] Closed playtest build and feedback collection.
-   [ ] Installation, update and uninstall tested through Steam test
    branches.

------------------------------------------------------------------------

## 4. Explicitly Out of Scope for MVP

These are possible post-MVP features. Do not let them delay the first
complete playable release unless they become essential to the core loop.

-   [ ] More than 8 players.
-   [ ] Dedicated large-scale public servers and matchmaking at scale.
-   [ ] Host migration, unless selected as a release requirement.
-   [ ] Multiple supermarket maps or cities.
-   [ ] Multiple independently owned stores/franchises.
-   [ ] Full competitor simulation and dynamic market economy.
-   [ ] Deep supplier negotiation and contracts.
-   [ ] Advanced employee schedules, training and personality
    simulation.
-   [ ] Complex theft investigations, security systems and police
    response.
-   [ ] Fully simulated vehicles and delivery driving.
-   [ ] Character customization beyond basic identity/colour.
-   [ ] Voice chat.
-   [ ] Mod support and Steam Workshop.
-   [ ] Console release.
-   [ ] VR.
-   [ ] Mobile release.
-   [ ] Dedicated mobile touch UI.
-   [ ] Seasonal live events and live-service content.
-   [ ] Large-scale analytics/telemetry platform.
-   [ ] Monetization systems, battle passes or microtransactions.

------------------------------------------------------------------------

## 5. Unity Technical Architecture

### 5.1 Recommended technical choices

  -----------------------------------------------------------------------
  Layer                   Recommendation          Purpose
  ----------------------- ----------------------- -----------------------
  Engine                  Unity 6 LTS             Core game runtime

  Language                C#                      Gameplay and tools

  Rendering               URP                     Good performance and
                                                  visual quality on a
                                                  broad PC range

  Input                   Unity Input System      Keyboard/mouse and
                                                  future controller
                                                  support

  Physics                 Unity PhysX             Player/object collision
                                                  and physical
                                                  interactions

  Navigation              Unity AI Navigation /   Customer and employee
                          NavMesh                 navigation

  Data                    ScriptableObjects       Products, fixtures,
                                                  upgrades, goals and
                                                  tuning

  Networking              Evaluate                Co-op synchronization
                          Fish-Networking, Mirror 
                          and Unity Netcode for   
                          GameObjects             

  Platform services       Steamworks.NET or an    Steam identity, lobbies
                          actively maintained     and invites
                          Steamworks integration  

  Persistence             Versioned local/host    Shared store
                          save for initial MVP    progression

  Tests                   Unity Test Framework    Edit-mode and play-mode
                                                  tests

  Source control          Git + Git LFS           Code and binary assets

  3D authoring            Blender                 Models, UVs and
                                                  animations
  -----------------------------------------------------------------------

**Networking decision gate:** Build a small multiplayer proof of concept
before committing to a networking library. Test host/client connection,
lobby/invite flow, player movement, object interaction, shared
transactions, reconnection and an 8-player load test. Choose one library
and do not mix networking frameworks.

For the first MVP, a listen-server/host-authoritative model is a
reasonable cost-conscious starting point. Important game state and
transactions must be validated by the host. If the host disconnects,
protect progression and communicate the session outcome. Dedicated
servers and host migration can be later decisions.

### 5.2 Suggested Unity folder structure

``` text
Assets/
├── _Project/
│   ├── Art/
│   │   ├── Characters/
│   │   ├── Environment/
│   │   ├── Products/
│   │   ├── Props/
│   │   ├── Materials/
│   │   └── VFX/
│   ├── Audio/
│   ├── Prefabs/
│   │   ├── Players/
│   │   ├── Customers/
│   │   ├── Employees/
│   │   ├── Products/
│   │   ├── Fixtures/
│   │   └── Interactables/
│   ├── Scenes/
│   │   ├── Bootstrap.unity
│   │   ├── MainMenu.unity
│   │   ├── Supermarket.unity
│   │   └── TestMaps/
│   ├── ScriptableObjects/
│   │   ├── Products/
│   │   ├── Fixtures/
│   │   ├── Upgrades/
│   │   ├── Licences/
│   │   ├── Goals/
│   │   └── Customers/
│   ├── Scripts/
│   │   ├── Core/
│   │   ├── Player/
│   │   ├── Interaction/
│   │   ├── Networking/
│   │   ├── Simulation/
│   │   │   ├── Customers/
│   │   │   ├── Employees/
│   │   │   ├── Inventory/
│   │   │   ├── Checkout/
│   │   │   ├── Economy/
│   │   │   ├── Progression/
│   │   │   └── DayCycle/
│   │   ├── World/
│   │   ├── UI/
│   │   ├── Audio/
│   │   ├── Persistence/
│   │   └── Platform/
│   ├── Settings/
│   └── Tests/
│       ├── EditMode/
│       └── PlayMode/
└── ThirdParty/
```

### 5.3 Core C# systems

  -----------------------------------------------------------------------
  System                              Responsibility
  ----------------------------------- -----------------------------------
  `GameBootstrap`                     Initialize services and load the
                                      correct scene

  `SessionManager`                    Host/join/leave session and player
                                      roster

  `NetworkGameState`                  Replicated authoritative shared
                                      state

  `PlayerController`                  Movement, look and player state

  `InteractionController`             Detect and invoke valid
                                      interactions

  `CarryController`                   Pick up, carry, drop and place
                                      boxes

  `StoreManager`                      Store state and active store level

  `DayCycleManager`                   Prep/open/closing/summary phases

  `InventoryManager`                  Stock, boxes, fixture capacity and
                                      expiry

  `SupplierManager`                   Orders, delivery timing and costs

  `CustomerManager`                   Customer spawning and population
                                      limits

  `CustomerAI`                        Browse, select, queue, pay and exit
                                      state machine

  `CheckoutManager`                   Till ownership, scanning, bills and
                                      transaction flow

  `PaymentManager`                    Cash/card/UPI payment outcomes and
                                      change

  `EconomyManager`                    Cash, revenue, costs, rent, wages
                                      and profit

  `EmployeeManager`                   Hiring, task assignment and
                                      employee status

  `ProgressionManager`                Store levels, licences and upgrades

  `GoalManager`                       Daily goals and rewards

  `IncidentManager`                   Theft, spills and other store
                                      incidents

  `SaveManager`                       Versioned save/load and recovery

  `UIManager`                         Shared UI navigation and
                                      presentation

  `AudioManager`                      Music, ambience and sound effects
  -----------------------------------------------------------------------

Keep simulation rules independent from visual presentation wherever
practical. UI and animations should display game state; they should not
be the authority that changes money, stock or sales.

------------------------------------------------------------------------

## 6. Migration Strategy: Browser Prototype to Unity

Do not attempt a one-shot conversion. Migrate in controlled vertical
slices.

### Phase 0 --- Freeze and document the prototype

-   [ ] Keep an untouched copy of the uploaded browser prototype.
-   [ ] Tag the current version in source control.
-   [ ] Capture gameplay videos and screenshots of each important
    feature.
-   [ ] Document current product data, prices, upgrade costs, store
    levels and game rules.
-   [ ] Export/record representative save files and test scenarios.
-   [ ] Create a feature-to-Unity-system mapping.
-   [ ] Decide which prototype behaviours are preserved, changed or
    removed.

**Exit criteria:** The team has a reliable reference build and written
behaviour specification.

### Phase 1 --- Unity project and first-person vertical slice

-   [ ] Create Unity project and Git repository.
-   [ ] Configure URP, input, physics and project conventions.
-   [ ] Build one small supermarket scene.
-   [ ] Implement first-person movement and interaction.
-   [ ] Create one shelf, one product box and one stockable product.
-   [ ] Pick up, carry, place and stock the box.
-   [ ] Add basic HUD and interaction prompts.

**Exit criteria:** A player can walk around a small store, carry a box
and stock a shelf.

### Phase 2 --- Single-player simulation loop

-   [ ] Implement product data and fixture capacity.
-   [ ] Implement supplier orders and delivery.
-   [ ] Implement prices, stock and economy.
-   [ ] Implement a basic customer that browses, buys and queues.
-   [ ] Implement a functioning checkout and payment.
-   [ ] Implement prep, open and closing phases.
-   [ ] Implement daily summary and save/load.

**Exit criteria:** One player can complete multiple full business days
and retain progression.

### Phase 3 --- Multiplayer foundation

-   [ ] Select networking library after proof-of-concept comparison.
-   [ ] Implement host/join and player spawning.
-   [ ] Synchronize movement and player actions.
-   [ ] Synchronize boxes, fixture stock and checkout state.
-   [ ] Make economy and inventory transactions authoritative.
-   [ ] Add session roster, invitations and disconnect handling.
-   [ ] Run 2/4/8-player tests.

**Exit criteria:** Multiple players can operate the same store without
duplicated or contradictory game state.

### Phase 4 --- Complete MVP systems

-   [ ] Finish all MVP systems listed in Section 3.
-   [ ] Add remaining products, licences and upgrades.
-   [ ] Add employees, theft, spills, expiry and daily goals.
-   [ ] Add all four store levels.
-   [ ] Finish the UI and audio baseline.
-   [ ] Implement robust save versioning and recovery.

**Exit criteria:** The complete intended MVP feature checklist is
implemented and testable.

### Phase 5 --- Polish, optimization and Steam readiness

-   [ ] Replace placeholder art with final MVP assets.
-   [ ] Optimize NPC navigation and crowd performance.
-   [ ] Profile CPU, GPU, memory and network traffic.
-   [ ] Test low/medium/high graphics settings.
-   [ ] Test different resolutions and aspect ratios.
-   [ ] Test reconnects, host disconnects and save recovery.
-   [ ] Run closed multiplayer playtests.
-   [ ] Fix release-blocking bugs.
-   [ ] Package Windows build and integrate Steamworks.
-   [ ] Prepare store page assets, trailer and onboarding.

**Exit criteria:** A stable Windows/Steam release candidate passes the
release checklist.

------------------------------------------------------------------------

## 7. MVP Acceptance Criteria

The MVP is not complete just because every menu or system exists. The
following end-to-end tests must pass.

### Gameplay acceptance

-   [ ] A new player can start a new store with the intended initial
    cash and starter stock.
-   [ ] Players can order, receive, carry and stock products.
-   [ ] Customers can find products, buy them and complete checkout.
-   [ ] Cash, card and UPI flows work according to purchased
    equipment/unlocks.
-   [ ] Correct and incorrect cash change are handled consistently.
-   [ ] Stock quantity is correct after every sale.
-   [ ] Expired products are refused and can be removed/disposed.
-   [ ] The store can close and calculate revenue, costs, rent and
    wages.
-   [ ] Daily goals and rewards are applied once.
-   [ ] Players can buy licences, equipment and store expansions.
-   [ ] Progression persists after leaving and rejoining.

### Multiplayer acceptance

-   [ ] Two players can join the same session and see each other.
-   [ ] Up to eight players can join within the target hardware/network
    profile.
-   [ ] Players see consistent movement and carried objects.
-   [ ] Two players cannot sell or consume the same stock twice.
-   [ ] Shared money and progression remain consistent.
-   [ ] Invalid or out-of-range actions are rejected.
-   [ ] Disconnecting a client does not corrupt the shared store.
-   [ ] Host disconnect behaviour is clearly handled and saved progress
    is protected.

### Quality acceptance

-   [ ] No known critical or blocker bugs.
-   [ ] No progression-breaking save corruption in tested recovery
    scenarios.
-   [ ] No persistent NPC navigation deadlocks in standard playtests.
-   [ ] Performance target is defined and met on agreed minimum PC
    hardware.
-   [ ] UI is readable at 1080p and common widescreen resolutions.
-   [ ] A packaged build can be installed and launched on a clean
    Windows PC.

------------------------------------------------------------------------

## 8. Testing Strategy

### Automated tests

-   Product definitions, prices and licence availability.
-   Fixture capacity and compatible product types.
-   Ordering, delivery and stock accounting.
-   Checkout totals, price locking and payment outcomes.
-   Cash change calculations.
-   Economy, rent, wages and daily close calculations.
-   Store level and upgrade prerequisites.
-   Product expiry and waste handling.
-   Save/load round trips and save-version migration.
-   Network message validation and transaction idempotency.

### Play-mode tests

-   Player movement and collision.
-   Pickup/drop/stock interactions.
-   Customer navigation and checkout.
-   Employee navigation and task completion.
-   Store phase transitions.
-   UI interaction flows.
-   Multiplayer object/state synchronization.

### Manual test sessions

-   Solo full-day playthrough.
-   Two-player cooperative playthrough.
-   Four-player busy-store playthrough.
-   Eight-player stress session.
-   Disconnect/reconnect tests.
-   Host shutdown and save recovery.
-   Long session with multiple store expansions.

------------------------------------------------------------------------

## 9. Risks and Decisions to Resolve

  -----------------------------------------------------------------------
  Risk/decision           Why it matters          Proposed action
  ----------------------- ----------------------- -----------------------
  Networking framework    Replacing the custom    Build a small
                          protocol is a major     comparison prototype
                          architecture decision   before committing

  Host authority          Host can potentially    Validate all
                          manipulate state or     transactions; protect
                          disconnect              saves; consider
                                                  dedicated server
                                                  post-MVP

  NPC performance         Customers and employees Profile early with
                          can become CPU-heavy    realistic peak
                                                  population

  Asset workload          Replacing procedural    Establish art direction
                          geometry with quality   and asset budget early
                          assets takes time       

  Scope growth            The existing prototype  Treat Section 3 as the
                          already contains many   agreed MVP; put new
                          systems                 ideas in post-MVP
                                                  backlog

  Save migration          Browser JSON saves will Decide whether to
                          not automatically match support importing
                          Unity data              existing saves;
                                                  otherwise start a new
                                                  Unity save format

  Product branding        Prototype uses invented Continue using original
                          brands and original     fictional brands and
                          artwork                 assets

  Steam integration       Invites, lobbies and    Test Steam integration
                          identity affect         early, not at the very
                          multiplayer design      end
  -----------------------------------------------------------------------

### Important save decision

The current prototype has three JSON save slots. The Unity game should
have a new, versioned save schema. Do not assume the browser saves can
be loaded directly. If preserving existing player progress is important,
build and test a one-time importer; otherwise clearly treat the Unity
release as a fresh start.

------------------------------------------------------------------------

## 10. Recommended First Sprint

The first sprint should prove the engine and architecture before
implementing the full game.

### Sprint 1 --- Unity foundation

1.  Create the Unity 6 LTS project with URP.
2.  Configure Git and Git LFS.
3.  Create the folder structure and coding conventions.
4.  Create `Bootstrap`, `MainMenu`, `Supermarket` and `TestMap` scenes.
5.  Implement first-person movement and camera.
6.  Implement an interaction raycast/interface.
7.  Create a product ScriptableObject and one product prefab.
8.  Create one shelf fixture with capacity.
9.  Implement pickup, carry, drop and stock.
10. Add a simple HUD showing interaction prompt and carried item.
11. Add Edit Mode/Play Mode tests for inventory and stocking.
12. Record a short playable build for review.

### Sprint 1 demo definition

A Windows development build in which one player can: - Launch the
game. - Enter a small supermarket. - Walk and look around. - Pick up a
delivery box. - Carry it to a shelf. - Stock the shelf. - See the shelf
quantity update. - Drop or move the box without duplicating or losing
it.

**Do not start by building the entire supermarket map, all 36 products,
or all multiplayer systems.** Prove the core interaction loop first.

------------------------------------------------------------------------

## 11. Definition of Done

A feature is considered done only when:

1.  Its gameplay behaviour is implemented.
2.  Its UI and feedback are implemented.
3.  It works in the intended multiplayer context.
4.  Server/host authority and validation are handled where applicable.
5.  Automated tests cover important rules.
6.  It has been tested in a packaged development build.
7.  It does not break save/load or existing MVP systems.
8.  Its configuration and behaviour are documented.

------------------------------------------------------------------------

## 12. Final Recommendation

Build MiniMart Mayhem as a **Unity + C# first-person co-op supermarket
simulator for Windows/Steam**, with up to eight players in the MVP.

Use the current Node.js/Three.js project as the design and gameplay
reference, not as code to mechanically translate. Preserve the existing
product catalogue, business loop, checkout mechanics, staff, store
expansion and progression concepts where they test well. Rebuild the
implementation in modular Unity systems and validate multiplayer
architecture early.

The most important milestone is not the graphics or the number of
products. It is a reliable multiplayer loop:

**Join friends → prepare the store → stock products → serve customers →
complete checkout → earn money → expand the shop → save progression →
play another day.**

That loop should be fun and reliable before expanding the content or
adding advanced simulation.
