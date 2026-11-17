# MiniMart Mayhem: prototype behaviour spec

**Phase 0 deliverable.** This is the written reference for the Unity rebuild. Every number and rule
below was read from the browser prototype's simulation (`minimart-latest.zip` → `game.js`,
`server.js`, README), not from memory. Where the README and the code disagree, the code wins and
the difference is noted. Where the Unity build deliberately differs (blueprint or web/LAN decisions),
§3, §4 and §16 say so.

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
| Starter stock | **None.** Fixtures start empty, no boxes. | Plan §7 expects "starter stock": a design decision for Unity (see §16) |
| Open phase length | 300 s | `MM_DAY`; store clock maps it to 08:00–22:00 |
| Closing grace | 50 s | `MM_CLOSE`; clock runs 22:00–22:45 |
| Delivery delay | 9 s (+0.3 s per extra box in the order) | `MM_DELIVERY`; Express supplier × 0.4 |
| Player speed | walk 2.6 t/s (5.2 m/s) · sprint 3.7 t/s (7.4 m/s) · carrying 2.0 t/s (4.0 m/s) | can't sprint while carrying |
| Player radius | 0.33 t (0.66 m) | |
| Interaction reach | 2.2 t (4.4 m) | must be roughly in front: facing dot ≥ 0.34, or within 0.75 t |
| Customer speed | 1.55 t/s; rushed × 1.15; ×1.5 in the car park | thief flees at 2.55 (2.05 with CCTV) |
| Staff speed | 2.3 t/s | |
| Player scan time | 0.22 s per item | Fast scanner × 0.6 |
| NPC cashier scan time | 0.5 s per item | Fast scanner × 0.6 |
| Max promotions | 3 | |
| Max boxes (loose + pending) | 240 | order refused beyond this |
| Max boxes in one pending delivery queue | 60 | |
| Boxes per order | 1–20 | clamped |
| Price range | ₹1–₹9,999, whole rupees | |
| Simulation / snapshots | 30 Hz / 15 Hz | server-authoritative |
| Save slots | 3 JSON files, save version 4 | |

## 2. Product catalogue (36 products, 7 licence lines)

Supplier cost is ~80% of MRP. One box = `Units/box` units; ordering one box costs `cost × units/box`.
Brands are invented. Shelf life is in business days; `–` means it never expires.

| # | Product | Brand | Pack | Kind | Supplier cost | MRP | Units/box | Shelf life (days) | Licence |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Bread Loaf | Golden Crust | 400 g | dry | ₹37 | ₹45 | 10 | 2 | Daily essentials |
| 1 | Rice 1kg | Sona Grain | 1 kg | dry | ₹66 | ₹80 | 10 | – | Daily essentials |
| 2 | Cola Can | Fizzup | 300 ml | dry | ₹32 | ₹40 | 24 | – | Daily essentials |
| 3 | Chips Pack | Crunchos | 52 g | dry | ₹16 | ₹20 | 24 | – | Daily essentials |
| 4 | Soap Bar | Neem Fresh | 100 g | dry | ₹34 | ₹42 | 24 | – | Daily essentials |
| 5 | Coffee Jar | Brewhouse | 50 g | dry | ₹150 | ₹185 | 12 | – | Kitchen staples |
| 6 | Noodles Cup | Oodle | 70 g | dry | ₹40 | ₹50 | 24 | – | Daily essentials |
| 7 | Biscuits | Tea Time | 200 g | dry | ₹24 | ₹30 | 24 | – | Daily essentials |
| 8 | Tea Pack | Assam Leaf | 250 g | dry | ₹118 | ₹145 | 12 | – | Kitchen staples |
| 9 | Cereal Box | Morning Crunch | 475 g | dry | ₹172 | ₹210 | 8 | – | Breakfast & treats |
| 10 | Shampoo | Silkroot | 180 ml | dry | ₹150 | ₹185 | 12 | – | Personal care |
| 11 | Toothpaste | Brightsmile | 150 g | dry | ₹85 | ₹105 | 18 | – | Personal care |
| 12 | Detergent | Washwell | 1 kg | dry | ₹115 | ₹140 | 10 | – | Personal care |
| 13 | Chocolate | Cocomo | 50 g | dry | ₹40 | ₹50 | 24 | – | Breakfast & treats |
| 14 | Cooking Oil | Sunfield | 1 L | dry | ₹145 | ₹170 | 12 | – | Kitchen staples |
| 15 | Atta 5kg | Chakki Gold | 5 kg | dry | ₹300 | ₹355 | 4 | – | Kitchen staples |
| 16 | Milk Packet | Dairyfield | 500 ml | chilled | ₹26 | ₹30 | 16 | 3 | Daily essentials |
| 17 | Egg Tray | Farm Fresh | 6 eggs | chilled | ₹45 | ₹54 | 12 | 5 | Daily essentials |
| 18 | Paneer | Malai | 200 g | chilled | ₹78 | ₹95 | 12 | 3 | Dairy & fruit |
| 19 | Yogurt Cup | Dahi Day | 400 g | chilled | ₹37 | ₹45 | 16 | 4 | Dairy & fruit |
| 20 | Butter | Creamline | 100 g | chilled | ₹52 | ₹62 | 20 | 6 | Dairy & fruit |
| 21 | Orange Juice | Sunny Orchard | 1 L | chilled | ₹100 | ₹125 | 12 | 5 | Breakfast & treats |
| 22 | Ice Cream Tub | Polar Scoop | 700 ml | frozen | ₹175 | ₹220 | 8 | – | Frozen foods |
| 23 | Frozen Peas | FrostGreen | 500 g | frozen | ₹88 | ₹110 | 12 | – | Frozen foods |
| 24 | Frozen Pizza | Napoli Oven | 280 g | frozen | ₹195 | ₹240 | 6 | – | Frozen foods |
| 25 | Bananas | Fresh | 1 dozen | produce | ₹45 | ₹60 | 10 | 3 | Dairy & fruit |
| 26 | Apples | Fresh | 1 kg | produce | ₹160 | ₹200 | 10 | 6 | Dairy & fruit |
| 27 | Tomatoes | Fresh | 1 kg | produce | ₹30 | ₹40 | 12 | 3 | Daily essentials |
| 28 | Onions | Fresh | 1 kg | produce | ₹29 | ₹38 | 14 | 8 | Daily essentials |
| 29 | Potatoes | Fresh | 1 kg | produce | ₹24 | ₹32 | 14 | 10 | Daily essentials |
| 30 | Lemon Soda | Fizzup | 300 ml | dry | ₹32 | ₹40 | 24 | – | Premium & imported |
| 31 | Dark Chocolate | Cocomo | 80 g | dry | ₹100 | ₹125 | 24 | – | Premium & imported |
| 32 | Green Tea | Assam Leaf | 25 bags | dry | ₹128 | ₹160 | 12 | – | Premium & imported |
| 33 | Basmati 5kg | Sona Grain | 5 kg | dry | ₹520 | ₹650 | 4 | – | Premium & imported |
| 34 | Mango Drink | Sunny Orchard | 1 L | chilled | ₹92 | ₹115 | 12 | 5 | Premium & imported |
| 35 | Choco Ice Cream | Polar Scoop | 700 ml | frozen | ₹185 | ₹230 | 8 | – | Premium & imported |

Kind → fixture: **dry → shelf**, **chilled → fridge**, **frozen → freezer**, **produce → produce crate**.
Each product also has a packaging shape (`can`, `bottle`, `jar`, `cup`, `chips`, `pouch`, `sack`,
`carton`, `eggs`, `block`, `tub`/`icetub`, `flat`, `loaf`, `bag`, `box`, `tallbox`, `soap`, `paste`,
`bar`, `biscuit`, `oil`, and produce shapes `banana`, `apple`, `tomato`, `onion`, `potato`) and two
brand colours. These are in the JSON for art direction.

## 3. Fixtures and capacity

| Fixture | Base capacity (units) | With Deep shelving (×1.5, rounded) |
|---|---|---|
| Shelf | 24 | 36 |
| Fridge | 18 | 27 |
| Freezer | 16 | 24 |
| Produce crate | 20 | 30 |

Fixture counts by store level (cumulative):

| Level | Shelves | Fridges | Freezers | Produce | Tills |
|---|---|---|---|---|---|
| 1 Corner Shop | 8 | 2 | 0 | 2 | 2 |
| *Unity Level 1* | *4* | *1* | *0* | *1* | *1* |
| 2 Mini Market | 18 | 5 | 0 | 4 | 4 |
| 3 Supermarket | 38 | 12 | 4 | 4 | 4 |
| 4 Superstore | 56 | 19 | 4 | 8 | 6 |

Note: README says 56 shelves when fully grown, which matches. Frozen products cannot be stocked
anywhere until level 3 (the first freezers), which is also when the Frozen licence unlocks.

In the prototype **a fixture holds exactly one product at a time** (`pid`, `qty`, `life`). A fixture
whose zone is not yet unlocked is inactive: it cannot be stocked and customers ignore it.

**Unity (blueprint §9):** fixtures are split into **slots**, each holding one product. The prototype
capacities are kept as slot totals, so balance doesn't move:

| Fixture | Layout | Units per slot | Total | Deep shelving |
|---|---|---|---|---|
| Shelf | 3 levels × 2 slots | 4 | 24 | 6 per slot, 36 |
| Fridge | 3 levels × 3 slots | 2 | 18 | 3 per slot, 27 |
| Freezer | 2 rows × 4 slots | 2 | 16 | 3 per slot, 24 |
| Produce crate | 1 row × 5 slots | 4 | 20 | 6 per slot, 30 |

## 4. Boxes, carrying and stocking (Sprint 1 core)

A box is `{ product, units, life }`. A player carries **at most one box**. Rules, in the order the
prototype checks them when the player looks at a fixture while carrying a box:

1. Fixture locked (zone not unlocked) → blocked: "Locked - expand to a ‹level› first".
2. Fixture kind ≠ product's fixture kind → blocked: "‹product› goes in a ‹fixture›".
3. Box has expired (`life ≤ 0`) → blocked: "This box has expired - throw it in the waste bin".
4. Fixture holds expired stock → blocked: "Expired ‹product› here - clear it with R first".
5. Fixture empty, **or** holds the same product:
   - same product and full → blocked: "This one is full";
   - otherwise → **Stock** ("Stock ‹product› (qty/cap)").
6. Fixture holds a different product → blocked: "Holds ‹product› - empty it with R first".

**Stock** moves `min(cap − qty, box.units)` units from box to fixture in one action (not one unit
per press). If the fixture was empty it takes the box's product and shelf life. If it already had
stock, its life becomes `min(fixture.life, box.life)` (oldest stock wins). A box that reaches 0
units disappears. Units moved count towards the player's and the day's "stocked" stat.

**Empty (R)** on a fixture while empty-handed: if the stock is expired it is written off as waste
(`qty × cost`) and the fixture is cleared; otherwise the whole contents become a new box in the
player's hands (same product, units and life) and the fixture is cleared. You can't empty while
carrying.

**Drop (Q)** puts the box 0.55 t in front of the player, or at the player's feet if that spot is
blocked. **Pick up (E)** takes the nearest box in reach. **Waste bin**: using it while carrying
destroys the box and records `units × cost` as waste.

**Unity changes (blueprint §8, §9):**

- **Box states:** Delivered → Held → OnGround / Stored → Held → … → Discarded. A box must be **opened (F)**
  while held before anything can come out of it (Opened). Stocking it to zero leaves an **Empty** box in your
  hands until you bin it or put it down; it no longer vanishes.
- **One unit per press** into the slot you're aiming at (hold E to repeat). With no slot aimed at, it tops up
  a slot of the same product first, then the first empty slot. Check order: locked → wrong fixture → box not
  open ("Open the box first") → box empty → box expired → slot expired → slot holds another product
  ("This slot holds ‹product›") → slot full ("This slot is full") → **Stock ‹product› (qty/cap)**.
- **R while carrying** takes one unit off the aimed slot back into your open box (same product, room left).
  **R empty-handed** empties the aimed slot: good stock becomes an open box in your hands, expired stock is waste.
- **Storage rack:** a held box can be stored in a free rack position (kinematic, snapped); pick it up again with E.
- **Safe drop (Q):** the box goes in front of you only where there's floor (≤ 30° slope), no wall between you
  and the spot, and nothing in the way; otherwise "No room to put the box down here" and you keep it.
  Physics states: A resting (kinematic), B held (kinematic, colliders off), C dropped (dynamic until it settles,
  then back to A; below y −5 it returns to its last safe spot).
- **Leaving:** a player who leaves drops their box where they stood.

Conservation: in every one of these actions units are moved, never copied. Units leave the game
only by sale, theft, waste or a customer walking out with a basket (counted as `lost`).

Low/sold-out alerts: "Running low" once when `qty ≤ 25% of cap`; "Sold out" once at 0. Both reset
when the fixture is restocked (low resets once it is at least 50% full).

## 5. Ordering and deliveries

- Ordered at the terminal in storage. Product must be licensed.
- Cost is paid immediately. Not enough cash → refused.
- Each box arrives `delay + 0.3 s × index` later on the delivery pad (6×6 tiles), then overflows
  into the rest of storage, never stacking two boxes within 0.6 t.
- Delivered boxes are full (`units/box`) and carry the product's full shelf life.

## 6. Licences

| Licence | Store level | Cost | Products |
|---|---|---|---|
| Daily essentials | 1 | free | Bread Loaf, Rice 1kg, Cola Can, Chips Pack, Soap Bar, Noodles Cup, Biscuits, Milk Packet, Egg Tray, Tomatoes, Onions, Potatoes |
| Kitchen staples | 1 | ₹1,200 | Coffee Jar, Tea Pack, Cooking Oil, Atta 5kg |
| Personal care | 2 | ₹2,000 | Shampoo, Toothpaste, Detergent |
| Dairy & fruit | 2 | ₹2,800 | Paneer, Yogurt Cup, Butter, Bananas, Apples |
| Breakfast & treats | 3 | ₹3,500 | Cereal Box, Chocolate, Orange Juice |
| Frozen foods | 3 | ₹5,000 | Ice Cream Tub, Frozen Peas, Frozen Pizza |
| Premium & imported | 4 | ₹8,000 | Lemon Soda, Dark Chocolate, Green Tea, Basmati 5kg, Mango Drink, Choco Ice Cream |

Customers only ask for products whose licence you own.

## 7. Store levels

Buying the next level needs **all three**: cash ≥ cost, lifetime shoppers served ≥ target, reputation ≥ target.
The cost is deducted; the hoarding wall for that zone is removed.

| Level | Name | Cost | Served (lifetime) | Reputation | Rent/day | Max shoppers/day | Max in store at once |
|---|---|---|---|---|---|---|---|
| 1 | Corner Shop | – | 0 | 0 | ₹300 | 34 | 12 |
| 2 | Mini Market | ₹7,500 | 50 | 0 | ₹700 | 60 | 20 |
| 3 | Supermarket | ₹20,000 | 180 | 55 | ₹1400 | 92 | 30 |
| 4 | Superstore | ₹45,000 | 450 | 65 | ₹2400 | 130 | 40 |

## 8. Equipment and staff

| Key | Name | Store level | Cost | Max | Wage/day | Effect |
|---|---|---|---|---|---|---|
| `cardpos` | Card & UPI machine | 1 | ₹1,200 | 1 | – | Shoppers can pay by card or UPI: no change to count, and 10% more shoppers. |
| `scanner` | Fast barcode scanner | 1 | ₹1,800 | 1 | – | Every till scans items 40% faster. |
| `ac` | Air conditioning | 1 | ₹1,500 | 1 | – | Shoppers wait 25% longer before giving up. |
| `cctv` | CCTV + door alarm | 1 | ₹3,000 | 1 | – | Half as many shoplifters, and the ones who run are slower. |
| `express` | Express supplier | 2 | ₹2,500 | 1 | – | Deliveries arrive in well under half the time. |
| `ads` | Radio ads | 2 | ₹2,000 | 1 | – | 25% more shoppers every day. |
| `deep` | Deep shelving | 3 | ₹6,000 | 1 | – | Every fixture holds 50% more stock. |
| `cashier` | Hire a cashier | 1 | ₹1,800 / ₹2,600 / ₹3,600 | 3 | ₹350 | Staffs a free till, scans and takes payment on their own. Wage ₹350/day each. |
| `stocker` | Hire a stock clerk | 1 | ₹2,500 / ₹3,400 / ₹4,500 | 3 | ₹450 | Carries boxes from storage and fills shelves. Wage ₹450/day each. |

Effects in code: Card & UPI unlocks non-cash payment and × 1.1 footfall; scanner × 0.6 scan time;
AC × 1.25 patience; CCTV × 0.5 thief chance and slower flee; Express × 0.4 delivery delay; Radio
ads × 1.25 footfall; Deep shelving × 1.5 capacity. Upgrades save immediately after purchase.

## 9. Day cycle

`prep → open → closing → summary → prep (next day)`

- **Prep**: no clock (shows 07:30), no customers. Any player pressing Enter opens the store. The
  "stocked" count from prep carries into the day's ledger; everything else resets on opening.
- **Open**: 300 s. Clock = 08:00 + 14 h × elapsed fraction. Customers spawn; spills spawn.
- **Closing**: no new customers; 50 s grace. Ends early once the store is empty. When it ends, any
  customer still inside is removed and their basket counted as `lost`.
- **Close-of-day** (in this order): rent `level rent + ₹25 × day` and wages are paid; goal bonuses
  paid; +2 reputation if all three goals were met; every perishable on fixtures, in loose boxes,
  in players' hands and staff hands loses one day of life (minimum 0); employee of the day
  calculated; day number increments; new weather rolled; spills cleared; save.
- **Summary**: receipt screen. Any player pressing Enter starts the next prep (new goals rolled).

Profit on the summary = revenue + goal bonus − goods ordered − upgrades/licences/levels bought − rent − wages.

Employee of the day score = stocked + scanned + 5 × served + 20 × thieves caught + 8 × spills cleaned.

Weather per day: clear 50%, rain 20% (footfall × 0.8, spills × 3), festival 15% (footfall × 1.45,
spills × 1.3), heatwave 15% (footfall × 1.05, chilled/frozen wanted 2.5× as often).

## 10. Footfall

Target shoppers for the day = `min(18 + 5 × day + 0.3 × rep + min(30, 0.25 × loyalty members), level cap)`
× weather × (Radio ads 1.25) × (Card & UPI 1.1). Spawn interval = `clamp(300 / target, 0.9 s, 14 s)`
× random 0.6–1.4. No spawn while the store holds `crowd` customers or more.

## 11. Customers

- **Type** on spawn: bulk 18% (4–7 items, trolley), rushed 20% (1–2 items), regular 62% (1–4 items).
- **Shopping list**: 80% picked from what is currently stocked (weighted: promoted ×3, heatwave
  chilled/frozen ×2.5), 20% any licensed product (may be out of stock). No duplicates.
- **Loyalty member** chance = `min(0.5, members / 120)`. Members get patience × 1.2 and one extra item if their list is under 5.
- **Patience**: rushed 30–45 s, others 45–80 s; × 1.25 with AC; × 1.2 for members. Drains only while waiting or queueing (× 1.35 at an unstaffed till).
- **Price tolerance**: each customer rolls `tol` in 1.02–1.32. At the shelf they refuse if `price > MRP × tol`.
- At the shelf, per wanted product:
  - not on any active fixture → missed, rep −0.25;
  - expired → missed, rep −0.5 (one toast per fixture);
  - too expensive → missed, rep −0.35;
  - otherwise takes `random 1..maxQty` (capped by stock), where maxQty = 3 if price < 85% of MRP,
    2 if < 110%, else 1; +1 for bulk; +1 if on an active promotion. **Price is fixed at the shelf.**
- **Promotion is active** only when the product is promoted **and** its price ≤ MRP.
- Then: no items → leave. Thief → flee. Otherwise choose a till: active, queue < 4, score = queue
  length + 3.5 if unstaffed + small random. No till → wait 2 s and retry (patience drains).
- Queue: max 4 per till, 0.85 t apart. Patience 0 → walk out: rep −1.4, basket counted `lost`.
- Spill: walking over one (within 0.5 t) → slip, 1.2 s stun, rep −0.6.

## 12. Checkout and payment

Player stands on the till's mat (within 1 t of the clerk spot) to man it; one player per till.

1. **Scan** (Space): one unit per press, cooldown = scan time. Bill shows product, qty, unit price.
2. After the last unit, Space asks for payment.
3. **Payment choice** (without Card & UPI machine: always cash). With it, cash chance is 55% if
   total < ₹150, 40% if < ₹600, else 25%; of the rest, 55% UPI and 45% card.
   - **Card**: 1.8–2.8 s; 7% declined (README says "about 1 in 14", which matches) → pays cash.
   - **UPI**: 2.0–3.2 s, always approves.
   - **Cash**: tender = exact 12% of the time; otherwise a weighted round-up to the next ₹10 (w3),
     ₹50 (w3), ₹100 (w3) or ₹500 (w2), skipping duplicates and any that equal the total.
4. **Change** (cash drawer): ₹500 / 200 / 100 / 50 / 20 / 10 notes, ₹5 / 2 / 1 coins. Player submits a sum.
   - Too little → sale waits for the rest, rep −0.3, customer marked "shorted".
   - Too much → sale completes; overpay comes out of store cash.
   - Exact (and change was due, and not shorted earlier) → counts towards the "exact change" goal.
5. **Sale complete**: store cash += total − overpay; revenue += total; served +1 (day and lifetime);
   rep +0.5 if happy (patience > 18 s left, no missed items, not shorted) else +0.15; a happy
   non-member joins the loyalty club 15% of the time. Receipt: bill no., till, clock, day, method,
   total, tendered, change, lines, member flag, cashier name. GST is shown on the receipt as 5% included in the total: `round(total − total / 1.05)` (client side only).
6. NPC cashiers scan at 0.5 s, take 1.4 s to count change and always give it exactly.

## 13. Daily goals

Three distinct goals per day from this pool; each pays **₹250 + ₹100 × day**; all three → +2 rep.

| Goal | Target |
|---|---|
| Serve N shoppers | N = round(min(6 + 3 × day, 0.55 × level cap)) |
| Take ₹N in sales | N = round(min(800 + 500 × day, 95 × level cap) / 50) × 50 |
| Stock N items | N = round(min(60 + 20 × day, 9 × active fixtures) / 5) × 5 |
| No shoplifter gets away | escaped = 0 |
| No shopper walks out angry | walkouts = 0 |
| Leave no spill at closing | spills = 0 at close |
| Close with reputation R+ | R = min(95, round(rep) + 3) |
| Sell 10 items on promotion | |
| Give 5 shoppers exact change | |

## 14. Incidents

- **Shoplifter** chance per customer = `(0.04 + max(0, 50 − rep) × 0.002)` × 0.5 with CCTV. They
  shop normally then flee. Caught (E within reach + 0.4) → basket drops as boxes, rep +0.8.
  Escape → stock value lost, rep −1.0.
- **Spills**: one every 35–70 s (scaled by weather), max 5, never on till pads. 3 mop presses to
  clean. Each spill drains rep at 0.012/s while the store is open or closing.

## 15. Saving (prototype v4)

Saved: day, cash, rep, prices, promos, loyalty count, upgrades, weather, career stats by player
name, store level, licences, lifetime served, bill number, every fixture `[pid, qty, life]`, every
box (loose, carried, staff-held) with position and life, pending deliveries with time remaining.
Written atomically (temp file + rename) at end of day, after each purchase, every 2 minutes, and on
shutdown. Loading validates every field and clamps it. The Unity save format will be new and
versioned (plan §9); importing browser saves is not planned unless you ask for it.

## 16. Decisions for the Unity build

| Area | Prototype | Unity decision (proposed) |
|---|---|---|
| Starter stock | none | **Decided (Akshay, 2026-11-17): none.** Players buy stock every day; everything on fixtures, in storage and on the floor carries over to the next day (perishables lose a day). |
| Starting cash | ₹5,000 | **₹8,000** (`StartingState.Cash`). ₹5,000 bought only ~¾ of one box of each of the 12 Day 1 products (₹6,592); ₹8,000 covers all of them plus Day 1 rent (₹325). |
| Store size at start | 8 shelves, 2 fridges, 2 produce, 2 tills | **Start small (Akshay): 4 shelves, 1 fridge, 1 produce crate, 1 till.** The building has an expansion area behind a temporary wall that later levels open; level costs and fixture counts for Levels 2-4 to be rebalanced with that. |
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
