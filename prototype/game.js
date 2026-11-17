'use strict';
/*
 * MiniMart Mayhem - authoritative game simulation.
 * Original work. Co-op supermarket management on a tile grid (1 tile = 2 m in 3D).
 *
 * Coordinates: x grows east, y grows south. The store's front (glass + doors) faces
 * south onto the car park; the storage room is the west end of the building.
 */

const fs = require('fs');
const path = require('path');

const MAP_W = 60, MAP_H = 46;

// kind = which fixture the product lives on
// Pack sizes and MRPs follow typical Indian shelf prices (2026); cost is the
// supplier price (about 80% of MRP). Brands are invented for the game.
// art = which packaging artwork the client paints.
const PRODUCTS = [
  // ---- dry goods (shelves)
  { id: 0,  name: 'Bread Loaf',    brand: 'Golden Crust',  size: '400 g',   kind: 'dry',     cost: 37,  base: 45,  per: 10, color: '#d9a05b', c2: '#7a3b12', shape: 'loaf',    art: 'bread', life: 2 },
  { id: 1,  name: 'Rice 1kg',      brand: 'Sona Grain',    size: '1 kg',    kind: 'dry',     cost: 66,  base: 80,  per: 10, color: '#2f7d4a', c2: '#f4ead2', shape: 'bag',     art: 'rice' },
  { id: 2,  name: 'Cola Can',      brand: 'Fizzup',        size: '300 ml',  kind: 'dry',     cost: 32,  base: 40,  per: 24, color: '#c62d2d', c2: '#ffffff', shape: 'can',     art: 'cola' },
  { id: 3,  name: 'Chips Pack',    brand: 'Crunchos',      size: '52 g',    kind: 'dry',     cost: 16,  base: 20,  per: 24, color: '#f2c14e', c2: '#d1342c', shape: 'chips',   art: 'chips' },
  { id: 4,  name: 'Soap Bar',      brand: 'Neem Fresh',    size: '100 g',   kind: 'dry',     cost: 34,  base: 42,  per: 24, color: '#4fae7f', c2: '#ffffff', shape: 'soap',    art: 'soap' },
  { id: 5,  name: 'Coffee Jar',    brand: 'Brewhouse',     size: '50 g',    kind: 'dry',     cost: 150, base: 185, per: 12, color: '#3b2416', c2: '#d9a441', shape: 'jar',     art: 'coffee' },
  { id: 6,  name: 'Noodles Cup',   brand: 'Oodle',         size: '70 g',    kind: 'dry',     cost: 40,  base: 50,  per: 24, color: '#e8562a', c2: '#ffd23f', shape: 'cup',     art: 'noodles' },
  { id: 7,  name: 'Biscuits',      brand: 'Tea Time',      size: '200 g',   kind: 'dry',     cost: 24,  base: 30,  per: 24, color: '#1f4fa0', c2: '#f2c230', shape: 'biscuit', art: 'biscuit' },
  { id: 8,  name: 'Tea Pack',      brand: 'Assam Leaf',    size: '250 g',   kind: 'dry',     cost: 118, base: 145, per: 12, color: '#7a1f2b', c2: '#e9c46a', shape: 'box',     art: 'tea' },
  { id: 9,  name: 'Cereal Box',    brand: 'Morning Crunch',size: '475 g',   kind: 'dry',     cost: 172, base: 210, per: 8,  color: '#f08c1a', c2: '#ffffff', shape: 'tallbox', art: 'cereal' },
  { id: 10, name: 'Shampoo',       brand: 'Silkroot',      size: '180 ml',  kind: 'dry',     cost: 150, base: 185, per: 12, color: '#7b3fa0', c2: '#f7d6ff', shape: 'bottle',  art: 'shampoo' },
  { id: 11, name: 'Toothpaste',    brand: 'Brightsmile',   size: '150 g',   kind: 'dry',     cost: 85,  base: 105, per: 18, color: '#e23b3b', c2: '#ffffff', shape: 'paste',   art: 'paste' },
  { id: 12, name: 'Detergent',     brand: 'Washwell',      size: '1 kg',    kind: 'dry',     cost: 115, base: 140, per: 10, color: '#1e73be', c2: '#ffd23f', shape: 'tallbox', art: 'detergent' },
  { id: 13, name: 'Chocolate',     brand: 'Cocomo',        size: '50 g',    kind: 'dry',     cost: 40,  base: 50,  per: 24, color: '#4a2412', c2: '#d4a24c', shape: 'bar',     art: 'choc' },
  { id: 14, name: 'Cooking Oil',   brand: 'Sunfield',      size: '1 L',     kind: 'dry',     cost: 145, base: 170, per: 12, color: '#f2c230', c2: '#2e7d32', shape: 'oil',     art: 'oil' },
  { id: 15, name: 'Atta 5kg',      brand: 'Chakki Gold',   size: '5 kg',    kind: 'dry',     cost: 300, base: 355, per: 4,  color: '#c0392b', c2: '#f4d58d', shape: 'sack',    art: 'atta' },
  // ---- chilled (fridges)
  { id: 16, name: 'Milk Packet',   brand: 'Dairyfield',    size: '500 ml',  kind: 'chilled', cost: 26,  base: 30,  per: 16, color: '#2f86d6', c2: '#ffffff', shape: 'pouch',   art: 'milk', life: 3 },
  { id: 17, name: 'Egg Tray',      brand: 'Farm Fresh',    size: '6 eggs',  kind: 'chilled', cost: 45,  base: 54,  per: 12, color: '#c9a66b', c2: '#f6ead3', shape: 'eggs',    art: 'eggs', life: 5 },
  { id: 18, name: 'Paneer',        brand: 'Malai',         size: '200 g',   kind: 'chilled', cost: 78,  base: 95,  per: 12, color: '#1f7a4d', c2: '#fffbe8', shape: 'block',   art: 'paneer', life: 3 },
  { id: 19, name: 'Yogurt Cup',    brand: 'Dahi Day',      size: '400 g',   kind: 'chilled', cost: 37,  base: 45,  per: 16, color: '#ffffff', c2: '#1e73be', shape: 'tub',     art: 'curd', life: 4 },
  { id: 20, name: 'Butter',        brand: 'Creamline',     size: '100 g',   kind: 'chilled', cost: 52,  base: 62,  per: 20, color: '#f7d84a', c2: '#c0392b', shape: 'block',   art: 'butter', life: 6 },
  { id: 21, name: 'Orange Juice',  brand: 'Sunny Orchard', size: '1 L',     kind: 'chilled', cost: 100, base: 125, per: 12, color: '#f39c12', c2: '#2e7d32', shape: 'carton',  art: 'juice', life: 5 },
  // ---- frozen (freezers, upgrade)
  { id: 22, name: 'Ice Cream Tub', brand: 'Polar Scoop',   size: '700 ml',  kind: 'frozen',  cost: 175, base: 220, per: 8,  color: '#f4a6c6', c2: '#5b2a86', shape: 'icetub',  art: 'icecream' },
  { id: 23, name: 'Frozen Peas',   brand: 'FrostGreen',    size: '500 g',   kind: 'frozen',  cost: 88,  base: 110, per: 12, color: '#1f6fb2', c2: '#5cc85c', shape: 'bag',     art: 'peas' },
  { id: 24, name: 'Frozen Pizza',  brand: 'Napoli Oven',   size: '280 g',   kind: 'frozen',  cost: 195, base: 240, per: 6,  color: '#1d1d1d', c2: '#e5483b', shape: 'flat',    art: 'pizza' },
  // ---- produce (crates); sold per pack / per kg
  { id: 25, name: 'Bananas',       brand: 'Fresh',         size: '1 dozen', kind: 'produce', cost: 45,  base: 60,  per: 10, color: '#e4d04a', shape: 'banana',  art: 'fruit', life: 3 },
  { id: 26, name: 'Apples',        brand: 'Fresh',         size: '1 kg',    kind: 'produce', cost: 160, base: 200, per: 10, color: '#c0392b', shape: 'apple',   art: 'fruit', life: 6 },
  { id: 27, name: 'Tomatoes',      brand: 'Fresh',         size: '1 kg',    kind: 'produce', cost: 30,  base: 40,  per: 12, color: '#e74c3c', shape: 'tomato',  art: 'fruit', life: 3 },
  { id: 28, name: 'Onions',        brand: 'Fresh',         size: '1 kg',    kind: 'produce', cost: 29,  base: 38,  per: 14, color: '#a8623a', shape: 'onion',   art: 'fruit', life: 8 },
  { id: 29, name: 'Potatoes',      brand: 'Fresh',         size: '1 kg',    kind: 'produce', cost: 24,  base: 32,  per: 14, color: '#b89a62', shape: 'potato',  art: 'fruit', life: 10 },
  // ---- premium line (Superstore licence); desc overrides the printed product line
  { id: 30, name: 'Lemon Soda',    brand: 'Fizzup',        size: '300 ml',  kind: 'dry',     cost: 32,  base: 40,  per: 24, color: '#d9d23a', c2: '#2e7d32', shape: 'can',     art: 'cola', desc: 'Lemon Soda' },
  { id: 31, name: 'Dark Chocolate',brand: 'Cocomo',        size: '80 g',    kind: 'dry',     cost: 100, base: 125, per: 24, color: '#22100a', c2: '#c9a24a', shape: 'bar',     art: 'choc', desc: '70% Dark Chocolate' },
  { id: 32, name: 'Green Tea',     brand: 'Assam Leaf',    size: '25 bags', kind: 'dry',     cost: 128, base: 160, per: 12, color: '#3f8a3a', c2: '#f4ead2', shape: 'box',     art: 'tea', desc: 'Green Tea Bags' },
  { id: 33, name: 'Basmati 5kg',   brand: 'Sona Grain',    size: '5 kg',    kind: 'dry',     cost: 520, base: 650, per: 4,  color: '#1f4f8a', c2: '#f4d58d', shape: 'sack',    art: 'rice', desc: 'Premium Basmati Rice' },
  { id: 34, name: 'Mango Drink',   brand: 'Sunny Orchard', size: '1 L',     kind: 'chilled', cost: 92,  base: 115, per: 12, color: '#f6b21b', c2: '#2e7d32', shape: 'carton',  art: 'juice', desc: 'Alphonso Mango Drink', life: 5 },
  { id: 35, name: 'Choco Ice Cream',brand: 'Polar Scoop',  size: '700 ml',  kind: 'frozen',  cost: 185, base: 230, per: 8,  color: '#6b3a1e', c2: '#f4a6c6', shape: 'icetub',  art: 'icecream', desc: 'Chocolate Ice Cream' },
];

const KIND_FIXTURE = { dry: 'shelf', chilled: 'fridge', frozen: 'freezer', produce: 'produce' };
const FIXTURE_NAME = { shelf: 'shelf', fridge: 'fridge', freezer: 'freezer', produce: 'produce crate' };
const BASE_CAP = { shelf: 24, fridge: 18, freezer: 16, produce: 20 };

// ---- store levels. The shop starts as a corner shop; each level knocks down a hoarding
// wall and opens a new zone of fixtures and tills. Requirements: cash + shoppers served
// (lifetime) + reputation. cap = most shoppers a day, crowd = most in the shop at once.
const STORE_LEVELS = [
  null,
  { name: 'Corner Shop', cost: 0,     served: 0,   rep: 0,  rent: 300,  cap: 34,  crowd: 12,
    desc: '8 shelves, 2 fridges, 2 produce stands and 2 tills.' },
  { name: 'Mini Market', cost: 7500,  served: 50,  rep: 0,  rent: 700,  cap: 60,  crowd: 20,
    desc: 'Knock through to the east: 10 more shelves, 3 fridges, 2 produce stands and tills 3 & 4.' },
  { name: 'Supermarket', cost: 20000, served: 180, rep: 55, rent: 1400, cap: 92,  crowd: 30,
    desc: 'Open the back hall: 20 shelves, a chilled wall of 7 fridges and a frozen aisle of 4 freezers.' },
  { name: 'Superstore',  cost: 45000, served: 450, rep: 65, rent: 2400, cap: 130, crowd: 40,
    desc: 'Open the east wing: 18 shelves, 7 fridges, 4 produce stands and tills 5 & 6.' },
];
const MAX_LEVEL = STORE_LEVELS.length - 1;

// product lines you buy the right to sell; lvl = store level needed first
const LICENSES = {
  essentials: { name: 'Daily essentials',      lvl: 1, cost: 0,    pids: [0, 1, 2, 3, 4, 6, 7, 16, 17, 27, 28, 29] },
  kitchen:    { name: 'Kitchen staples',       lvl: 1, cost: 1200, pids: [5, 8, 14, 15] },
  care:       { name: 'Personal care',         lvl: 2, cost: 2000, pids: [10, 11, 12] },
  dairy:      { name: 'Dairy & fruit',         lvl: 2, cost: 2800, pids: [18, 19, 20, 25, 26] },
  breakfast:  { name: 'Breakfast & treats',    lvl: 3, cost: 3500, pids: [9, 13, 21] },
  frozen:     { name: 'Frozen foods',          lvl: 3, cost: 5000, pids: [22, 23, 24] },
  premium:    { name: 'Premium & imported',    lvl: 4, cost: 8000, pids: [30, 31, 32, 33, 34, 35] },
};
const LICENSE_OF = [];
for (const [k, l] of Object.entries(LICENSES)) for (const pid of l.pids) LICENSE_OF[pid] = k;

const UPGRADES = {
  cardpos: { name: 'Card & UPI machine',  cost: 1200,  lvl: 1, desc: 'Shoppers can pay by card or UPI: no change to count, and 10% more shoppers.' },
  scanner: { name: 'Fast barcode scanner',cost: 1800,  lvl: 1, desc: 'Every till scans items 40% faster.' },
  ac:      { name: 'Air conditioning',    cost: 1500,  lvl: 1, desc: 'Shoppers wait 25% longer before giving up.' },
  cctv:    { name: 'CCTV + door alarm',   cost: 3000,  lvl: 1, desc: 'Half as many shoplifters, and the ones who run are slower.' },
  express: { name: 'Express supplier',    cost: 2500,  lvl: 2, desc: 'Deliveries arrive in well under half the time.' },
  ads:     { name: 'Radio ads',           cost: 2000,  lvl: 2, desc: '25% more shoppers every day.' },
  deep:    { name: 'Deep shelving',       cost: 6000,  lvl: 3, desc: 'Every fixture holds 50% more stock.' },
  cashier: { name: 'Hire a cashier',      cost: [1800, 2600, 3600], max: 3, lvl: 1, wage: 350, desc: 'Staffs a free till, scans and takes payment on their own. Wage ₹350/day each.' },
  stocker: { name: 'Hire a stock clerk',  cost: [2500, 3400, 4500], max: 3, lvl: 1, wage: 450, desc: 'Carries boxes from storage and fills shelves. Wage ₹450/day each.' },
};

// cash the shoppers hand over and the drawer gives back
const NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];
const PAY_LABEL = { cash: 'Cash', card: 'Card', upi: 'UPI' };

const WEATHER = {
  normal:   { label: 'Clear skies',  spawn: 1.0,  spill: 1.0 },
  rain:     { label: 'Rainy day',    spawn: 0.8,  spill: 3.0 },
  festival: { label: 'Festival day', spawn: 1.45, spill: 1.3 },
  heatwave: { label: 'Heatwave',     spawn: 1.05, spill: 1.0 },
};

const PLAYER_COLORS = ['#e45b5b', '#3f8fd8', '#4fb36a', '#e0a33c', '#a66ad6', '#2fbfb5', '#ef7fb0', '#8fa63a'];
const MAX_PLAYERS = 8;

const num = (v, d) => (v !== undefined && !isNaN(parseFloat(v)) ? parseFloat(v) : d);

const DAY_LENGTH = num(process.env.MM_DAY, 300);
const CLOSING_GRACE = num(process.env.MM_CLOSE, 50);
const DELIVERY_DELAY = num(process.env.MM_DELIVERY, 9);
const START_CASH = num(process.env.MM_CASH, 5000);
const START_SERVED = Math.max(0, num(process.env.MM_SERVED, 0) | 0);   // testing: pretend this many were already served

const SPEED = 2.6, SPEED_SPRINT = 3.7, SPEED_CARRY = 2.0;   // tiles/sec
const CUST_SPEED = 1.55, CUST_FLEE = 2.55, CUST_FLEE_CCTV = 2.05;
const STAFF_SPEED = 2.3;
const PLAYER_R = 0.33;
const REACH = 2.2;
const SCAN_TIME = 0.22;
const NPC_SCAN = 0.5;
const FAST_SCAN = 0.6;         // scan-time multiplier with the fast scanner

const SOLID = new Set(['#', 'G', 'L', 'X', 'P', 'S', 'F', 'Z', 'V', 'C', 'R', 'K', 'T', 'U', 'W']);
const BIN = { x: 12, y: 31 };                // waste bin in storage
const MAX_PROMOS = 3;
const MAX_BOXES = 240;                          // loose boxes + deliveries on the way

// ---------------------------------------------------------------- layout

// The shop floor (x 15-56, y 3-32) is four zones. Zone 1 (the corner shop) sits by the
// storage doorway and the entrance; the others hide behind hoarding walls until bought.
//
//   x: 15        27          41            57
//  y3 +-----------------------+-------------+
//     |  zone 3 (level 3)     |             |
//     |  back hall            |  zone 4     |
//  14 +=====(wall, lvl 3)=====+  (level 4)  |
//     | zone 1  |  zone 2     |  east wing  |
//     | (lvl 1) |  (lvl 2)    |             |
//  33 +--door---+-------------+-------------+
//
// Every fixture is 2 tiles wide and faces south (shoppers stand at y + 1.6).
const ZONES = [
  { lvl: 1, x0: 15, y0: 15, x1: 26, y1: 32 },
  { lvl: 2, x0: 27, y0: 15, x1: 40, y1: 32 },
  { lvl: 3, x0: 15, y0: 3,  x1: 40, y1: 14 },
  { lvl: 4, x0: 41, y0: 3,  x1: 56, y1: 32 },
];
const PARTITIONS = [                          // hoarding walls, knocked down at lvl
  { lvl: 2, x0: 27, y0: 15, x1: 27, y1: 32 },
  { lvl: 3, x0: 15, y0: 14, x1: 40, y1: 14 },
  { lvl: 4, x0: 41, y0: 3,  x1: 41, y1: 32 },
];
const row = (kind, y, xs, lvl) => xs.map(x => ({ kind, x, y, lvl }));
const FIXTURE_LAYOUT = [
  // zone 1: corner shop
  ...row('fridge', 15, [16, 18], 1), ...row('produce', 15, [22, 24], 1),
  ...row('shelf', 18, [16, 18, 22, 24], 1), ...row('shelf', 21, [16, 18, 22, 24], 1),
  // zone 2: mini market
  ...row('fridge', 15, [29, 31, 33], 2), ...row('produce', 15, [36, 38], 2),
  ...row('shelf', 18, [29, 31, 33, 36, 38], 2), ...row('shelf', 21, [29, 31, 33, 36, 38], 2),
  // zone 3: back hall with the chilled wall and the frozen aisle
  ...row('fridge', 3, [16, 18, 20, 22], 3), ...row('freezer', 3, [25, 27, 29, 31], 3), ...row('fridge', 3, [34, 36, 38], 3),
  ...row('shelf', 7, [16, 18, 20, 23, 25, 27, 30, 32, 34, 37], 3), ...row('shelf', 10, [16, 18, 20, 23, 25, 27, 30, 32, 34, 37], 3),
  // zone 4: east wing
  ...row('fridge', 3, [43, 45, 47, 49, 51, 53, 55], 4),
  ...row('shelf', 7, [43, 45, 48, 50, 53, 55], 4), ...row('shelf', 11, [43, 45, 48, 50, 53, 55], 4), ...row('shelf', 15, [43, 45, 48, 50, 53, 55], 4),
  ...row('produce', 19, [43, 45, 48, 50], 4),
];
const TILLS = [{ x: 16, lvl: 1 }, { x: 19, lvl: 1 }, { x: 29, lvl: 2 }, { x: 33, lvl: 2 }, { x: 49, lvl: 4 }, { x: 53, lvl: 4 }];
const TILL_Y = 26;
const DOOR_X0 = 22, DOOR_X1 = 25;            // entrance tiles on the front wall (y = 33)
const DOOR_IN = { x: 24, y: 32.2 };          // just inside the doors
const DOOR_OUT = { x: 24, y: 34.6 };         // just outside
const PAD = { x0: 4, y0: 4, x1: 9, y1: 9 };  // delivery pad
const TERMINAL = { x: 13, y: 13 };
const SPAWN_POINT = { x: 8.5, y: 16.5 };
const CASHIER_REST = { x: 18.5, y: 30.5 };   // where idle cashiers wait
const TROLLEYS = [[15, 31], [16, 31]];       // trolley bay just inside the entrance
const CAR_A = [4, 7, 10, 16, 28, 34, 47, 50, 53];     // parked cars, row A (y 37-38)
const CAR_B = [5, 11, 17, 26, 32, 45, 51, 55];        // row B (y 41-42)
const TREES = [[3, 35], [14, 35], [31, 35], [37, 35], [47, 35], [56, 35]];

// Free-standing props (tile units). The 3D scene draws them from this list and players collide
// with them (r = collision radius), so what you see is exactly what you bump into.
const PROPS = [
  { k: 'palm',   x: DOOR_X0 - 0.35, y: 32.4, s: 1.15, seed: 1, r: 0.2 },
  { k: 'palm',   x: DOOR_X1 + 1.35, y: 32.4, s: 1.15, seed: 2, r: 0.2 },
  { k: 'ficus',  x: 26.6, y: 29.2, s: 1.0, seed: 3, r: 0.16 },
  // the nook between the dairy fridges and the produce stands: off every walkway
  { k: 'snake',  x: 20.55, y: 15.35, s: 1.0, seed: 4, r: 0.16 },
  { k: 'snake',  x: 21.45, y: 15.35, s: 0.85, seed: 5, r: 0.14 },
  { k: 'palm',   x: 40.4, y: 31.3, s: 1.0, seed: 6, r: 0.18 },
  { k: 'ficus',  x: 40.4, y: 4.6, s: 1.1, seed: 7, r: 0.17 },
  { k: 'ficus',  x: 56.4, y: 31.3, s: 1.1, seed: 8, r: 0.17 },
  { k: 'palm',   x: 41.7, y: 31.4, s: 1.0, seed: 9, r: 0.18 },
  { k: 'snake',  x: 56.5, y: 22.6, s: 1.0, seed: 10, r: 0.16 },
  { k: 'palm',   x: DOOR_X0 - 0.9, y: 34.6, s: 1.3, seed: 11, r: 0.22 },
  { k: 'palm',   x: DOOR_X1 + 1.9, y: 34.6, s: 1.3, seed: 12, r: 0.22 },
  { k: 'bin',    x: DOOR_X1 + 2.6, y: 34.4, r: 0.14 },
  { k: 'bench',  x: DOOR_X0 - 2.3, y: 34.5, r: 0.2, wide: 0.28 },
  { k: 'basket', x: DOOR_X1 + 1.75, y: 31.95, n: 8, ry: 0.1, r: 0.15 },
  { k: 'basket', x: DOOR_X1 + 2.1, y: 31.95, n: 6, ry: -0.15, r: 0.15 },
  { k: 'basket', x: DOOR_X0 - 0.8, y: 31.95, n: 7, ry: 0.05, r: 0.15 },
];
// one or two circles per prop (a bench is long, so it gets two)
const PROP_COLLIDERS = PROPS.flatMap(p => p.wide ? [{ x: p.x - p.wide, y: p.y, r: p.r }, { x: p.x + p.wide, y: p.y, r: p.r }] : [{ x: p.x, y: p.y, r: p.r }]);

const zoneAt = (x, y) => { for (const z of ZONES) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z.lvl; return 0; };
const STREET_EDGE = [{ x: 1.5, y: 39.5 }, { x: 58.5, y: 39.5 }, { x: 1.5, y: 43.5 }, { x: 58.5, y: 43.5 }];

function buildMap() {
  const g = [];
  for (let y = 0; y < MAP_H; y++) g.push(new Array(MAP_W).fill('X'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y][x] = c; };

  // outside walkable ground (sidewalk + car park)
  for (let y = 34; y <= 44; y++) for (let x = 1; x <= 58; x++) set(x, y, 'o');

  // building shell
  for (let y = 2; y <= 33; y++) for (let x = 2; x <= 57; x++) set(x, y, '.');
  for (let x = 2; x <= 57; x++) { set(x, 2, '#'); set(x, 33, '#'); }
  for (let y = 2; y <= 33; y++) { set(2, y, '#'); set(57, y, '#'); }
  // glass shopfront
  for (let x = 15; x <= 56; x++) if (x < DOOR_X0 || x > DOOR_X1) set(x, 33, 'G');
  for (let x = DOOR_X0; x <= DOOR_X1; x++) set(x, 33, 'E');

  // storage divider with a 3-tile doorway
  for (let y = 3; y <= 32; y++) set(14, y, '#');
  for (let y = 15; y <= 17; y++) set(14, y, '.');
  // pallet racking along the storage west wall
  for (let y = 12; y <= 30; y++) set(3, y, 'R');
  for (let x = 6; x <= 11; x++) { set(x, 24, 'R'); set(x, 29, 'R'); }
  for (let y = PAD.y0; y <= PAD.y1; y++) for (let x = PAD.x0; x <= PAD.x1; x++) set(x, y, 'D');
  set(TERMINAL.x, TERMINAL.y, 'P');

  // hoarding walls between the zones (knocked through as the store levels up)
  for (const p of PARTITIONS) for (let y = p.y0; y <= p.y1; y++) for (let x = p.x0; x <= p.x1; x++) set(x, y, 'L');

  // fixtures
  const CH = { shelf: 'S', fridge: 'F', freezer: 'Z', produce: 'V' };
  for (const f of FIXTURE_LAYOUT) { set(f.x, f.y, CH[f.kind]); set(f.x + 1, f.y, CH[f.kind]); }
  for (const t of TILLS) { set(t.x, TILL_Y, 'C'); set(t.x + 1, TILL_Y, 'C'); }
  for (const [x, y] of TROLLEYS) set(x, y, 'U');
  set(BIN.x, BIN.y, 'W');

  // car park dressing
  for (const x of CAR_A) { set(x, 37, 'K'); set(x, 38, 'K'); }
  for (const x of CAR_B) { set(x, 41, 'K'); set(x, 42, 'K'); }
  for (const [x, y] of TREES) set(x, y, 'T');
  set(44, 35, 'U'); set(45, 35, 'U');            // outdoor trolley corral
  return g;
}

// ---------------------------------------------------------------- helpers

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sumItems = (items, f) => items.reduce((a, it) => a + f(it), 0);

const NAMES = ['Ravi', 'Asha', 'Dev', 'Meera', 'Kabir', 'Tara', 'Omar', 'Lina', 'Jay', 'Nina',
  'Sam', 'Priya', 'Arjun', 'Zoya', 'Ken', 'Mira', 'Vik', 'Rhea', 'Noor', 'Ali'];

const cleanText = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

// ---------------------------------------------------------------- game

class Game {
  constructor(opts = {}) {
    this.savePath = opts.savePath || null;
    this.map = buildMap();
    this.mapVer = 1;
    this.rebuildWalk();

    this.fixtures = FIXTURE_LAYOUT.map((d, id) => ({
      id, kind: d.kind, tx: d.x, ty: d.y, cx: d.x + 1, cy: d.y + 0.5,
      face: { x: d.x + 1, y: d.y + 1.6 }, lvl: d.lvl, pid: null, qty: 0,
    }));

    this.checkouts = TILLS.map((t, i) => ({
      id: i, tx: t.x, ty: TILL_Y, cx: t.x + 1, cy: TILL_Y + 0.5,
      clerk: { x: t.x + 1, y: TILL_Y + 1.6 }, lvl: t.lvl,
      queue: [], active: null, scanned: 0, scanCd: 0, manned: null, npc: null, stage: null, pay: null,
    }));

    this.players = new Map();
    this.customers = [];
    this.staff = [];
    this.boxes = [];
    this.pending = [];
    this.spills = [];
    this.events = [];

    this.prices = PRODUCTS.map(p => p.base);
    this.cash = START_CASH;
    this.rep = 50;
    this.day = 1;
    this.weather = 'normal';
    this.phase = 'prep';
    this.timer = 0;
    this.spawnCd = 0;
    this.nextId = 1;
    this.upgrades = {};
    this.lvl = 1;                // store level (see STORE_LEVELS)
    this.licenses = { essentials: 1 };
    this.servedTotal = START_SERVED;   // lifetime shoppers served, gates store levels
    this.billNo = 1;             // running receipt number
    this.career = Object.create(null);   // lifetime stats by player name (no prototype: names are user input)
    this.promos = [];            // product ids on promotion
    this.loyal = 0;              // loyalty-card members
    this.goals = [];
    this.ledger = this.freshLedger();
    this.summary = null;
    this.spillCd = 20;

    if (this.savePath && !opts.fresh) this.load();
    this.openPartitions();
    this.syncStaff();
    this.goals = this.rollGoals();
  }

  freshLedger() {
    return { revenue: 0, goods: 0, upgrades: 0, served: 0, lost: 0, stolen: 0, missed: 0, recovered: 0, slips: 0,
      waste: 0, stocked: 0, walkouts: 0, escaped: 0, spills: 0, newMembers: 0, promoSold: 0,
      cashTaken: 0, cardTaken: 0, upiTaken: 0, overpaid: 0, shortChange: 0, declined: 0, exactChange: 0 };
  }

  rebuildWalk() {
    this.walk = this.map.map(r => r.map(c => !SOLID.has(c)));
    // tiles a shopper can actually reach from the entrance (spills only land there)
    const W = MAP_W, H = MAP_H, seen = new Uint8Array(W * H);
    const q = [Math.floor(DOOR_IN.y) * W + Math.floor(DOOR_IN.x)];
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const cx = q[h] % W, cy = (q[h] / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ni] || !this.walk[ny][nx]) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    this.reach = seen;
  }

  has(up) { return !!this.upgrades[up]; }
  level(up) { return this.upgrades[up] | 0; }
  fixtureActive(f) { return f.lvl <= this.lvl; }
  tillActive(c) { return c.lvl <= this.lvl; }
  capOf(f) { return Math.round(BASE_CAP[f.kind] * (this.has('deep') ? 1.5 : 1)); }
  deliveryDelay() { return DELIVERY_DELAY * (this.has('express') ? 0.4 : 1); }
  licensed(pid) { return !!this.licenses[LICENSE_OF[pid]]; }
  productAvailable(pid) { return this.licensed(pid); }
  licensedProducts() { return PRODUCTS.filter(p => this.licensed(p.id)).map(p => p.id); }
  levelInfo() { return STORE_LEVELS[this.lvl]; }

  // knock down every hoarding wall the current level has paid for
  openPartitions() {
    let changed = false;
    for (const p of PARTITIONS) {
      if (p.lvl > this.lvl) continue;
      for (let y = p.y0; y <= p.y1; y++) for (let x = p.x0; x <= p.x1; x++) if (this.map[y][x] === 'L') { this.map[y][x] = '.'; changed = true; }
    }
    if (!changed) return;
    this.rebuildWalk();
    this.mapVer++;
    for (const c of this.customers) c.path = null;
    for (const s of this.staff) s.path = null;
  }

  // what's still missing before the next level can be bought (empty list = ready)
  levelBlockers() {
    const next = STORE_LEVELS[this.lvl + 1];
    if (!next) return ['Top level reached'];
    const out = [];
    if (this.servedTotal < next.served) out.push(`Serve ${next.served - this.servedTotal} more shoppers`);
    if (this.rep < next.rep) out.push(`Reach reputation ${next.rep}`);
    if (this.cash < next.cost) out.push(`Need ₹${(next.cost - Math.round(this.cash)).toLocaleString('en-IN')} more`);
    return out;
  }

  // -------------------------------------------------------------- save / load

  save() {
    if (!this.savePath) return;
    const data = {
      v: 4, day: this.day, promos: this.promos, loyal: this.loyal, cash: this.cash, rep: this.rep, prices: this.prices,
      upgrades: this.upgrades, weather: this.weather, career: this.career,
      lvl: this.lvl, licenses: this.licenses, servedTotal: this.servedTotal, billNo: this.billNo,
      fixtures: this.fixtures.map(f => [f.pid, f.qty, f.life]),
      boxes: [...this.boxes, ...[...this.players.values()].map(p => p.box), ...this.staff.map(st => st.box)]
        .filter(Boolean).map(b => ({ pid: b.pid, units: b.units, x: b.x, y: b.y, life: b.life })),
      pending: this.pending.map(d => ({ pid: d.pid, at: Math.max(0, d.at) })),
    };
    try {
      fs.writeFileSync(this.savePath + '.tmp', JSON.stringify(data));
      fs.renameSync(this.savePath + '.tmp', this.savePath);
    } catch (e) { console.error('  save failed:', e.message); }
  }

  load() {
    let d;
    try { d = JSON.parse(fs.readFileSync(this.savePath, 'utf8')); } catch { return; }
    if (!d || ![2, 3, 4].includes(d.v)) return;
    if (Array.isArray(d.promos)) this.promos = d.promos.filter(pid => PRODUCTS[pid]).slice(0, MAX_PROMOS);
    this.loyal = Math.max(0, d.loyal | 0);
    this.day = d.day | 0 || 1;
    this.cash = Number(d.cash) || 0;
    const rep = Number(d.rep);
    this.rep = clamp(Number.isFinite(rep) ? rep : 50, 0, 100);
    if (Array.isArray(d.prices)) d.prices.forEach((v, i) => { if (PRODUCTS[i]) this.prices[i] = clamp(v | 0, 1, 9999); });
    const ups = d.upgrades && typeof d.upgrades === 'object' ? d.upgrades : {};
    this.upgrades = {};
    for (const k of Object.keys(UPGRADES)) if (ups[k]) this.upgrades[k] = clamp(ups[k] | 0, 0, UPGRADES[k].max || 1);
    this.weather = WEATHER[d.weather] ? d.weather : 'normal';
    this.career = Object.create(null);
    if (d.career && typeof d.career === 'object') for (const k of Object.keys(d.career)) if (d.career[k] && typeof d.career[k] === 'object') this.career[k] = d.career[k];
    this.servedTotal = Math.max(0, d.servedTotal | 0);
    this.billNo = Math.max(1, d.billNo | 0);

    const toBoxes = [];
    if (d.v >= 4) {
      this.lvl = clamp(d.lvl | 0, 1, MAX_LEVEL);
      this.licenses = { essentials: 1 };
      if (d.licenses && typeof d.licenses === 'object') for (const k of Object.keys(LICENSES)) if (d.licenses[k]) this.licenses[k] = 1;
      if (Array.isArray(d.fixtures)) d.fixtures.forEach((v, i) => {
        const f = this.fixtures[i];
        if (!f || !Array.isArray(v)) return;
        const pid = v[0];
        if (pid !== null && PRODUCTS[pid] && KIND_FIXTURE[PRODUCTS[pid].kind] === f.kind) {
          f.pid = pid; f.qty = clamp(v[1] | 0, 0, this.capOf(f));
          f.life = typeof v[2] === 'number' ? v[2] : (PRODUCTS[pid].life || null);
        }
      });
    } else {
      // a save from before store levels: work out the level from the old upgrades, grant every
      // product line up to it, and box up the old shelf stock (the floor plan has changed)
      this.lvl = ups.wing ? 4 : (ups.freezer || ups.till4) ? 3 : ups.till3 ? 2 : 1;
      this.licenses = {};
      for (const [k, l] of Object.entries(LICENSES)) if (l.lvl <= this.lvl) this.licenses[k] = 1;
      this.servedTotal = Math.max(this.servedTotal, STORE_LEVELS[this.lvl].served);
      if (Array.isArray(d.fixtures)) for (const v of d.fixtures) {
        if (!Array.isArray(v) || v[0] === null || !PRODUCTS[v[0]] || !(v[1] > 0)) continue;
        toBoxes.push({ pid: v[0], units: v[1] | 0, life: typeof v[2] === 'number' ? v[2] : (PRODUCTS[v[0]].life || null) });
      }
    }
    this.openPartitions();
    if (Array.isArray(d.pending)) for (const q of d.pending.slice(0, 60)) if (PRODUCTS[q.pid]) this.pending.push({ pid: q.pid, at: Math.max(0, Number(q.at) || 0) });
    if (Array.isArray(d.boxes)) for (const b of d.boxes.slice(0, MAX_BOXES)) {
      if (!PRODUCTS[b.pid]) continue;
      const spot = d.v >= 4 && this.walkableNear(b.x, b.y) ? { x: b.x, y: b.y } : this.freeDeliverySpot();
      this.boxes.push({ id: this.nextId++, pid: b.pid, units: Math.max(1, b.units | 0), x: spot.x, y: spot.y, held: null,
        life: typeof b.life === 'number' ? b.life : (PRODUCTS[b.pid].life || null) });
    }
    for (const b of toBoxes.slice(0, 120)) {
      const spot = this.freeDeliverySpot();
      this.boxes.push({ id: this.nextId++, pid: b.pid, units: Math.max(1, b.units), x: spot.x, y: spot.y, held: null, life: b.life });
    }
    console.log(`  Loaded save: day ${this.day}, ${STORE_LEVELS[this.lvl].name} (level ${this.lvl}), cash ${Math.round(this.cash)}.`);
  }

  walkableNear(x, y) {
    return typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y) && this.tileWalkable(Math.floor(x), Math.floor(y));
  }

  // -------------------------------------------------------------- players

  addPlayer(id, name) {
    if (this.players.size >= MAX_PLAYERS) return null;
    const used = new Set([...this.players.values()].map(p => p.color));
    const color = PLAYER_COLORS.find(c => !used.has(c)) || pick(PLAYER_COLORS);
    name = cleanText(name, 12) || 'Clerk';
    const n = this.players.size;
    const p = {
      id, name, color,
      x: SPAWN_POINT.x + (n % 3) * 0.9, y: SPAWN_POINT.y + Math.floor(n / 3) * 0.9 - 0.9,
      input: { mx: 0, mz: 0, sp: false }, yaw: 90,
      box: null, moving: false, sprint: false, atCheckout: null,
      say: '', sayT: 0, chatCd: 0,
      stats: { stocked: 0, scanned: 0, served: 0, caught: 0, cleaned: 0 },
    };
    this.players.set(id, p);
    this.toast(`${p.name} clocked in`);
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.box) { p.box.x = p.x; p.box.y = p.y; p.box.held = null; this.boxes.push(p.box); p.box = null; }
    for (const c of this.checkouts) if (c.manned === id) c.manned = null;
    this.bankStats(p);
    this.players.delete(id);
    this.toast(`${p.name} clocked out`);
  }

  bankStats(p) {
    const c = this.career[p.name] || (this.career[p.name] = { stocked: 0, scanned: 0, served: 0, caught: 0, cleaned: 0, days: 0 });
    for (const k of Object.keys(p.stats)) { c[k] = (c[k] || 0) + p.stats[k]; p.stats[k] = 0; }
  }

  toast(msg, kind = 'info', extra) {
    this.events.push(Object.assign({ msg, kind }, extra || {}));
    if (this.events.length > 30) this.events.shift();
  }

  // -------------------------------------------------------------- commands

  setInput(id, inp) {
    const p = this.players.get(id);
    if (!p) return;
    let mx = Number(inp.mx) || 0, mz = Number(inp.mz) || 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    p.input = { mx, mz, sp: !!inp.sp };
    if (typeof inp.yaw === 'number' && isFinite(inp.yaw)) p.yaw = inp.yaw;
  }

  order(id, pid, boxes) {
    const p = this.players.get(id);
    const prod = PRODUCTS[pid];
    if (!p || !prod) return;
    if (!this.productAvailable(pid)) { this.toast(`${prod.name} needs the ${LICENSES[LICENSE_OF[pid]].name} licence (U)`, 'bad'); return; }
    boxes = clamp(Math.floor(boxes) || 1, 1, 20);
    if (this.pending.length + boxes > 60) { this.toast('The supplier can only handle 60 boxes at once', 'bad'); return; }
    if (this.boxes.length + this.pending.length + boxes > MAX_BOXES) { this.toast('The storage room is full - unpack some boxes first', 'bad'); return; }
    const cost = prod.cost * prod.per * boxes;
    if (cost > this.cash) { this.toast('Not enough cash for that order', 'bad'); return; }
    this.cash -= cost;
    this.ledger.goods += cost;
    const delay = this.deliveryDelay();
    for (let i = 0; i < boxes; i++) this.pending.push({ pid, at: delay + i * 0.3 });
    this.toast(`${p.name} ordered ${boxes} box${boxes > 1 ? 'es' : ''} of ${prod.name} (−₹${cost})`, 'spend');
  }

  setPrice(id, pid, price) {
    if (!this.players.has(id) || !PRODUCTS[pid] || !Number.isFinite(Number(price))) return;
    this.prices[pid] = clamp(Math.round(Number(price)), 1, 9999);
  }

  setPromo(id, pid, on) {
    if (!this.players.has(id) || !PRODUCTS[pid]) return;
    const i = this.promos.indexOf(pid);
    if (on && i < 0) {
      if (this.promos.length >= MAX_PROMOS) { this.toast(`Only ${MAX_PROMOS} promotions at a time`, 'bad'); return; }
      this.promos.push(pid);
      this.toast(`${PRODUCTS[pid].name} is now on promotion`, 'good');
    } else if (!on && i >= 0) this.promos.splice(i, 1);
  }

  // a promotion only pulls shoppers in if the price is at or below what they expect
  promoActive(pid) { return this.promos.includes(pid) && this.prices[pid] <= PRODUCTS[pid].base; }

  buyUpgrade(id, key) {
    const p = this.players.get(id);
    if (!p || typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(UPGRADES, key)) return;
    const u = UPGRADES[key];
    const lvl = this.level(key);
    const max = u.max || 1;
    if (lvl >= max) { this.toast(`${u.name} is already maxed out`, 'bad'); return; }
    if ((u.lvl || 1) > this.lvl) { this.toast(`${u.name} needs a ${STORE_LEVELS[u.lvl].name} (store level ${u.lvl})`, 'bad'); return; }
    const cost = Array.isArray(u.cost) ? u.cost[lvl] : u.cost;
    if (cost > this.cash) { this.toast(`Not enough cash for ${u.name}`, 'bad'); return; }
    this.cash -= cost;
    this.ledger.upgrades += cost;
    this.upgrades[key] = lvl + 1;
    if (key === 'cashier' || key === 'stocker') this.syncStaff();
    this.toast(`${p.name} bought ${u.name}${max > 1 ? ` (${lvl + 1}/${max})` : ''}`, 'good', { sfx: 'upgrade' });
    this.save();
  }

  // expand to the next store level: pay, knock down the next hoarding wall
  buyLevel(id) {
    const p = this.players.get(id);
    if (!p) return;
    const next = STORE_LEVELS[this.lvl + 1];
    if (!next) { this.toast('The store is already at the top level', 'bad'); return; }
    const block = this.levelBlockers();
    if (block.length) { this.toast(`Can't expand yet: ${block.join(' · ')}`, 'bad'); return; }
    this.cash -= next.cost;
    this.ledger.upgrades += next.cost;
    this.lvl++;
    this.openPartitions();
    this.toast(`${p.name} expanded the shop: welcome to your ${next.name}!`, 'good', { sfx: 'levelup', lvl: this.lvl });
    this.save();
  }

  buyLicense(id, key) {
    const p = this.players.get(id);
    if (!p || typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(LICENSES, key)) return;
    const l = LICENSES[key];
    if (this.licenses[key]) { this.toast(`You already sell ${l.name}`, 'bad'); return; }
    if (l.lvl > this.lvl) { this.toast(`${l.name} needs a ${STORE_LEVELS[l.lvl].name} (store level ${l.lvl})`, 'bad'); return; }
    if (l.cost > this.cash) { this.toast(`Not enough cash for the ${l.name} licence`, 'bad'); return; }
    this.cash -= l.cost;
    this.ledger.upgrades += l.cost;
    this.licenses[key] = 1;
    this.toast(`${p.name} unlocked ${l.name}: ${l.pids.map(i => PRODUCTS[i].name).join(', ')}`, 'good', { sfx: 'upgrade' });
    this.save();
  }

  setReady(id) {
    if (!this.players.has(id)) return;
    const p = this.players.get(id);
    if (this.phase === 'summary') {
      this.phase = 'prep'; this.summary = null; this.ledger = this.freshLedger(); this.goals = this.rollGoals();
      this.toast(`Day ${this.day} prep: ${WEATHER[this.weather].label}`, 'info'); return;
    }
    if (this.phase === 'prep') { this.openStore(p.name); }
  }

  chat(id, text) {
    const p = this.players.get(id);
    if (!p || p.chatCd > 0) return;
    text = cleanText(text, 140);
    if (!text) return;
    p.chatCd = 0.6;
    p.say = text.slice(0, 60); p.sayT = 5;
    this.toast(text, 'chat', { from: p.name, color: p.color });
  }

  // -------------------------------------------------------------- interact

  probe(p) {
    const fx = Math.sin(p.yaw * Math.PI / 180), fz = Math.cos(p.yaw * Math.PI / 180);
    let best = null, bestD = REACH;
    const d2 = (x, y, reach = REACH) => {
      const dx = x - p.x, dy = y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach) return Infinity;
      if (d < 0.75) return d;
      const dot = (dx / d) * fx + (dy / d) * fz;
      if (dot < 0.34) return Infinity;
      return d - 0.3 * dot;
    };

    if (p.box) {
      const prod = PRODUCTS[p.box.pid];
      const need = KIND_FIXTURE[prod.kind];
      for (const f of this.fixtures) {
        const d = d2(f.cx, f.cy);
        if (d >= bestD) continue;
        bestD = d;
        if (!this.fixtureActive(f)) best = { kind: 'blocked', label: `Locked - expand to a ${STORE_LEVELS[f.lvl].name} first` };
        else if (f.kind !== need) best = { kind: 'blocked', label: `${prod.name} goes in a ${FIXTURE_NAME[need]}` };
        else if (p.box.life !== null && p.box.life !== undefined && p.box.life <= 0) best = { kind: 'blocked', label: 'This box has expired - throw it in the waste bin' };
        else if (f.qty > 0 && f.life !== null && f.life !== undefined && f.life <= 0) best = { kind: 'blocked', label: `Expired ${PRODUCTS[f.pid].name} here - clear it with R first` };
        else if (f.qty === 0 || f.pid === null || f.pid === p.box.pid) {
          if (f.pid === p.box.pid && f.qty >= this.capOf(f)) best = { kind: 'blocked', label: 'This one is full' };
          else best = { kind: 'stock', fix: f, label: `Stock ${prod.name} (${f.pid === p.box.pid ? f.qty : 0}/${this.capOf(f)})` };
        } else best = { kind: 'blocked', label: `Holds ${PRODUCTS[f.pid].name} - empty it with R first` };
      }
      const bd = d2(BIN.x + 0.5, BIN.y + 0.5);
      if (bd < bestD + 0.3) { best = { kind: 'bin', label: `Throw away ${PRODUCTS[p.box.pid].name} (−₹${p.box.units * PRODUCTS[p.box.pid].cost} waste)` }; bestD = bd - 0.3; }
    } else {
      for (const b of this.boxes) {
        const d = d2(b.x, b.y);
        const exp = b.life !== null && b.life !== undefined && b.life <= 0 ? ' - EXPIRED' : '';
        if (d < bestD) { best = { kind: 'take', box: b, label: `Pick up ${PRODUCTS[b.pid].name} box (${b.units})${exp}` }; bestD = d; }
      }
      for (const s of this.spills) {
        const d = d2(s.x, s.y);
        if (d < bestD) { best = { kind: 'clean', spill: s, label: `Mop up the spill (${s.hp} left)` }; bestD = d; }
      }
      for (const c of this.customers) {
        if (c.state !== 'flee') continue;
        const d = d2(c.x, c.y, REACH + 0.4);
        if (d < bestD + 0.6) { best = { kind: 'catch', cust: c, label: 'Stop the shoplifter!' }; bestD = d - 0.6; }
      }
    }

    const td = d2(TERMINAL.x + 0.5, TERMINAL.y + 0.5);
    if (td < bestD) { best = { kind: 'terminal', label: 'Use the order terminal', open: 'order' }; bestD = td; }

    if (!best && !p.box) {
      let info = null, infoD = REACH;
      for (const f of this.fixtures) {
        const d = d2(f.cx, f.cy);
        if (d >= infoD) continue;
        infoD = d;
        if (!this.fixtureActive(f)) info = { kind: 'info', label: `Locked - opens with the ${STORE_LEVELS[f.lvl].name} (U)` };
        else if (f.pid === null || f.qty === 0) info = { kind: 'info', label: `Empty ${FIXTURE_NAME[f.kind]} - bring a box` };
        else if (f.life !== null && f.life !== undefined && f.life <= 0) info = { kind: 'pullable', fix: f, bad: true, label: `${PRODUCTS[f.pid].name} has EXPIRED - shoppers won't buy it`, alt: 'R', altLabel: 'Clear it out' };
        else {
          const days = f.life !== null && f.life !== undefined ? ` · ${f.life} day${f.life === 1 ? '' : 's'} left` : '';
          const promo = this.promos.includes(f.pid) ? ' · PROMO' : '';
          info = { kind: 'pullable', fix: f, label: `${PRODUCTS[f.pid].name}: ${f.qty}/${this.capOf(f)} at ₹${this.prices[f.pid]}${days}${promo}`, alt: 'R', altLabel: 'Empty' };
        }
      }
      if (info) best = info;
    }
    return best;
  }

  act(id) {
    const p = this.players.get(id);
    if (!p) return;
    const t = this.probe(p);
    if (!t) return;
    if (t.kind === 'take') {
      const i = this.boxes.indexOf(t.box);
      if (i >= 0) { this.boxes.splice(i, 1); t.box.held = id; t.box.res = null; p.box = t.box; }
    } else if (t.kind === 'stock') {
      const moved = this.stockInto(t.fix, p.box);
      p.stats.stocked += moved;
      this.ledger.stocked += moved;
      if (p.box.units <= 0) p.box = null;
    } else if (t.kind === 'clean') {
      const s = t.spill;
      s.hp--;
      if (s.hp <= 0) {
        this.spills.splice(this.spills.indexOf(s), 1);
        p.stats.cleaned++;
        this.toast(`${p.name} cleaned up a spill`, 'good');
      }
    } else if (t.kind === 'catch') {
      this.catchThief(t.cust, p);
    } else if (t.kind === 'bin') {
      const b = p.box;
      const worth = b.units * PRODUCTS[b.pid].cost;
      this.ledger.waste += worth;
      p.box = null;
      this.toast(`${p.name} binned ${b.units} × ${PRODUCTS[b.pid].name} (₹${worth} waste)`, 'spend');
    }
  }

  stockInto(f, box) {
    const bl = box.life === undefined ? null : box.life;
    if (f.pid === null || f.qty === 0) { f.pid = box.pid; f.life = bl; }
    else if (bl !== null) f.life = f.life === null || f.life === undefined ? bl : Math.min(f.life, bl);
    if (f.qty + Math.min(this.capOf(f) - f.qty, box.units) >= this.capOf(f) * 0.5) f.lowAlert = false;
    const move = Math.min(this.capOf(f) - f.qty, box.units);
    f.qty += move; box.units -= move;
    if (move > 0) { f.outAlert = false; f.expiredWarned = false; }
    return move;
  }

  // R: take everything off a fixture back into a box so it can be reassigned
  pull(id) {
    const p = this.players.get(id);
    if (!p || p.box) return;
    const t = this.probe(p);
    if (!t || t.kind !== 'pullable') return;
    const f = t.fix;
    if (f.life !== null && f.life !== undefined && f.life <= 0) {
      const worth = f.qty * PRODUCTS[f.pid].cost;
      this.ledger.waste += worth;
      this.toast(`${p.name} cleared ${f.qty} expired ${PRODUCTS[f.pid].name} (₹${worth} waste)`, 'spend');
    } else {
      p.box = { id: this.nextId++, pid: f.pid, units: f.qty, x: p.x, y: p.y, held: id, life: f.life === undefined ? null : f.life };
    }
    f.qty = 0; f.pid = null; f.life = null;
  }

  catchThief(c, p) {
    c.state = 'caught'; c.t = 1.4; c.path = null;
    let units = 0;
    for (const it of c.items) {
      units += it.qty;
      const spot = this.dropSpotNear(c.x, c.y);
      this.boxes.push({ id: this.nextId++, pid: it.pid, units: it.qty, x: spot.x, y: spot.y, held: null, life: PRODUCTS[it.pid].life || null });
    }
    c.items = [];
    this.ledger.recovered += units;
    this.rep = clamp(this.rep + 0.8, 0, 100);
    p.stats.caught++;
    this.toast(`${p.name} caught a shoplifter - ${units} item${units === 1 ? '' : 's'} recovered`, 'good', { sfx: 'caught' });
  }

  dropSpotNear(x, y) {
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 8; k++) {
        const nx = x + rnd(-0.6, 0.6) * (r + 1), ny = y + rnd(-0.6, 0.6) * (r + 1);
        if (this.freeAt(nx, ny, 0.2)) return { x: nx, y: ny };
      }
    }
    return { x, y };
  }

  drop(id) {
    const p = this.players.get(id);
    if (!p || !p.box) return;
    const fx = Math.sin(p.yaw * Math.PI / 180), fz = Math.cos(p.yaw * Math.PI / 180);
    let x = p.x + fx * 0.55, y = p.y + fz * 0.55;
    if (!this.freeAt(x, y, 0.2)) { x = p.x; y = p.y; }
    p.box.x = x; p.box.y = y; p.box.held = null;
    this.boxes.push(p.box); p.box = null;
  }

  scan(id) {
    const p = this.players.get(id);
    if (!p) return;
    const co = this.checkouts.find(c => c.manned === id);
    if (!co) return;
    this.scanStep(co, p);
  }

  // ---- the checkout: scan every item, total the bill, take payment, give change, print a receipt.
  //   co.stage: 'scan' -> 'total' -> 'card' | 'upi' | 'cash' -> sale done
  billTotal(c) { return sumItems(c.items, it => it.qty * (it.price !== undefined ? it.price : this.prices[it.pid])); }
  unitCount(c) { return sumItems(c.items, it => it.qty); }

  // which product is the n-th unit on the belt (0-based)
  unitAt(c, n) {
    for (const it of c.items) { if (n < it.qty) return it.pid; n -= it.qty; }
    return null;
  }

  scanStep(co, p) {
    if (!co.active || co.scanCd > 0) return;
    const c = co.active;
    const total = this.unitCount(c);
    if (co.scanned < total) {
      // the price is fixed the moment the item is scanned
      const pid = this.unitAt(c, co.scanned);
      const it = c.items.find(x => x.pid === pid);
      if (it && it.price === undefined) it.price = this.prices[pid];   // items from older code paths
      co.scanned++;
      co.scanCd = (p ? SCAN_TIME : NPC_SCAN) * (this.has('scanner') ? FAST_SCAN : 1);
      if (co.scanned >= total) { co.stage = 'total'; co.scanCd = p ? 0.15 : 0.8; }
      if (p) p.stats.scanned++;
      this.toast('', 'sfx', { sfx: 'beep', at: co.id });
      return;
    }
    if (co.stage === 'scan' || co.stage === 'total') { this.requestPayment(co); return; }
    if (co.stage === 'cash' && co.pay.due - co.pay.given <= 0) this.finishSale(co, p);
  }

  // the shopper decides how to pay once they hear the total
  choosePayment(total) {
    if (!this.has('cardpos')) return 'cash';
    const cashP = total < 150 ? 0.55 : total < 600 ? 0.4 : 0.25;    // small baskets are paid in cash more often
    const r = Math.random();
    return r < cashP ? 'cash' : r < cashP + (1 - cashP) * 0.55 ? 'upi' : 'card';
  }

  // the notes a shopper hands over for a cash bill: exact money sometimes, otherwise a round amount
  tenderFor(total) {
    if (Math.random() < 0.12) return total;
    const opts = [];
    for (const [step, w] of [[10, 3], [50, 3], [100, 3], [500, 2]]) {
      const v = Math.ceil(total / step) * step;
      if (v > total && !opts.some(o => o.v === v)) opts.push({ v, w });
    }
    if (!opts.length) return total;
    let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
    for (const o of opts) if ((r -= o.w) <= 0) return o.v;
    return opts[0].v;
  }

  requestPayment(co) {
    const c = co.active;
    const total = this.billTotal(c);
    const m = this.choosePayment(total);
    co.pay = { m, total, td: 0, due: 0, given: 0, t: 0, declined: false, short: 0 };
    co.stage = m;
    if (m === 'card') { co.pay.t = rnd(1.8, 2.8); co.pay.declined = Math.random() < 0.07; }
    else if (m === 'upi') co.pay.t = rnd(2.0, 3.2);
    else this.handOverCash(co);
    this.toast('', 'sfx', { sfx: m === 'cash' ? 'drawer' : 'card', at: co.id });
  }

  handOverCash(co) {
    const td = this.tenderFor(co.pay.total);
    co.pay.m = 'cash'; co.stage = 'cash';
    co.pay.td = td; co.pay.due = td - co.pay.total; co.pay.given = 0;
    co.pay.t = 1.4;    // an NPC cashier takes this long to count the change
  }

  // the player hands change from the drawer. amt is the sum of the notes and coins they picked.
  giveChange(id, amt) {
    const p = this.players.get(id);
    if (!p) return;
    const co = this.checkouts.find(k => k.manned === id);
    if (!co || co.stage !== 'cash' || !co.pay) return;
    amt = Math.floor(Number(amt));
    if (!isFinite(amt) || amt < 0 || amt > co.pay.td) return;
    co.pay.given += amt;
    const left = co.pay.due - co.pay.given;
    if (left > 0) {
      // short-changed: the shopper waits for the rest and is not impressed
      co.pay.short = left;
      this.rep = clamp(this.rep - 0.3, 0, 100);
      this.ledger.shortChange++;
      if (co.active) co.active.shorted = true;
      this.toast(`"Excuse me, that's ₹${left} short!"`, 'warn', { to: id, sfx: 'bad', short: left });
      return;
    }
    this.finishSale(co, p);
  }

  finishSale(co, p) {
    const c = co.active, pay = co.pay;
    if (!c || !pay) return;
    const total = pay.total;
    const over = pay.m === 'cash' ? Math.max(0, pay.given - pay.due) : 0;
    this.cash += total - over;
    this.ledger.revenue += total;
    this.ledger.served++;
    this.ledger[pay.m + 'Taken'] += total;
    if (over) { this.ledger.overpaid += over; if (p) this.toast(`Oops - gave ₹${over} too much change`, 'bad', { to: p.id }); }
    else if (pay.m === 'cash' && pay.due > 0 && !c.shorted) this.ledger.exactChange++;
    this.servedTotal++;
    if (p) p.stats.served++;
    const happy = c.patience > 18 && c.missed === 0 && !c.shorted;
    this.rep = clamp(this.rep + (happy ? 0.5 : 0.15), 0, 100);
    if (happy && !c.member && Math.random() < 0.15) { this.loyal++; this.ledger.newMembers++; }

    // the printed receipt goes to whoever worked the till
    const no = this.billNo++;
    const receipt = {
      no, till: co.id + 1, clk: this.clock(), day: this.day, m: pay.m, total, td: pay.td, ch: pay.m === 'cash' ? pay.given : 0,
      lines: c.items.map(it => ({ pid: it.pid, q: it.qty, p: it.price !== undefined ? it.price : this.prices[it.pid] })),
      member: !!c.member, cashier: p ? p.name : (this.staff.find(s => s.till === co.id) || {}).name || 'Staff',
    };
    co.last = { m: pay.m, total, ch: receipt.ch, t: 3 };
    this.toast('', 'receipt', { to: p ? p.id : -1, receipt, at: co.id, sfx: 'till' });

    c.state = 'leave'; c.paid = total; c.t = 0; c.path = null; c.co = null;
    co.queue.shift();
    co.active = null; co.scanned = 0; co.stage = null; co.pay = null;
    this.repositionQueue(co);
  }

  // card and UPI payments approve on their own after a short wait; NPC cashiers count change
  tickPayments(dt) {
    for (const co of this.checkouts) {
      if (co.last && (co.last.t -= dt) <= 0) co.last = null;
      if (!co.active || !co.pay) continue;
      const pay = co.pay;
      const p = co.manned ? this.players.get(co.manned) : null;
      if (co.stage === 'card' || co.stage === 'upi') {
        pay.t -= dt;
        if (pay.t > 0) continue;
        if (co.stage === 'card' && pay.declined) {
          this.ledger.declined++;
          if (p) this.toast('Card declined - the shopper pays cash instead', 'warn', { to: p.id, sfx: 'bad' });
          this.handOverCash(co);
          continue;
        }
        this.finishSale(co, p);
      } else if (co.stage === 'cash' && !p && co.npc !== null && (this.staff.find(st => st.id === co.npc) || {}).atTill) {
        pay.t -= dt;
        if (pay.t <= 0) { pay.given = pay.due; this.finishSale(co, null); }
      }
    }
  }

  // -------------------------------------------------------------- day cycle

  openStore(by) {
    this.phase = 'open';
    this.timer = DAY_LENGTH;
    this.spawnCd = 1.5;
    const stockedInPrep = this.ledger.stocked;
    this.ledger = this.freshLedger();
    this.ledger.stocked = stockedInPrep;
    this.toast(`Day ${this.day}: doors open${by ? ` (${by})` : ''}`, 'good', { sfx: 'open' });
  }

  closeDay() {
    const rent = this.levelInfo().rent + this.day * 25;
    const wages = this.level('cashier') * UPGRADES.cashier.wage + this.level('stocker') * UPGRADES.stocker.wage;
    this.cash -= rent + wages;
    const l = this.ledger;
    const goals = this.goals.map(g => { const [v, done] = this.goalProgress(g); return { t: g.t, done, reward: g.reward, v }; });
    const bonus = goals.reduce((a, g) => a + (g.done ? g.reward : 0), 0);
    this.cash += bonus;
    if (goals.every(g => g.done)) this.rep = clamp(this.rep + 2, 0, 100);

    // a night passes: perishables age by one day
    let expiredFix = 0;
    const age = o => { if (o && o.life !== null && o.life !== undefined) o.life = Math.max(0, o.life - 1); };
    for (const f of this.fixtures) if (f.qty > 0) { age(f); if (f.life === 0) expiredFix++; }
    for (const b of this.boxes) age(b);
    for (const p of this.players.values()) age(p.box);
    for (const st of this.staff) age(st.box);

    let mvp = null, mvpScore = -1;
    const crew = [];
    for (const p of this.players.values()) {
      const s = p.stats;
      const score = s.stocked + s.scanned + s.served * 5 + s.caught * 20 + s.cleaned * 8;
      crew.push({ n: p.name, c: p.color, ...s, score });
      if (score > mvpScore) { mvpScore = score; mvp = p.name; }
    }
    crew.sort((a, b) => b.score - a.score);
    for (const p of this.players.values()) {
      this.bankStats(p);
      this.career[p.name].days = (this.career[p.name].days || 0) + 1;
    }

    this.summary = {
      day: this.day, weather: WEATHER[this.weather].label,
      revenue: l.revenue, goods: l.goods, upgrades: l.upgrades, rent, wages,
      profit: l.revenue + bonus - l.goods - l.upgrades - rent - wages,
      goals, bonus, waste: l.waste, newMembers: l.newMembers, members: this.loyal, expiredFix,
      served: l.served, lost: l.lost, stolen: l.stolen, missed: l.missed, recovered: l.recovered, slips: l.slips,
      cashTaken: l.cashTaken, cardTaken: l.cardTaken, upiTaken: l.upiTaken, overpaid: l.overpaid, shortChange: l.shortChange,
      declined: l.declined, exactChange: l.exactChange, walkouts: l.walkouts, escaped: l.escaped, lvl: this.lvl, lvlName: this.levelInfo().name, servedTotal: this.servedTotal,
      cash: Math.round(this.cash), rep: Math.round(this.rep),
      crew, mvp: mvpScore > 0 ? mvp : null,
    };
    this.day++;
    this.weather = this.rollWeather();
    this.phase = 'summary';
    this.spills = [];
    this.save();
  }

  // three goals per day, scaled to the day number; each pays a cash bonus at closing
  rollGoals() {
    // targets grow with the day, but never past what the current store size can manage
    const d = this.day, L = this.levelInfo();
    const serveN = Math.round(Math.min(6 + d * 3, L.cap * 0.55));
    const revN = Math.round(Math.min(800 + d * 500, L.cap * 95) / 50) * 50;
    const stockN = Math.round(Math.min(60 + d * 20, this.fixtures.filter(f => this.fixtureActive(f)).length * 9) / 5) * 5;
    const pool = [
      { k: 'serve', t: `Serve ${serveN} shoppers`, n: serveN },
      { k: 'revenue', t: `Take ₹${revN.toLocaleString('en-IN')} in sales`, n: revN },
      { k: 'stock', t: `Stock ${stockN} items`, n: stockN },
      { k: 'nothief', t: 'No shoplifter gets away', n: 0 },
      { k: 'nowalk', t: 'No shopper walks out angry', n: 0 },
      { k: 'clean', t: 'Leave no spill at closing', n: 0 },
      { k: 'rep', t: `Close with reputation ${Math.min(95, Math.round(this.rep) + 3)}+`, n: Math.min(95, Math.round(this.rep) + 3) },
      { k: 'promo', t: 'Sell 10 items on promotion', n: 10 },
      { k: 'change', t: 'Give 5 shoppers exact change', n: 5 },
    ];
    const out = [];
    while (out.length < 3) { const g = pick(pool); if (!out.includes(g)) out.push(g); }
    const reward = 250 + d * 100;
    return out.map(g => ({ ...g, reward }));
  }

  goalProgress(g) {
    const l = this.ledger;
    switch (g.k) {
      case 'serve': return [l.served, l.served >= g.n];
      case 'revenue': return [l.revenue, l.revenue >= g.n];
      case 'stock': return [l.stocked, l.stocked >= g.n];
      case 'nothief': return [l.escaped, l.escaped === 0];
      case 'nowalk': return [l.walkouts, l.walkouts === 0];
      case 'clean': return [this.spills.length, this.spills.length === 0];
      case 'rep': return [Math.round(this.rep), this.rep >= g.n];
      case 'promo': return [l.promoSold, l.promoSold >= g.n];
      case 'change': return [l.exactChange, l.exactChange >= g.n];
    }
    return [0, false];
  }

  rollWeather() {
    const r = Math.random();
    return r < 0.5 ? 'normal' : r < 0.7 ? 'rain' : r < 0.85 ? 'festival' : 'heatwave';
  }

  // store clock in minutes past midnight: 08:00 open -> 22:00 close
  clock() {
    if (this.phase === 'prep') return 7 * 60 + 30;
    if (this.phase === 'open') return Math.round((8 + 14 * (1 - this.timer / DAY_LENGTH)) * 60);
    if (this.phase === 'closing') return Math.round((22 + 0.75 * (1 - this.timer / CLOSING_GRACE)) * 60);
    return 23 * 60;
  }

  // -------------------------------------------------------------- pathing

  tileWalkable(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return this.walk[ty][tx];
  }

  findPath(sx, sy, tx, ty) {
    const s = { x: Math.floor(sx), y: Math.floor(sy) };
    const g = { x: Math.floor(tx), y: Math.floor(ty) };
    const N8 = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    if (!this.tileWalkable(g.x, g.y)) {
      const alt = N8.map(([dx, dy]) => ({ x: g.x + dx, y: g.y + dy })).find(n => this.tileWalkable(n.x, n.y));
      if (!alt) return null;
      g.x = alt.x; g.y = alt.y;
    }
    if (!this.tileWalkable(s.x, s.y)) {
      const alt = N8.map(([dx, dy]) => ({ x: s.x + dx, y: s.y + dy })).find(n => this.tileWalkable(n.x, n.y));
      if (!alt) return null;
      s.x = alt.x; s.y = alt.y;
    }
    const W = MAP_W, H = MAP_H;
    const prev = new Int32Array(W * H).fill(-1);
    const seen = new Uint8Array(W * H);
    const q = [s.y * W + s.x];
    seen[s.y * W + s.x] = 1;
    const goal = g.y * W + g.x;
    let head = 0, found = false;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === goal) { found = true; break; }
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy] of N8.slice(0, 4)) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (seen[ni] || !this.walk[ny][nx]) continue;
        seen[ni] = 1; prev[ni] = cur; q.push(ni);
      }
    }
    if (!found) return null;
    const out = [];
    let cur = goal;
    while (cur !== -1) { out.push({ x: (cur % W) + 0.5, y: ((cur / W) | 0) + 0.5 }); cur = prev[cur]; }
    out.reverse();
    out.shift();
    out.push({ x: tx, y: ty });
    return this.smooth(out);
  }

  // drop waypoints that sit on a straight line, so walkers don't zig-zag tile by tile
  smooth(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) > 1e-6) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // walk an entity along its path; returns true while still moving
  stepPath(e, speed, dt) {
    if (!e.path || e.wp >= e.path.length) { e.path = null; return false; }
    const w = e.path[e.wp];
    const dx = w.x - e.x, dy = w.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.08) { e.wp++; if (e.wp >= e.path.length) e.path = null; return !!e.path; }
    const m = Math.min(speed * dt, d);
    e.x += dx / d * m; e.y += dy / d * m;
    e.yaw = Math.atan2(dx, dy) * 180 / Math.PI;
    return true;
  }

  // -------------------------------------------------------------- customers

  stockedProducts() {
    const set = new Set();
    for (const f of this.fixtures) if (f.pid !== null && f.qty > 0 && this.fixtureActive(f)) set.add(f.pid);
    return [...set];
  }

  spawnCustomer() {
    const stocked = this.stockedProducts();
    const roll = Math.random();
    const type = roll < 0.18 ? 'bulk' : roll < 0.38 ? 'rushed' : 'regular';
    const n = type === 'bulk' ? irnd(4, 7) : type === 'rushed' ? irnd(1, 2) : irnd(1, 4);
    const weight = pid => {
      const k = PRODUCTS[pid].kind;
      return (this.weather === 'heatwave' && (k === 'chilled' || k === 'frozen') ? 2.5 : 1) * (this.promoActive(pid) ? 3 : 1);
    };
    const want = [];
    const sellable = this.licensedProducts();
    for (let i = 0; i < n * 2 && want.length < n; i++) {
      let pid;
      if (stocked.length && Math.random() < 0.8) {
        const tot = stocked.reduce((a, s) => a + weight(s), 0);
        let r = Math.random() * tot;
        pid = stocked.find(s => (r -= weight(s)) <= 0);
        if (pid === undefined) pid = stocked[0];
      } else pid = pick(sellable);       // something we sell but may not have on the shelf
      if (!want.includes(pid)) want.push(pid);
    }
    const thiefChance = (0.04 + Math.max(0, 50 - this.rep) * 0.002) * (this.has('cctv') ? 0.5 : 1);
    const member = Math.random() < Math.min(0.5, this.loyal / 120);
    const patience = (type === 'rushed' ? rnd(30, 45) : rnd(45, 80)) * (this.has('ac') ? 1.25 : 1) * (member ? 1.2 : 1);

    // arrive from the street edge or climb out of a parked car
    let start;
    if (Math.random() < 0.5) {
      const useA = Math.random() < 0.5;
      const x = pick(useA ? CAR_A : CAR_B);
      start = { x: x + 1.5, y: useA ? 37.6 : 41.6 };
    } else start = pick(STREET_EDGE);
    if (!this.walkableNear(start.x, start.y)) start = STREET_EDGE[0];

    const c = {
      id: this.nextId++, name: pick(NAMES), type,
      x: start.x, y: start.y, yaw: 180, want, idx: 0, exit: start,
      items: [], missed: 0, state: 'enter', t: 0, path: null, wp: 0,
      patience, tol: rnd(1.02, 1.32), co: null,
      thief: Math.random() < thiefChance,
      look: (Math.random() * 1e6) | 0, slipped: false, member,
    };
    if (member && n < 5) { const extra = stocked.filter(s => !want.includes(s)); if (extra.length) want.push(pick(extra)); }
    this.customers.push(c);
  }

  shelfWith(pid, near) {
    let best = null, bestS = Infinity;
    for (const f of this.fixtures) {
      if (f.pid !== pid || f.qty <= 0 || !this.fixtureActive(f)) continue;
      const s = (near ? Math.hypot(f.face.x - near.x, f.face.y - near.y) : 0) - f.qty * 0.15;
      if (s < bestS) { bestS = s; best = f; }
    }
    return best;
  }

  repositionQueue(co) {
    co.queue.forEach((c, i) => {
      c.qslot = i;
      c.target = { x: co.cx, y: co.cy - 1.8 - i * 0.85 };
      c.path = null;
    });
  }

  tillStaffed(co) { return !!co.manned || co.npc !== null; }

  chooseCheckout() {
    const open = this.checkouts.filter(k => this.tillActive(k) && k.queue.length < 4);
    if (!open.length) return null;
    const score = k => k.queue.length + (this.tillStaffed(k) ? 0 : 3.5) + Math.random() * 0.3;
    open.sort((a, b) => score(a) - score(b));
    return open[0];
  }

  stepCustomer(c, dt) {
    let speed = c.state === 'flee' ? (this.has('cctv') ? CUST_FLEE_CCTV : CUST_FLEE) : CUST_SPEED * (c.type === 'rushed' ? 1.15 : 1);
    if (c.y > 33 && c.state !== 'flee') speed *= 1.5;      // brisk walk across the car park
    this.stepPath(c, speed, dt);

    const arrived = (tx, ty, r = 0.4) => Math.hypot(c.x - tx, c.y - ty) < r;
    const goto = (tx, ty) => {
      if (!c.path && Math.hypot(c.x - tx, c.y - ty) > 0.12) {
        c.path = this.findPath(c.x, c.y, tx, ty); c.wp = 0;
        if (!c.path) { c.x = tx; c.y = ty; }
      }
    };

    // slipping on a spill
    if (!c.slipped && c.state !== 'enter' && c.y < 33) {
      for (const s of this.spills) {
        if (Math.hypot(s.x - c.x, s.y - c.y) < 0.5) {
          c.slipped = true; c.stun = 1.2;
          this.ledger.slips++;
          this.rep = clamp(this.rep - 0.6, 0, 100);
          this.toast('A shopper slipped on a spill!', 'bad', { sfx: 'slip' });
          break;
        }
      }
    }
    if (c.stun > 0) { c.stun -= dt; c.path = null; return; }

    switch (c.state) {
      case 'enter': {
        goto(DOOR_IN.x, DOOR_IN.y);
        if (arrived(DOOR_IN.x, DOOR_IN.y, 0.5)) {
          c.state = 'shop'; c.path = null;
          if (this.phase !== 'open') c.state = 'leave';
        }
        break;
      }
      case 'shop': {
        if (c.idx >= c.want.length) {
          if (c.items.length === 0) { c.state = 'leave'; c.path = null; break; }
          if (c.thief) { c.state = 'flee'; c.path = null; this.toast('Shoplifter heading for the door!', 'bad', { sfx: 'alarm' }); break; }
          c.state = 'tocheck'; c.path = null; break;
        }
        const pid = c.want[c.idx];
        const fix = c.targetShelf && c.targetShelf.pid === pid && c.targetShelf.qty > 0 ? c.targetShelf : this.shelfWith(pid, c);
        if (!fix) { c.missed++; this.ledger.missed++; this.rep = clamp(this.rep - 0.25, 0, 100); c.idx++; c.path = null; c.targetShelf = null; break; }
        if (fix !== c.targetShelf) { c.targetShelf = fix; c.path = null; }
        goto(fix.face.x + c.id % 3 * 0.25 - 0.25, fix.face.y);
        if (arrived(fix.face.x, fix.face.y, 0.75)) { c.state = 'browse'; c.t = rnd(0.9, 2.0); c.path = null; c.yaw = 180; }
        break;
      }
      case 'browse': {
        c.t -= dt;
        if (c.t > 0) break;
        const f = c.targetShelf;
        const pid = c.want[c.idx];
        c.targetShelf = null;
        if (!f || f.pid !== pid || f.qty <= 0) { c.state = 'shop'; break; }   // someone emptied it - look again
        const price = this.prices[pid];
        const prod = PRODUCTS[pid];
        if (f.life !== null && f.life !== undefined && f.life <= 0) {
          c.missed++; this.ledger.missed++;
          this.rep = clamp(this.rep - 0.5, 0, 100);
          if (!f.expiredWarned) { f.expiredWarned = true; this.toast(`A shopper found expired ${prod.name} on the shelf!`, 'bad'); }
        } else if (price > prod.base * c.tol) {
          c.missed++; this.ledger.missed++;
          this.rep = clamp(this.rep - 0.35, 0, 100);
        } else {
          const ratio = price / prod.base;
          const promo = this.promoActive(pid);
          const maxQty = (ratio < 0.85 ? 3 : ratio < 1.1 ? 2 : 1) + (c.type === 'bulk' ? 1 : 0) + (promo ? 1 : 0);
          const take = Math.min(irnd(1, maxQty), f.qty);
          f.qty -= take;
          if (promo) this.ledger.promoSold += take;
          this.stockAlert(f);
          const ex = c.items.find(it => it.pid === pid);
          if (ex) ex.qty += take; else c.items.push({ pid, qty: take, price });   // price agreed at the shelf
        }
        c.idx++; c.state = 'shop'; c.path = null;
        break;
      }
      case 'tocheck': {
        const co = this.chooseCheckout();
        if (!co) { c.state = 'wait'; c.t = 2; c.path = null; c.waitAt = { x: rnd(21.5, 25.5), y: rnd(28.6, 30.6) }; break; }
        c.co = co; co.queue.push(c); this.repositionQueue(co);
        c.state = 'queue'; c.path = null;
        break;
      }
      case 'wait': {
        c.t -= dt; c.patience -= dt;
        goto(c.waitAt.x, c.waitAt.y);
        if (c.t <= 0) { c.state = 'tocheck'; c.path = null; }
        if (c.patience <= 0) this.abandon(c);
        break;
      }
      case 'queue': {
        c.patience -= dt * (this.tillStaffed(c.co) ? 1 : 1.35);
        if (c.target) goto(c.target.x, c.target.y);
        const co = c.co;
        if (co && co.queue[0] === c && arrived(c.target.x, c.target.y, 0.6)) {
          c.yaw = 0;
          if (!co.active) { co.active = c; co.scanned = 0; co.stage = 'scan'; co.pay = null; }
        }
        // once scanning has started they stay; at an empty till they give up like everyone else
        if (c.patience <= 0 && co && (co.active !== c || (!this.tillStaffed(co) && co.stage !== 'card' && co.stage !== 'upi'))) this.abandon(c);
        break;
      }
      case 'flee': {
        if (c.y < 33.2) goto(DOOR_OUT.x, DOOR_OUT.y + 0.6);
        else goto(c.exit.x, c.exit.y);
        if (c.y >= 33.2 && !c.escaped) {
          c.escaped = true;
          const worth = sumItems(c.items, it => it.qty * PRODUCTS[it.pid].cost);
          this.ledger.stolen += worth;
          this.ledger.escaped++;
          this.rep = clamp(this.rep - 1.0, 0, 100);
          this.toast(`A shoplifter got away with ₹${worth} of stock`, 'bad');
          c.items = []; c.state = 'leave'; c.path = null;
        }
        break;
      }
      case 'caught': {
        c.t -= dt;
        if (c.t <= 0) { c.state = 'leave'; c.thief = false; c.path = null; }
        break;
      }
      case 'leave': {
        if (c.y < 33.2) goto(DOOR_OUT.x, DOOR_OUT.y + 0.6);
        else goto(c.exit.x, c.exit.y);
        if (c.y >= 33.2 && arrived(c.exit.x, c.exit.y, 0.6)) c.dead = true;
        break;
      }
    }
  }

  // tell the crew when a fixture runs low or sells out (once each, until it's refilled)
  stockAlert(f) {
    const cap = this.capOf(f);
    const name = PRODUCTS[f.pid] ? PRODUCTS[f.pid].name : 'stock';
    if (f.qty === 0 && !f.outAlert) {
      f.outAlert = true; f.lowAlert = true;
      this.toast(`Sold out: ${name}`, 'warn', { fx: f.id });
    } else if (f.qty > 0 && f.qty <= cap * 0.25 && !f.lowAlert) {
      f.lowAlert = true;
      this.toast(`Running low: ${name} (${f.qty} left)`, 'warn', { fx: f.id });
    }
  }

  abandon(c) {
    const worth = sumItems(c.items, it => it.qty * PRODUCTS[it.pid].cost);
    this.ledger.lost += worth;
    this.ledger.walkouts++;
    this.rep = clamp(this.rep - 1.4, 0, 100);
    this.detachFromTill(c);
    c.items = []; c.state = 'leave'; c.path = null; c.angry = true;
    this.toast('A shopper gave up waiting and walked out', 'bad');
  }

  detachFromTill(c) {
    if (!c.co) return;
    const co = c.co;
    const i = co.queue.indexOf(c);
    if (i >= 0) co.queue.splice(i, 1);
    if (co.active === c) { co.active = null; co.scanned = 0; co.stage = null; co.pay = null; }
    this.repositionQueue(co);
    c.co = null;
  }

  // -------------------------------------------------------------- staff NPCs

  syncStaff() {
    const want = { cashier: this.level('cashier'), stocker: this.level('stocker') };
    for (const k of ['cashier', 'stocker']) {
      let have = this.staff.filter(s => s.k === k).length;
      while (have < want[k]) {
        this.staff.push({
          id: this.nextId++, k, name: k === 'cashier' ? pick(['Anil', 'Sana', 'Rohit', 'Leela']) : pick(['Manoj', 'Fatima', 'Ishaan', 'Gita']),
          x: k === 'cashier' ? CASHIER_REST.x : 8.5, y: k === 'cashier' ? CASHIER_REST.y : 12.5, yaw: 0, state: 'idle', path: null, wp: 0, box: null, t: 0, till: null, look: (Math.random() * 1e6) | 0,
        });
        have++;
      }
    }
  }

  // Hired cashiers stay on their till until a player takes it over; the spare ones go to the
  // busiest uncovered till (a shopper at the scanner first, then the longest queue).
  assignCashiers() {
    const cashiers = this.staff.filter(s => s.k === 'cashier');
    for (const co of this.checkouts) co.npc = null;
    for (const s of cashiers) {
      const co = s.till !== null && s.till !== undefined ? this.checkouts[s.till] : null;
      if (co && this.tillActive(co) && !co.manned && co.npc === null) co.npc = s.id;
      else s.till = null;
    }
    const open = this.checkouts.filter(co => this.tillActive(co) && !co.manned && co.npc === null)
      .sort((a, b) => (!!b.active - !!a.active) || (b.queue.length - a.queue.length) || (b.id - a.id));
    for (const s of cashiers) {
      if (s.till !== null) continue;
      const co = open.shift();
      if (!co) break;
      s.till = co.id; co.npc = s.id; s.atTill = false;
    }
  }

  stepStaff(s, dt) {
    const moving = this.stepPath(s, STAFF_SPEED, dt);
    s.m = moving;
    const goto = (tx, ty) => {
      const sameDest = s.dest && Math.hypot(s.dest.x - tx, s.dest.y - ty) <= 0.3;
      if (sameDest && (s.path || Math.hypot(s.x - tx, s.y - ty) < 0.15)) return;   // on the way, or already there
      {
        s.dest = { x: tx, y: ty };
        s.path = this.findPath(s.x, s.y, tx, ty); s.wp = 0;
        if (!s.path) { s.x = tx; s.y = ty; }
      }
    };
    const at = (tx, ty, r = 0.45) => Math.hypot(s.x - tx, s.y - ty) < r;

    if (s.k === 'cashier') {
      const co = s.till !== null ? this.checkouts[s.till] : null;
      if (co) {
        goto(co.clerk.x, co.clerk.y);
        s.atTill = at(co.clerk.x, co.clerk.y, 0.5);
        if (s.atTill) {
          s.yaw = 180;
          co.npcCd = (co.npcCd || 0) - dt;
          if (co.active && co.npcCd <= 0 && co.scanCd <= 0) { this.scanStep(co, null); co.npcCd = 0; }
        }
      } else {
        goto(CASHIER_REST.x, CASHIER_REST.y);
      }
      return;
    }

    // ---- stock clerk
    if (s.box) s.box.x = s.x, s.box.y = s.y;
    switch (s.state) {
      case 'idle': {
        s.t -= dt;
        if (s.t > 0) { if (!s.box) goto(8.5, 12.5); break; }
        if (s.box) { s.state = 'tofix'; break; }
        // nearest unreserved box that has somewhere to go
        let best = null, bd = Infinity;
        for (const b of this.boxes) {
          if (b.res && b.res !== s.id) continue;
          if (b.life !== null && b.life !== undefined && b.life <= 0) continue;
          if (!this.targetFor(b.pid)) continue;
          const d = Math.hypot(b.x - s.x, b.y - s.y);
          if (d < bd) { bd = d; best = b; }
        }
        if (!best) { s.t = 2; break; }
        best.res = s.id; s.target = best; s.state = 'tobox'; s.path = null; s.dest = null;
        break;
      }
      case 'tobox': {
        const b = s.target;
        if (!b || !this.boxes.includes(b)) { s.state = 'idle'; s.t = 0.3; break; }
        goto(b.x, b.y);
        if (at(b.x, b.y, 0.7)) {
          this.boxes.splice(this.boxes.indexOf(b), 1);
          b.held = -s.id; b.res = null; s.box = b; s.state = 'tofix'; s.path = null; s.dest = null;
        }
        break;
      }
      case 'tofix': {
        const f = (s.fix && this.fixtureFits(s.fix, s.box.pid)) ? s.fix : this.targetFor(s.box.pid, s);
        if (!f) {
          // nowhere to put it - set it down and rest
          s.box.held = null; s.box.x = s.x; s.box.y = s.y; this.boxes.push(s.box); s.box = null;
          s.fix = null; s.state = 'idle'; s.t = 4; break;
        }
        s.fix = f;
        goto(f.face.x, f.face.y);
        if (at(f.face.x, f.face.y, 0.6)) {
          s.yaw = 180;
          this.stockInto(f, s.box);
          s.fix = null;
          s.t = 0.6; s.state = 'pause';
          if (s.box.units <= 0) s.box = null;
        }
        break;
      }
      case 'pause': {
        s.t -= dt;
        if (s.t <= 0) s.state = s.box ? 'tofix' : 'idle';
        break;
      }
    }
  }

  fixtureFits(f, pid) {
    if (!this.fixtureActive(f) || f.kind !== KIND_FIXTURE[PRODUCTS[pid].kind]) return false;
    if (f.qty > 0 && f.life !== null && f.life !== undefined && f.life <= 0) return false;   // clear expired stock first
    if (f.pid === pid) return f.qty < this.capOf(f);
    return f.pid === null || f.qty === 0;
  }

  // best fixture for a product: top up an existing face first, else claim an empty one
  targetFor(pid, near) {
    let best = null, bs = Infinity;
    for (const f of this.fixtures) {
      if (!this.fixtureFits(f, pid)) continue;
      const empty = f.pid !== pid || f.qty === 0;
      const d = near ? Math.hypot(f.face.x - near.x, f.face.y - near.y) : 0;
      const s = (empty ? 100 : f.qty / this.capOf(f) * 50) + d * 0.5;
      if (s < bs) { bs = s; best = f; }
    }
    return best;
  }

  // -------------------------------------------------------------- physics

  movePlayer(p, dt) {
    const ix = p.input.mx, iy = p.input.mz;
    const len = Math.hypot(ix, iy);
    p.moving = len > 0.01;
    p.sprint = p.moving && p.input.sp && !p.box;
    if (!p.moving) return;
    const sp = (p.box ? SPEED_CARRY : p.sprint ? SPEED_SPRINT : SPEED) * dt;
    const nx = p.x + ix * sp;
    if (this.freeAt(nx, p.y)) p.x = nx;
    const ny = p.y + iy * sp;
    if (this.freeAt(p.x, ny)) p.y = ny;
  }

  separate() {
    const ps = [...this.players.values()];
    const push = (p, dx, dy) => {
      if (this.freeAt(p.x + dx, p.y)) p.x += dx;
      if (this.freeAt(p.x, p.y + dy)) p.y += dy;
    };
    const MIN = 0.62;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        const nx = d > 1e-4 ? dx / d : 1, ny = d > 1e-4 ? dy / d : 0, o = (MIN - d) / 2;
        push(a, -nx * o, -ny * o); push(b, nx * o, ny * o);
      }
      // shoppers hold their ground; the player steps round them
      for (const c of this.customers) {
        const dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy);
        if (d >= 0.55 || d < 1e-4 || c.y > 33.2) continue;
        push(a, dx / d * (0.55 - d), dy / d * (0.55 - d));
      }
    }
  }

  freeAt(x, y, r = PLAYER_R) {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      if (!this.tileWalkable(Math.floor(x + ox), Math.floor(y + oy))) return false;
    }
    for (const c of PROP_COLLIDERS) { const dx = x - c.x, dy = y - c.y, rr = c.r + r; if (dx * dx + dy * dy < rr * rr) return false; }
    return true;
  }

  // -------------------------------------------------------------- main tick

  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const d = this.pending[i];
      d.at -= dt;
      if (d.at <= 0) {
        this.pending.splice(i, 1);
        const spot = this.freeDeliverySpot();
        this.boxes.push({ id: this.nextId++, pid: d.pid, units: PRODUCTS[d.pid].per, x: spot.x, y: spot.y, held: null, life: PRODUCTS[d.pid].life || null });
        if (this.pending.length === 0) this.toast('Delivery has arrived in storage', 'info', { sfx: 'truck' });
      }
    }

    for (const p of this.players.values()) {
      this.movePlayer(p, dt);
      if (p.box) { p.box.x = p.x; p.box.y = p.y; }
      if (p.sayT > 0) { p.sayT -= dt; if (p.sayT <= 0) p.say = ''; }
      if (p.chatCd > 0) p.chatCd -= dt;
      let at = null;
      for (const c of this.checkouts) {
        if (this.tillActive(c) && Math.hypot(p.x - c.clerk.x, p.y - c.clerk.y) < 1.0) { at = c.id; break; }
      }
      if (p.atCheckout !== null && p.atCheckout !== at) {
        const old = this.checkouts[p.atCheckout];
        if (old && old.manned === p.id) old.manned = null;
      }
      p.atCheckout = at;
      if (at !== null) {
        const co = this.checkouts[at];
        if (!co.manned || !this.players.has(co.manned)) co.manned = p.id;
      }
    }
    this.separate();
    for (const co of this.checkouts) {
      if (co.scanCd > 0) co.scanCd -= dt;
      if (co.manned && !this.players.has(co.manned)) co.manned = null;
    }
    this.assignCashiers();
    for (const s of this.staff) this.stepStaff(s, dt);
    this.tickPayments(dt);

    if (this.phase === 'open') {
      this.timer -= dt;
      this.spawnCd -= dt;
      const w = WEATHER[this.weather];
      const L = this.levelInfo();
      // footfall grows with the day, reputation and loyalty, but a small shop only draws so many
      const target = Math.min(18 + this.day * 5 + this.rep * 0.3 + Math.min(30, this.loyal * 0.25), L.cap) * w.spawn *
        (this.has('ads') ? 1.25 : 1) * (this.has('cardpos') ? 1.1 : 1);
      const interval = clamp(DAY_LENGTH / target, 0.9, 14);
      if (this.spawnCd <= 0 && this.customers.length < L.crowd) {
        this.spawnCustomer();
        this.spawnCd = interval * rnd(0.6, 1.4);
      }
      this.spillCd -= dt * w.spill;
      if (this.spillCd <= 0) { this.spawnSpill(); this.spillCd = rnd(35, 70); }
      if (this.timer <= 0) { this.phase = 'closing'; this.timer = CLOSING_GRACE; this.toast('Doors closed - finish serving!', 'info', { sfx: 'close' }); }
    } else if (this.phase === 'closing') {
      this.timer -= dt;
      if (this.customers.length === 0 || this.timer <= 0) {
        for (const c of this.customers) { this.ledger.lost += sumItems(c.items, it => it.qty * PRODUCTS[it.pid].cost); this.detachFromTill(c); c.dead = true; }
        this.customers = [];
        this.closeDay();
      }
    }

    // spills hurt reputation while they sit there
    if (this.phase === 'open' || this.phase === 'closing') this.rep = clamp(this.rep - this.spills.length * 0.012 * dt, 0, 100);

    for (const c of this.customers) this.stepCustomer(c, dt);
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.dead) { this.detachFromTill(c); this.customers.splice(i, 1); }
    }
  }

  spawnSpill() {
    if (this.spills.length >= 5) return;
    for (let k = 0; k < 40; k++) {
      const x = irnd(15, 56), y = irnd(4, 31);
      if (this.map[y][x] !== '.' || !this.reach[y * MAP_W + x]) continue;
      if (y >= 27 && y <= 28) continue; // keep clear of the till pads
      this.spills.push({ id: this.nextId++, x: x + 0.5, y: y + 0.5, hp: 3 });
      this.ledger.spills++;
      this.toast('Clean-up needed: a spill on the shop floor', 'bad');
      return;
    }
  }

  // the pad first, then overflow into the rest of the storage room, never stacking two boxes
  freeDeliverySpot() {
    const free = (cx, cy) => !this.boxes.some(b => Math.hypot(b.x - cx, b.y - cy) < 0.6);
    for (let y = PAD.y0; y <= PAD.y1; y++) for (let x = PAD.x0; x <= PAD.x1; x++) {
      if (free(x + 0.5, y + 0.5)) return { x: x + 0.5, y: y + 0.5 };
    }
    for (let y = 3; y <= 32; y++) for (let x = 4; x <= 12; x++) {
      if (this.map[y][x] !== '.' || (x === TERMINAL.x && y === TERMINAL.y)) continue;
      if (y >= 15 && y <= 17 && x >= 11) continue;          // keep the doorway clear
      if (free(x + 0.5, y + 0.5)) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: rnd(PAD.x0 + 0.5, PAD.x1 + 0.5), y: rnd(PAD.y0 + 0.5, PAD.y1 + 0.5) };
  }

  // -------------------------------------------------------------- net state

  staticState() {
    return {
      w: MAP_W, h: MAP_H,
      map: this.map.map(r => r.join('')),
      mapVer: this.mapVer,
      products: PRODUCTS,
      upgrades: UPGRADES,
      weathers: WEATHER,
      fixtures: this.fixtures.map(f => ({ id: f.id, kind: f.kind, tx: f.tx, ty: f.ty, cx: f.cx, cy: f.cy, lvl: f.lvl })),
      checkouts: this.checkouts.map(c => ({ id: c.id, tx: c.tx, ty: c.ty, cx: c.cx, cy: c.cy, kx: c.clerk.x, ky: c.clerk.y, lvl: c.lvl })),
      baseCap: BASE_CAP,
      terminal: TERMINAL, pad: PAD, bin: BIN, maxPromos: MAX_PROMOS, door: { x0: DOOR_X0, x1: DOOR_X1, y: 33 },
      cars: { a: CAR_A, b: CAR_B }, trees: TREES, trolleys: TROLLEYS, props: PROPS, colliders: PROP_COLLIDERS,
      dayLength: DAY_LENGTH,
      levels: STORE_LEVELS, licenses: LICENSES, zones: ZONES, partitions: PARTITIONS, notes: NOTES,
    };
  }

  snapshot() {
    const r2 = v => Math.round(v * 100) / 100;
    return {
      ph: this.phase,
      tm: Math.max(0, Math.round(this.timer)),
      clk: this.clock(),
      day: this.day,
      wx: this.weather,
      cash: Math.round(this.cash),
      rep: Math.round(this.rep * 10) / 10,
      prices: this.prices,
      pend: this.pending.length,
      up: this.upgrades,
      lvl: this.lvl,
      lic: this.licenses,
      srv: this.servedTotal,
      lvb: this.levelBlockers(),
      mv: this.mapVer,
      deep: this.has('deep') ? 1 : 0,
      pr: this.promos,
      ly: this.loyal,
      gl: this.goals.map(g => { const [v, done] = this.goalProgress(g); return { t: g.t, v, n: g.n, k: g.k, done, r: g.reward }; }),
      pl: [...this.players.values()].map(p => ({
        id: p.id, n: p.name, c: p.color, x: r2(p.x), y: r2(p.y),
        yaw: Math.round(p.yaw), m: p.moving ? (p.sprint ? 2 : 1) : 0,
        b: p.box ? p.box.pid : -1, bu: p.box ? p.box.units : 0, bl: p.box && p.box.life !== null && p.box.life !== undefined ? p.box.life : -1, co: p.atCheckout,
        say: p.say, st: [p.stats.stocked, p.stats.scanned, p.stats.served, p.stats.caught, p.stats.cleaned],
      })),
      // shoppers are the bulk of every snapshot, so they go as flat arrays (see CU_FIELDS in client.js)
      cu: this.customers.map(c => [
        c.id, r2(c.x), r2(c.y), Math.round(c.yaw || 0), c.state, c.look, sumItems(c.items, i => i.qty),
        c.thief && c.state === 'flee' ? 1 : 0, Math.round(c.patience), c.type === 'bulk' ? 1 : 0,
        c.path ? 1 : 0, c.member ? 1 : 0, c.angry ? 1 : 0, c.stun > 0 ? 1 : 0,
      ]),
      sf: this.staff.map(s => ({ id: s.id, k: s.k, n: s.name, x: r2(s.x), y: r2(s.y), yaw: Math.round(s.yaw || 0), m: s.m ? 1 : 0, b: s.box ? s.box.pid : -1, lk: s.look })),
      bx: this.boxes.map(b => ({ id: b.id, p: b.pid, u: b.units, x: r2(b.x), y: r2(b.y), l: b.life === null || b.life === undefined ? -1 : b.life })),
      sh: this.fixtures.map(f => [f.pid === null ? -1 : f.pid, f.qty, f.life === null || f.life === undefined || f.pid === null ? -1 : f.life]),
      ck: this.checkouts.map(c => ({
        i: c.id, m: c.manned, npc: c.npc !== null ? 1 : 0, q: c.queue.length, sc: c.scanned,
        tot: c.active ? this.unitCount(c.active) : 0,
        sum: c.active ? this.billTotal(c.active) : 0,
        items: c.active ? c.active.items.map(it => ({ pid: it.pid, qty: it.qty, p: it.price !== undefined ? it.price : this.prices[it.pid] })) : null,
        st: c.active ? c.stage : null,
        mb: c.active && c.active.member ? 1 : 0,
        pay: c.pay ? { m: c.pay.m, td: c.pay.td, due: c.pay.due, g: c.pay.given, t: Math.max(0, Math.round(c.pay.t * 10) / 10) } : null,
        last: c.last ? { m: c.last.m, total: c.last.total, ch: c.last.ch } : null,
      })),
      sp: this.spills.map(s => ({ id: s.id, x: s.x, y: s.y, hp: s.hp })),
      sum: this.summary,
      ev: this.events.splice(0, this.events.length),
    };
  }

  promptFor(id) {
    const p = this.players.get(id);
    if (!p) return null;
    // behind a till with a shopper at the scanner, scanning always wins
    if (p.atCheckout !== null && this.checkouts[p.atCheckout].active && this.checkouts[p.atCheckout].manned !== id) {
      const other = this.players.get(this.checkouts[p.atCheckout].manned);
      return { key: '', label: `${other ? other.name : 'Someone'} is working this till` };
    }
    if (p.atCheckout !== null && this.checkouts[p.atCheckout].active) {
      const co = this.checkouts[p.atCheckout];
      const c = co.active, total = this.unitCount(c), bill = this.billTotal(c);
      if (co.scanned < total) {
        const pid = this.unitAt(c, co.scanned);
        return { key: 'SPACE', label: `Scan ${PRODUCTS[pid].name} · item ${co.scanned + 1} of ${total}` };
      }
      const pay = co.pay;
      if (!pay) return { key: 'SPACE', label: `Bill total ₹${bill} · ask the shopper to pay` };
      if (co.stage === 'card') return { key: '', label: `Card payment ₹${pay.total} · shopper is entering their PIN…` };
      if (co.stage === 'upi') return { key: '', label: `UPI ₹${pay.total} · shopper is scanning the QR code…` };
      if (co.stage === 'cash') {
        const left = pay.due - pay.given;
        if (left <= 0) return { key: 'SPACE', label: `Exact cash ₹${pay.td} received · close the drawer` };
        return { key: 'SPACE', label: `Cash ₹${pay.td} received · open the drawer, give ₹${left} change`, open: 'drawer' };
      }
    }
    const t = this.probe(p);
    if (t) {
      const key = (t.kind === 'info' || t.kind === 'pullable') ? '' : t.kind === 'blocked' ? '' : 'E';
      return { key, label: t.label, bad: t.kind === 'blocked' || !!t.bad, open: t.open, alt: t.alt, altLabel: t.altLabel };
    }
    if (p.atCheckout !== null) {
      const co = this.checkouts[p.atCheckout];
      return { key: '', label: co.queue.length ? 'Customer walking up…' : 'Till open - waiting for a customer' };
    }
    if (p.box) return { key: 'Q', label: 'Drop box' };
    return null;
  }
}

module.exports = { Game, PRODUCTS, UPGRADES, STORE_LEVELS, LICENSES, NOTES, MAP_W, MAP_H, DAY_LENGTH, SOLID, MAX_PLAYERS };
