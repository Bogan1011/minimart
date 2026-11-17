'use strict';
/* Fast, deterministic checks of every simulation feature. Run: node test/game.test.js */
process.env.MM_DAY = process.env.MM_DAY || '120';
process.env.MM_CLOSE = process.env.MM_CLOSE || '30';
process.env.MM_DELIVERY = process.env.MM_DELIVERY || '2';
process.env.MM_CASH = process.env.MM_CASH || '50000';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Game, PRODUCTS, UPGRADES, STORE_LEVELS, LICENSES } = require('../game');

let fails = 0, passes = 0;
const results = [];
function check(area, label, cond, extra = '') {
  results.push({ area, label, ok: !!cond });
  console.log(`${cond ? ' PASS' : ' FAIL'}  [${area}] ${label}${extra ? '  (' + extra + ')' : ''}`);
  cond ? passes++ : fails++;
}
const run = (g, secs, step = 1 / 30) => { for (let t = 0; t < secs; t += step) g.update(step); };
const pidOf = name => PRODUCTS.find(p => p.name === name).id;
const fixOf = (g, kind, i = 0) => g.fixtures.filter(f => f.kind === kind && f.lvl === 1)[i];
// stand just in front of a fixture, facing it
const faceFix = (p, f) => { p.x = f.cx; p.y = f.cy + 1.3; p.yaw = 180; };
const giveBox = (g, p, pid, units) => { p.box = { id: g.nextId++, pid, units: units ?? PRODUCTS[pid].per, x: p.x, y: p.y, held: p.id }; };

// ------------------------------------------------------------------ players
{
  const g = new Game();
  const a = g.addPlayer(1, 'Asha'), b = g.addPlayer(2, '<b>Dev</b>');
  check('players', 'two players join with different colours', a && b && a.color !== b.color);
  check('players', 'names are cleaned of markup', b.name === 'bDev/b', b.name);
  for (let i = 3; i <= 8; i++) g.addPlayer(i, 'P' + i);
  check('players', '9th player is refused (max 8)', g.addPlayer(9, 'Nine') === null && g.players.size === 8);
  check('players', 'spawn points are walkable', [...g.players.values()].every(p => g.freeAt(p.x, p.y)));
  giveBox(g, a, 0, 5);
  g.removePlayer(1);
  check('players', 'leaving drops the carried box on the floor', g.boxes.some(x => x.pid === 0 && x.units === 5));
}

// ------------------------------------------------------------------ movement
{
  const g = new Game();
  const p = g.addPlayer(1, 'Mover');
  const x0 = p.x;
  g.setInput(1, { mx: 1, mz: 0, yaw: 90 });
  run(g, 1);
  const walked = p.x - x0;
  g.setInput(1, { mx: 1, mz: 0, yaw: 90, sp: true });
  const x1 = p.x; run(g, 1);
  check('movement', 'walking moves ~2.6 tiles/s', Math.abs(walked - 2.6) < 0.15, walked.toFixed(2));
  check('movement', 'sprinting is faster', p.x - x1 > walked + 0.8, (p.x - x1).toFixed(2));
  g.setInput(1, { mx: 0, mz: -1, yaw: 180 });
  run(g, 20);
  check('movement', 'walls stop players', g.freeAt(p.x, p.y) && p.y > 2.9, `y=${p.y.toFixed(2)}`);
  g.setInput(1, { mx: 999, mz: 999 });
  check('movement', 'oversized input is normalised', Math.hypot(p.input.mx, p.input.mz) <= 1.0001);
}

// ------------------------------------------------------------------ ordering + deliveries
{
  const g = new Game();
  g.addPlayer(1, 'Buyer');
  const cash0 = g.cash;
  const cola = pidOf('Cola Can');
  g.order(1, cola, 3);
  const cost = PRODUCTS[cola].cost * PRODUCTS[cola].per * 3;
  check('ordering', 'order deducts the right cash', g.cash === cash0 - cost, `${cash0} -> ${g.cash}`);
  check('ordering', 'order queues one delivery per box', g.pending.length === 3);
  g.order(1, pidOf('Ice Cream Tub'), 1);
  check('ordering', 'products without a licence are refused', g.pending.length === 3);
  g.cash = 10; g.order(1, cola, 1);
  check('ordering', 'order refused when cash is short', g.pending.length === 3 && g.cash === 10);
  g.cash = 1e6; g.order(1, cola, 20); g.order(1, cola, 20); g.order(1, cola, 20);
  check('ordering', 'supplier caps in-flight boxes at 60', g.pending.length <= 60, `pending=${g.pending.length}`);
  run(g, 25);
  const pad = g.staticState().pad;
  check('ordering', 'all boxes arrive on the delivery pad', g.pending.length === 0 && g.boxes.length >= 43 &&
    g.boxes.slice(0, 20).every(b => b.x >= pad.x0 && b.x <= pad.x1 + 1 && b.y >= pad.y0 && b.y <= pad.y1 + 1), `${g.boxes.length} boxes`);
}

// ------------------------------------------------------------------ carrying + stocking rules
{
  const g = new Game();
  const p = g.addPlayer(1, 'Stocker');
  const bread = pidOf('Bread Loaf'), milk = pidOf('Milk Packet'), apples = pidOf('Apples');
  g.boxes.push({ id: 500, pid: bread, units: 10, x: p.x + 1, y: p.y, held: null });
  p.yaw = 90;
  g.act(1);
  check('stocking', 'E picks up the box you look at', p.box && p.box.id === 500 && !g.boxes.some(b => b.id === 500));
  g.drop(1);
  check('stocking', 'Q drops it back on the floor', !p.box && g.boxes.some(b => b.id === 500));

  const shelf = fixOf(g, 'shelf', 0);
  giveBox(g, p, bread, 30);
  faceFix(p, shelf);
  check('stocking', 'prompt offers to stock the shelf', /^Stock Bread/.test(g.promptFor(1).label), g.promptFor(1).label);
  g.act(1);
  check('stocking', 'stocking fills up to shelf capacity (24)', shelf.pid === bread && shelf.qty === 24 && p.box.units === 6, `qty=${shelf.qty} left=${p.box.units}`);
  g.act(1);
  check('stocking', 'a full shelf blocks more stock', shelf.qty === 24 && g.promptFor(1).bad);
  p.box = null;

  giveBox(g, p, milk);
  const shelf2 = fixOf(g, 'shelf', 1);
  faceFix(p, shelf2);
  g.act(1);
  check('stocking', 'chilled goods are refused by a dry shelf', shelf2.pid === null && /fridge/.test(g.promptFor(1).label), g.promptFor(1).label);
  const fridge = fixOf(g, 'fridge', 0);
  faceFix(p, fridge);
  g.act(1);
  check('stocking', 'chilled goods go into a fridge', fridge.pid === milk && fridge.qty === PRODUCTS[milk].per);

  giveBox(g, p, apples);
  const crate = fixOf(g, 'produce', 0);
  faceFix(p, crate);
  g.act(1);
  check('stocking', 'fruit goes into a produce crate', crate.pid === apples && crate.qty > 0);

  const freezer = g.fixtures.find(f => f.kind === 'freezer');
  giveBox(g, p, pidOf('Frozen Peas'));
  faceFix(p, freezer);
  check('stocking', 'a freezer in an unopened zone says it is locked', /Locked/.test(g.promptFor(1).label), g.promptFor(1).label);
  p.box = null;

  // R: empty a shelf back into a box
  faceFix(p, shelf);
  check('stocking', 'empty-handed prompt shows stock level and R hint', g.promptFor(1).alt === 'R' && /24\/24/.test(g.promptFor(1).label));
  g.pull(1);
  check('stocking', 'R moves the shelf contents into your hands', p.box && p.box.units === 24 && shelf.pid === null && shelf.qty === 0);
  giveBox(g, p, pidOf('Soap Bar'));
  g.act(1);
  check('stocking', 'an emptied shelf can take a new product', shelf.pid === pidOf('Soap Bar'));
}

// ------------------------------------------------------------------ prices + shoppers
{
  const g = new Game();
  g.addPlayer(1, 'Pricer');
  const cola = pidOf('Cola Can');
  g.setPrice(1, cola, -50);
  check('pricing', 'price is clamped to at least 1', g.prices[cola] === 1);
  g.setPrice(1, cola, 1e9);
  check('pricing', 'price is clamped to at most 9999', g.prices[cola] === 9999);
  g.setPrice(99, cola, 30);
  check('pricing', 'unknown players cannot change prices', g.prices[cola] === 9999);

  // a shopper refuses an absurd price
  const shelf = fixOf(g, 'shelf', 0);
  shelf.pid = cola; shelf.qty = 20;
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9;
  g.spawnCustomer();
  const c = g.customers[0];
  c.want = [cola]; c.thief = false;
  run(g, 60);
  check('pricing', 'shoppers refuse overpriced goods', shelf.qty === 20 && g.ledger.missed >= 1, `qty=${shelf.qty} missed=${g.ledger.missed}`);
}

// ------------------------------------------------------------------ full sale through a till
{
  const g = new Game();
  const p = g.addPlayer(1, 'Cashier');
  const cola = pidOf('Cola Can');
  const shelf = fixOf(g, 'shelf', 0);
  shelf.pid = cola; shelf.qty = 24;
  const co = g.checkouts[0];
  p.x = co.clerk.x; p.y = co.clerk.y;
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9;
  g.spawnCustomer();
  const c = g.customers[0];
  c.want = [cola]; c.thief = false; c.patience = 999;
  check('customers', 'shoppers arrive from the car park', c.y > 33);
  let t = 0;
  while (!co.active && t < 90) { g.update(1 / 30); t += 1 / 30; }
  check('customers', 'shopper walks in, takes stock and queues at the manned till', co.active === c && c.items.length && shelf.qty < 24, `${t.toFixed(1)}s`);
  check('tills', 'standing on the pad mans the till', co.manned === 1 && p.atCheckout === 0);
  check('tills', 'prompt names the item being scanned', /^Scan Cola Can · item 1 of/.test(g.promptFor(1).label), g.promptFor(1).label);
  const cash0 = g.cash, items = c.items.reduce((a, i) => a + i.qty, 0);
  for (let i = 0; i < items; i++) { g.scan(1); run(g, 0.3); }
  const bill = c.items.reduce((a, i) => a + i.qty * g.prices[i.pid], 0);
  check('tills', 'after the last scan the bill total is shown', co.stage === 'total' && new RegExp(`Bill total ₹${bill}`).test(g.promptFor(1).label), g.promptFor(1).label);
  g.prices[cola] = 999;
  check('tills', 'scanned items keep the price they were scanned at', g.billTotal(c) === bill);
  g.scan(1);
  check('tills', 'without a card machine the shopper pays cash', co.stage === 'cash' && co.pay.m === 'cash' && co.pay.td >= bill);
  // force a known tender: ₹63 change due
  co.pay.td = bill + 63; co.pay.due = 63;
  check('tills', 'prompt asks for the change and opens the drawer', g.promptFor(1).open === 'drawer' && /give ₹63 change/.test(g.promptFor(1).label), g.promptFor(1).label);
  const rep0 = g.rep;
  g.events = [];
  g.giveChange(1, 50);
  check('tills', 'short change is refused and the shopper complains', co.active === c && co.stage === 'cash' && g.ledger.shortChange === 1 && g.rep < rep0 &&
    g.events.some(e => e.to === 1 && /₹13 short/.test(e.msg)));
  g.giveChange(1, 20);
  check('tills', 'giving too much completes the sale but loses the extra', !co.active && g.ledger.served === 1 && g.ledger.overpaid === 7 && g.cash === cash0 + bill - 7, `+${g.cash - cash0}`);
  const rc = g.events.find(e => e.kind === 'receipt');
  check('tills', 'a receipt is printed for the clerk', rc && rc.to === 1 && rc.receipt.total === bill && rc.receipt.m === 'cash' && rc.receipt.td === bill + 63 &&
    rc.receipt.lines[0].pid === cola && rc.receipt.lines[0].p === PRODUCTS[cola].base);
  check('tills', 'player stats count scans and serves', p.stats.scanned === items && p.stats.served === 1);
  check('tills', 'served shoppers count towards the next store level', g.servedTotal === 1);
  g.prices[cola] = PRODUCTS[cola].base;
  run(g, 80);
  check('customers', 'served shopper leaves and despawns', !g.customers.includes(c));
  check('tills', 'locked tills are not manned', (() => { p.x = g.checkouts[2].clerk.x; p.y = g.checkouts[2].clerk.y; g.update(0.05); return g.checkouts[2].manned === null; })());
}

// ------------------------------------------------------------------ payments: card, UPI, declines, exact cash
{
  const mk = method => {
    const g = new Game();
    const p = g.addPlayer(1, 'Till');
    g.upgrades.cardpos = 1;
    const co = g.checkouts[0];
    p.x = co.clerk.x; p.y = co.clerk.y;
    g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9;
    g.update(0.01);
    g.spawnCustomer();
    const c = g.customers[0];
    c.items = [{ pid: 0, qty: 2 }, { pid: 3, qty: 1 }]; c.state = 'queue'; c.co = co; c.patience = 999; c.thief = false;
    co.queue = [c]; g.repositionQueue(co); co.active = c; co.stage = 'scan'; co.scanned = 0;
    g.choosePayment = () => method;
    for (let i = 0; i < 4; i++) { co.scanCd = 0; g.scan(1); }
    return { g, p, co, c, bill: 2 * g.prices[0] + g.prices[3] };
  };
  {
    const { g, co, bill } = mk('card');
    const cash0 = g.cash;
    check('payments', 'card payment waits for the PIN', co.stage === 'card' && /PIN/.test(g.promptFor(1).label));
    co.pay.declined = false;
    run(g, 3.5);
    check('payments', 'an approved card completes the sale with no change', !co.active && g.cash === cash0 + bill && g.ledger.cardTaken === bill);
  }
  {
    const { g, co } = mk('upi');
    check('payments', 'UPI shows the QR prompt', co.stage === 'upi' && /QR/.test(g.promptFor(1).label));
    run(g, 4);
    check('payments', 'UPI completes on its own', !co.active && g.ledger.upiTaken > 0);
  }
  {
    const { g, co } = mk('card');
    co.pay.declined = true;
    run(g, 3.5);
    check('payments', 'a declined card falls back to cash', co.active && co.stage === 'cash' && g.ledger.declined === 1 && co.pay.td >= co.pay.total);
  }
  {
    const { g, co, bill } = mk('cash');
    co.pay.td = bill; co.pay.due = 0;
    check('payments', 'exact cash just needs the drawer closed', /Exact cash/.test(g.promptFor(1).label) && !g.promptFor(1).open);
    co.scanCd = 0; g.scan(1);
    check('payments', 'closing the drawer completes an exact-cash sale', !co.active && g.ledger.served === 1);
  }
  {
    const { g, co, bill } = mk('cash');
    co.pay.td = bill + 100; co.pay.due = 100;
    const cash0 = g.cash;
    g.giveChange(1, 100);
    check('payments', 'correct change counts as exact change for the goals', !co.active && g.ledger.exactChange === 1 && g.cash === cash0 + bill);
    g.giveChange(1, 1e9); g.giveChange(1, -5); g.giveChange(1, 'x');
    check('payments', 'bad change amounts are ignored', g.ledger.served === 1 && Number.isFinite(g.cash));
  }
  {
    const g = new Game();
    let cash = 0, tenders = new Set();
    for (let i = 0; i < 400; i++) { const t = g.tenderFor(437); tenders.add(t); if (t < 437) cash++; }
    check('payments', 'shoppers hand over round amounts that cover the bill', cash === 0 && [...tenders].every(t => t === 437 || [440, 450, 500].includes(t)), [...tenders].join(','));
    g.upgrades.cardpos = 1;
    const ms = new Set(); for (let i = 0; i < 300; i++) ms.add(g.choosePayment(300));
    check('payments', 'with a card machine shoppers use cash, card and UPI', ms.size === 3);
  }
}

// ------------------------------------------------------------------ queue patience
{
  const g = new Game();
  g.addPlayer(1, 'Nobody');
  const cola = pidOf('Cola Can');
  fixOf(g, 'shelf', 0).pid = cola; fixOf(g, 'shelf', 0).qty = 24;
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9;
  g.spawnCustomer();
  const c = g.customers[0];
  c.want = [cola]; c.thief = false; c.patience = 8;
  const rep0 = g.rep;
  run(g, 70);
  check('customers', 'unserved shoppers give up and reputation drops', g.ledger.lost > 0 && g.rep < rep0, `lost=${g.ledger.lost} rep ${rep0}->${g.rep.toFixed(1)}`);
}

// ------------------------------------------------------------------ shoplifters
{
  const g = new Game();
  const p = g.addPlayer(1, 'Guard');
  const cola = pidOf('Cola Can');
  fixOf(g, 'shelf', 0).pid = cola; fixOf(g, 'shelf', 0).qty = 24;
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9;
  g.spawnCustomer();
  const c = g.customers[0];
  c.want = [cola]; c.thief = true;
  let t = 0;
  while (c.state !== 'flee' && t < 90) { g.update(1 / 30); t += 1 / 30; }
  check('thieves', 'thief bolts for the door after shopping', c.state === 'flee');
  // run up behind them
  const fx = Math.sin(0) , fz = 0;
  p.x = c.x; p.y = c.y - 1.0; p.yaw = 0;
  const units = c.items.reduce((a, i) => a + i.qty, 0);
  const boxes0 = g.boxes.length;
  check('thieves', 'prompt says stop the shoplifter', /shoplifter/i.test(g.promptFor(1).label), g.promptFor(1).label);
  g.act(1);
  check('thieves', 'catching them drops the goods as boxes', c.state === 'caught' && g.boxes.length > boxes0 && g.ledger.recovered === units, `recovered=${g.ledger.recovered}`);
  check('thieves', 'catch counts on the player', p.stats.caught === 1);

  // and one that gets away
  g.spawnCustomer();
  const d = g.customers[g.customers.length - 1];
  d.want = [cola]; d.thief = true;
  run(g, 90);
  check('thieves', 'an uncaught thief costs stock value', g.ledger.stolen > 0, `stolen=${g.ledger.stolen}`);
  const g2 = new Game(); g2.upgrades.cctv = 1; g2.rep = 50;
  let thieves = 0; for (let i = 0; i < 4000; i++) { g2.spawnCustomer(); thieves += g2.customers.pop().thief ? 1 : 0; }
  check('thieves', 'CCTV halves the shoplifter rate', thieves / 4000 < 0.03, (thieves / 40).toFixed(1) + '%');
}

// ------------------------------------------------------------------ spills
{
  const g = new Game();
  const p = g.addPlayer(1, 'Mopper');
  g.openStore(); g.spawnCd = 1e9;
  g.spawnSpill();
  const s = g.spills[0];
  check('spills', 'spills appear on the shop floor', s && g.map[Math.floor(s.y)][Math.floor(s.x)] === '.');
  const rep0 = g.rep;
  run(g, 10);
  check('spills', 'a spill slowly drains reputation', g.rep < rep0);
  p.x = s.x; p.y = s.y + 1; p.yaw = 180;
  check('spills', 'prompt offers the mop', /Mop/.test(g.promptFor(1).label));
  g.act(1); g.act(1); g.act(1);
  check('spills', 'three swipes clean it', g.spills.length === 0 && p.stats.cleaned === 1);
}

// ------------------------------------------------------------------ store levels + licences
{
  const g = new Game();
  g.addPlayer(1, 'Boss');
  check('levels', 'a new game starts as a small corner shop', g.lvl === 1 && g.fixtures.filter(f => g.fixtureActive(f)).length === 12 &&
    g.checkouts.filter(c => g.tillActive(c)).length === 2);
  check('levels', 'only daily essentials are licensed at first', g.licensed(pidOf('Bread Loaf')) && !g.licensed(pidOf('Tea Pack')) && !g.licensed(pidOf('Ice Cream Tub')));
  g.cash = 200000;
  g.buyLevel(1);
  check('levels', 'expanding needs enough shoppers served', g.lvl === 1 && g.cash === 200000 && g.levelBlockers().some(b => /Serve 50/.test(b)));
  g.servedTotal = 50;
  const wall = g.map[20][27], mv = g.mapVer;
  g.buyLevel(1);
  check('levels', 'level 2 knocks through to the mini market', g.lvl === 2 && wall === 'L' && g.map[20][27] === '.' && g.mapVer === mv + 1 &&
    g.cash === 200000 - STORE_LEVELS[2].cost);
  check('levels', 'level 2 opens tills 3 and 4', g.tillActive(g.checkouts[2]) && g.tillActive(g.checkouts[3]) && !g.tillActive(g.checkouts[4]));
  g.servedTotal = 999; g.rep = 50;
  g.buyLevel(1);
  check('levels', 'the supermarket needs reputation 55', g.lvl === 2);
  g.rep = 60; g.buyLevel(1);
  const freezer = g.fixtures.find(f => f.kind === 'freezer');
  check('levels', 'level 3 opens the back hall and the frozen aisle', g.lvl === 3 && g.map[14][20] === '.' && g.fixtureActive(freezer) &&
    !!g.findPath(24, 39.5, freezer.face.x, freezer.face.y));
  g.order(1, pidOf('Ice Cream Tub'), 1);
  check('licences', 'frozen goods still need their licence', g.pending.length === 0);
  const c0 = g.cash;
  g.buyLicense(1, 'frozen');
  g.order(1, pidOf('Ice Cream Tub'), 1);
  check('licences', 'buying the licence unlocks ordering', g.licenses.frozen && g.pending.length === 1 && g.cash < c0 - LICENSES.frozen.cost);
  const c1 = g.cash;
  g.buyLicense(1, 'premium');
  check('licences', 'a licence above the store level is refused', !g.licenses.premium && g.cash === c1);
  g.buyLicense(1, 'frozen'); g.buyLicense(1, '__proto__'); g.buyLicense(1, 'toString');
  check('licences', 'owned or bogus licences are ignored', g.cash === c1 && Number.isFinite(g.cash));
  g.rep = 70; g.buyLevel(1);
  const wingShelf = g.fixtures.find(f => f.lvl === 4);
  check('levels', 'level 4 opens the east wing', g.lvl === 4 && g.map[10][41] === '.' && g.fixtureActive(wingShelf) &&
    !!g.findPath(24, 39.5, wingShelf.face.x, wingShelf.face.y) && g.checkouts.every(c => g.tillActive(c)));
  const c2 = g.cash; g.buyLevel(1);
  check('levels', 'there is nothing above the top level', g.lvl === 4 && g.cash === c2);
  check('levels', 'a bigger store draws a bigger crowd', STORE_LEVELS[4].cap > STORE_LEVELS[1].cap * 3);

  const cap0 = g.capOf(fixOf(g, 'shelf'));
  g.buyUpgrade(1, 'deep');
  check('upgrades', 'Deep shelving adds 50% capacity', g.capOf(fixOf(g, 'shelf')) === cap0 * 1.5);
  const before = g.cash;
  g.buyUpgrade(1, 'deep');
  check('upgrades', 'buying an owned upgrade again is refused', g.cash === before);
  g.buyUpgrade(1, 'express');
  check('upgrades', 'Express supplier shortens delivery', g.deliveryDelay() < 2);
  for (let i = 0; i < 4; i++) g.buyUpgrade(1, 'cashier');
  check('upgrades', 'cashier can be hired three times, not four', g.upgrades.cashier === 3 && g.staff.filter(s => s.k === 'cashier').length === 3);
  const c3 = g.cash; g.buyUpgrade(1, '__proto__'); g.buyUpgrade(1, 'toString');
  check('upgrades', 'bogus upgrade keys are ignored (no NaN cash)', g.cash === c3 && Number.isFinite(g.cash));
  g.cash = 5; g.buyUpgrade(1, 'ads');
  check('upgrades', 'upgrades need the cash', !g.upgrades.ads);
  const g3 = new Game(); g3.addPlayer(1, 'x'); g3.cash = 1e5;
  g3.buyUpgrade(1, 'deep');
  check('upgrades', 'some upgrades need a bigger store first', !g3.upgrades.deep);
}

// ------------------------------------------------------------------ hired staff
{
  const g = new Game();
  g.addPlayer(1, 'Owner');
  g.cash = 100000;
  g.buyUpgrade(1, 'stocker');
  const bread = pidOf('Bread Loaf');
  g.boxes.push({ id: 900, pid: bread, units: 10, x: 6.5, y: 6.5, held: null });
  run(g, 60);
  const stocked = g.fixtures.find(f => f.pid === bread);
  check('staff', 'stock clerk carries a box to a shelf and fills it', stocked && stocked.qty === 10 && !g.boxes.some(b => b.id === 900), stocked ? `qty=${stocked.qty}` : 'none');

  g.buyUpgrade(1, 'cashier');
  const cola = pidOf('Cola Can');
  fixOf(g, 'shelf', 3).pid = cola; fixOf(g, 'shelf', 3).qty = 24;
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9;
  g.spawnCustomer();
  const c = g.customers[0];
  c.want = [cola]; c.thief = false; c.patience = 999;
  run(g, 100);
  check('staff', 'hired cashier serves a shopper on their own', g.ledger.served === 1 && g.ledger.revenue > 0, `served=${g.ledger.served}`);
  const npcTill = g.checkouts.find(k => k.npc !== null);
  const p = g.players.get(1);
  p.x = npcTill.clerk.x; p.y = npcTill.clerk.y;
  g.update(0.05);
  check('staff', 'cashier hands the till over when a player steps on', npcTill.manned === 1 && npcTill.npc === null);
}

// ------------------------------------------------------------------ day cycle, weather, wages, save/load
{
  const tmp = path.join(os.tmpdir(), `mm-test-${process.pid}.json`);
  const g = new Game({ savePath: tmp });
  const p = g.addPlayer(1, 'Closer');
  g.upgrades.cashier = 1;
  p.stats.stocked = 12;
  g.setReady(1);
  check('day', 'Enter opens the store', g.phase === 'open' && g.clock() === 8 * 60);
  run(g, 60, 0.1);
  check('day', 'store clock moves through the day', g.clock() > 8 * 60 && g.clock() < 22 * 60, String(g.clock()));
  check('day', 'shoppers arrive while open', g.ledger.served + g.customers.length + g.ledger.missed > 0 || g.customers.length > 0);
  run(g, 61 + 31, 0.1);
  check('day', 'day closes to a summary', g.phase === 'summary' && g.summary && g.summary.day === 1);
  check('day', 'rent and wages are charged', g.summary.rent === STORE_LEVELS[1].rent + 25 && g.summary.wages === 350, `rent=${g.summary.rent}`);
  check('day', 'summary names the employee of the day', g.summary.mvp === 'Closer' && g.summary.crew.length === 1);
  check('day', 'weather is rolled for tomorrow', ['normal', 'rain', 'festival', 'heatwave'].includes(g.weather));
  check('day', 'player stats are banked into lifetime stats', g.career.Closer && g.career.Closer.stocked === 12 && p.stats.stocked === 0);
  g.setReady(1);
  check('day', 'Enter on the summary returns to prep for day 2', g.phase === 'prep' && g.day === 2);
  check('save', 'save file is written at closing', fs.existsSync(tmp));

  const sid = fixOf(g, 'shelf').id;
  g.fixtures[sid].pid = pidOf('Rice 1kg'); g.fixtures[sid].qty = 7;
  g.prices[3] = 33; g.lvl = 4; g.licenses.frozen = 1; g.servedTotal = 77; g.upgrades.cardpos = 1; g.cash = 4321;
  g.save();
  const h = new Game({ savePath: tmp });
  check('save', 'reload restores day, cash, prices, shelves, level, licences, upgrades', h.day === 2 && h.cash === 4321 && h.prices[3] === 33 &&
    h.fixtures[sid].qty === 7 && h.lvl === 4 && h.licenses.frozen && h.servedTotal === 77 && h.upgrades.cardpos === 1 && h.map[10][41] === '.' && h.map[20][27] === '.');
  check('save', 'reload restores hired staff', h.staff.filter(s => s.k === 'cashier').length === 1);
  fs.writeFileSync(tmp, '{not json');
  const k = new Game({ savePath: tmp });
  check('save', 'a corrupt save file is ignored, not fatal', k.day === 1);
  fs.unlinkSync(tmp);
}

// ------------------------------------------------------------------ chat + prompts + snapshot
{
  const g = new Game();
  g.addPlayer(1, 'Talker');
  g.chat(1, '  hello <script>  ');
  const ev = g.events.find(e => e.kind === 'chat');
  check('chat', 'chat is broadcast and cleaned', ev && ev.msg === 'hello script' && ev.from === 'Talker', ev && ev.msg);
  g.chat(1, 'spam');
  check('chat', 'chat is rate limited', g.events.filter(e => e.kind === 'chat').length === 1);
  check('chat', 'speech bubble text is set', g.players.get(1).say === 'hello script');
  const p = g.players.get(1);
  p.x = 12.5; p.y = 13.5; p.yaw = 90;
  check('prompts', 'order terminal prompt opens the order panel', g.promptFor(1).open === 'order');
  const snap = JSON.stringify(g.snapshot());
  check('net', 'snapshot is compact', snap.length < 12000, snap.length + ' bytes');
  const st = g.staticState();
  check('net', 'static state lists 87 fixtures, 6 tills and 4 store levels', st.fixtures.length === 87 && st.checkouts.length === 6 && st.levels.length === 5);
}

// ------------------------------------------------------------------ expiry + waste bin
{
  const g = new Game();
  const p = g.addPlayer(1, 'Fresh');
  const bread = pidOf('Bread Loaf');
  g.boxes.push({ id: 700, pid: bread, units: 10, x: 6.5, y: 6.5, held: null, life: PRODUCTS[bread].life });
  check('expiry', 'perishables carry a shelf life', PRODUCTS[bread].life === 2 && !PRODUCTS[pidOf('Cola Can')].life);
  const shelf = fixOf(g, 'shelf', 0);
  giveBox(g, p, bread, 10); p.box.life = 2;
  faceFix(p, shelf); g.act(1);
  check('expiry', 'stocked fixture inherits the box shelf life', shelf.life === 2);
  check('expiry', 'prompt shows days left', /2 days left/.test(g.promptFor(1).label), g.promptFor(1).label);
  g.closeDay(); g.setReady(1);
  check('expiry', 'a night ages stock by one day', shelf.life === 1 && g.boxes.find(b => b.id === 700).life === 1);
  g.closeDay(); g.setReady(1);
  check('expiry', 'stock expires at zero (and never goes negative)', shelf.life === 0 && g.boxes.find(b => b.id === 700).life === 0);
  g.closeDay(); g.setReady(1);
  check('expiry', 'expired stays at zero', shelf.life === 0);
  check('expiry', 'expired fixture prompt warns and offers R', /EXPIRED/.test(g.promptFor(1).label) && g.promptFor(1).bad);
  // a shopper refuses expired stock
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9; g.spawnCustomer();
  const c = g.customers[0]; c.want = [bread]; c.thief = false;
  const rep0 = g.rep;
  run(g, 60);
  check('expiry', 'shoppers will not buy expired stock', shelf.qty === 10 && g.rep < rep0);
  g.pull(1);
  check('expiry', 'R clears expired stock straight to waste', shelf.qty === 0 && !p.box && g.ledger.waste === 10 * PRODUCTS[bread].cost);
  // expired box can't be stocked, but can be binned
  const old = g.boxes.find(b => b.id === 700);
  g.boxes.splice(g.boxes.indexOf(old), 1); old.held = 1; p.box = old;
  faceFix(p, fixOf(g, 'shelf', 1));
  check('expiry', 'an expired box is refused by fixtures', g.promptFor(1).bad && /expired/i.test(g.promptFor(1).label));
  const bin = g.staticState().bin;
  p.x = bin.x + 0.5; p.y = bin.y - 0.8; p.yaw = 0;
  check('expiry', 'prompt offers the waste bin', /Throw away/.test(g.promptFor(1).label), g.promptFor(1).label);
  const w0 = g.ledger.waste;
  g.act(1);
  check('expiry', 'binning removes the box and books the waste', !p.box && g.ledger.waste > w0);
  const g2 = new Game(); g2.cash = 1e5; g2.addPlayer(1, 'x'); g2.upgrades.stocker = 1; g2.syncStaff();
  g2.boxes.push({ id: 1, pid: bread, units: 5, x: 6.5, y: 6.5, held: null, life: 0 });
  run(g2, 20);
  check('expiry', 'stock clerks leave expired boxes alone', g2.boxes.some(b => b.id === 1) && !g2.fixtures.some(f => f.pid === bread));
}

// ------------------------------------------------------------------ promotions
{
  const g = new Game();
  g.addPlayer(1, 'Promo');
  const cola = pidOf('Cola Can'), chips = pidOf('Chips Pack');
  fixOf(g, 'shelf', 0).pid = cola; fixOf(g, 'shelf', 0).qty = 24;
  fixOf(g, 'shelf', 1).pid = chips; fixOf(g, 'shelf', 1).qty = 24;
  for (const pid of [0, 1, 3, 4]) g.setPromo(1, pid, true);
  check('promos', 'at most 3 promotions at a time', g.promos.length === 3);
  g.promos = [];
  g.setPromo(1, cola, true);
  g.prices[cola] = PRODUCTS[cola].base * 2;
  check('promos', 'a promotion has no pull above the expected price', !g.promoActive(cola));
  g.prices[cola] = PRODUCTS[cola].base;
  check('promos', 'a promotion is active at or below the expected price', g.promoActive(cola));
  let a = 0, b = 0;
  for (let i = 0; i < 3000; i++) { g.spawnCustomer(); const c = g.customers.pop(); if (c.want[0] === cola) a++; if (c.want[0] === chips) b++; }
  check('promos', 'promoted products are wanted far more often', a > b * 1.6, `promo ${a} vs ${b}`);
  g.setPromo(1, cola, false);
  check('promos', 'promotions can be removed', g.promos.length === 0);
}

// ------------------------------------------------------------------ daily goals
{
  const g = new Game();
  const p = g.addPlayer(1, 'Goals');
  check('goals', 'three goals are set for each day', g.goals.length === 3 && g.goals.every(x => x.t && x.reward > 0));
  g.goals = [{ k: 'serve', t: 'Serve 1', n: 1, reward: 500 }, { k: 'nothief', t: 'No thief', n: 0, reward: 500 }, { k: 'revenue', t: 'Sales', n: 999999, reward: 500 }];
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9;
  g.ledger.served = 1;
  const snapGoals = g.snapshot().gl;
  check('goals', 'goal progress is sent live', snapGoals[0].done && snapGoals[1].done && !snapGoals[2].done);
  const cash0 = g.cash;
  g.closeDay();
  const rent = g.summary.rent;
  check('goals', 'completed goals pay their bonus at closing', g.summary.bonus === 1000 && g.cash === cash0 - rent + 1000, `bonus=${g.summary.bonus}`);
  check('goals', 'receipt lists each goal with its result', g.summary.goals.length === 3 && g.summary.goals.filter(x => x.done).length === 2);
  g.setReady(1);
  check('goals', 'new goals are rolled for the next day', g.goals.length === 3 && g.goals[0].t !== 'Serve 1');
}

// ------------------------------------------------------------------ loyalty club
{
  const g = new Game();
  g.addPlayer(1, 'Club');
  g.loyal = 60;
  let members = 0;
  for (let i = 0; i < 1000; i++) { g.spawnCustomer(); if (g.customers.pop().member) members++; }
  check('loyalty', 'members show up once the club has people in it', members > 300 && members < 700, `${members / 10}%`);
  const g2 = new Game(); g2.addPlayer(1, 'x');
  const cola = pidOf('Cola Can');
  fixOf(g2, 'shelf', 0).pid = cola; fixOf(g2, 'shelf', 0).qty = 24;
  const co = g2.checkouts[0]; const pl = g2.players.get(1); pl.x = co.clerk.x; pl.y = co.clerk.y;
  g2.openStore(); g2.spawnCd = 1e9; g2.spillCd = 1e9;
  g2.update(0.01);
  let joined = 0;
  for (let i = 0; i < 60; i++) {
    g2.spawnCustomer(); const c = g2.customers[g2.customers.length - 1];
    c.want = [cola]; c.thief = false; c.patience = 999; c.member = false; c.items = [{ pid: cola, qty: 1 }];
    c.state = 'queue'; c.co = co; co.queue = [c]; co.active = c; co.scanned = 1; co.scanCd = 0; co.stage = 'total';
    g2.scan(1);
    g2.giveChange(1, co.pay.due);
    if (co.active) { co.scanCd = 0; g2.scan(1); }
    g2.customers = [];
  }
  joined = g2.loyal;
  check('loyalty', 'happy shoppers sign up to the loyalty club', joined > 0 && joined < 30, `${joined} of 60`);
}

// ------------------------------------------------------------------ restock alerts
{
  const g = new Game();
  g.addPlayer(1, 'Alert');
  const f = fixOf(g, 'shelf', 0);
  f.pid = pidOf('Cola Can'); f.qty = 5;
  g.events = [];
  g.stockAlert(f);
  check('alerts', 'low stock warns the crew', g.events.some(e => e.kind === 'warn' && /Running low/.test(e.msg)));
  g.events = []; g.stockAlert(f);
  check('alerts', 'the warning is not repeated', g.events.length === 0);
  f.qty = 0; g.stockAlert(f);
  check('alerts', 'sold out warns the crew', g.events.some(e => /Sold out/.test(e.msg)));
  g.stockInto(f, { pid: f.pid, units: 24, life: null });
  f.qty = 4; g.events = []; g.stockAlert(f);
  check('alerts', 'restocking re-arms the warning', g.events.some(e => /Running low/.test(e.msg)));
}

// ------------------------------------------------------------------ player collision
{
  const g = new Game();
  const a = g.addPlayer(1, 'A'), b = g.addPlayer(2, 'B');
  a.x = b.x = 21.0; a.y = b.y = 22.5;
  g.update(1 / 30); g.update(1 / 30);
  check('collision', 'players standing on each other get pushed apart', Math.hypot(a.x - b.x, a.y - b.y) >= 0.6, Math.hypot(a.x - b.x, a.y - b.y).toFixed(2));
  check('collision', 'pushing never shoves a player into a wall', g.freeAt(a.x, a.y) && g.freeAt(b.x, b.y));
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9; g.spawnCustomer();
  const c = g.customers[0]; c.x = 21.0; c.y = 25.0; c.state = 'wait'; c.t = 99; c.waitAt = { x: 21.0, y: 25.0 }; c.path = null;
  a.x = 21.1; a.y = 25.0;
  g.update(1 / 30);
  check('collision', 'players step round shoppers', Math.hypot(a.x - c.x, a.y - c.y) >= 0.5);
}

// ------------------------------------------------------------------ save format v3
{
  const tmp = path.join(os.tmpdir(), `mm-v3-${process.pid}.json`);
  const g = new Game({ savePath: tmp });
  g.promos = [2, 3]; g.loyal = 42;
  const fr = fixOf(g, 'fridge');
  fr.pid = pidOf('Milk Packet'); fr.qty = 3; fr.life = 1;
  g.boxes.push({ id: 5, pid: pidOf('Bananas'), units: 4, x: 6.5, y: 6.5, held: null, life: 2 });
  g.save();
  const h = new Game({ savePath: tmp });
  check('save', 'promotions, loyalty and freshness survive a restart',
    h.promos.join() === '2,3' && h.loyal === 42 && h.fixtures[fr.id].life === 1 && h.boxes.some(b => b.pid === pidOf('Bananas') && b.life === 2));
  fs.unlinkSync(tmp);
}

// ------------------------------------------------------------------ old saves (before store levels) are migrated
{
  const tmp = path.join(os.tmpdir(), `mm-v3old-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ v: 3, day: 9, cash: 12345, rep: 61, prices: [], upgrades: { wing: 1, freezer: 1, cashier: 2, till3: 1 },
    fixtures: [[2, 10, null], [null, 0, null], [16, 5, 2]], boxes: [{ pid: 3, units: 6, x: 6.5, y: 6.5, life: null }] }));
  const h = new Game({ savePath: tmp });
  check('save', 'an old east-wing save becomes a level 4 superstore', h.lvl === 4 && h.licenses.premium && h.licenses.frozen && h.upgrades.cashier === 2 &&
    !h.upgrades.wing && h.map[10][41] === '.' && h.servedTotal >= STORE_LEVELS[4].served);
  check('save', 'old shelf stock comes back as boxes in storage', h.boxes.some(b => b.pid === 2 && b.units === 10) && h.boxes.some(b => b.pid === 16 && b.life === 2) &&
    h.boxes.some(b => b.pid === 3 && b.units === 6) && h.boxes.every(b => b.x < 14));
  fs.unlinkSync(tmp);
}

// ------------------------------------------------------------------ regressions from the code review
{
  // price is agreed at the shelf: raising it afterwards doesn't change the bill
  const g = new Game(); const p = g.addPlayer(1, 'R');
  const cola = pidOf('Cola Can'); const shelf = fixOf(g, 'shelf'); shelf.pid = cola; shelf.qty = 24;
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9; g.spawnCustomer();
  const c = g.customers[0]; c.want = [cola]; c.thief = false; c.patience = 999;
  let t = 0; while (!c.items.length && t < 60) { g.update(1 / 30); t += 1 / 30; }
  const paid = c.items[0].price; g.setPrice(1, cola, 9999);
  check('review', 'raising a price after pickup does not change the bill', paid === PRODUCTS[cola].base && g.billTotal(c) === c.items[0].qty * paid);
  g.setPrice(1, cola, 'abc'); g.setPrice(1, cola, NaN);
  check('review', 'non-numeric prices are ignored', g.prices[cola] === 9999);
}
{
  // a shopper abandoned at an unstaffed till mid-scan gives up instead of blocking it all day
  const g = new Game(); const p = g.addPlayer(1, 'R');
  const cola = pidOf('Cola Can'); fixOf(g, 'shelf').pid = cola; fixOf(g, 'shelf').qty = 24;
  const co = g.checkouts[0]; p.x = co.clerk.x; p.y = co.clerk.y;
  g.openStore(); g.spawnCd = 1e9; g.spillCd = 1e9; g.spawnCustomer();
  const c = g.customers[0]; c.want = [cola]; c.thief = false; c.patience = 999;
  let t = 0; while (!co.active && t < 90) { g.update(1 / 30); t += 1 / 30; }
  g.scan(1); p.x = 8.5; p.y = 16.5; c.patience = 3;
  for (let i = 0; i < 300; i++) g.update(1 / 30);
  check('review', 'a half-scanned shopper at an empty till eventually walks out', co.active !== c && c.state === 'leave', `state=${c.state}`);
}
{
  // expired stock blocks restocking (by players and stock clerks)
  const g = new Game(); const p = g.addPlayer(1, 'R');
  const milk = pidOf('Milk Packet'), fr = fixOf(g, 'fridge');
  fr.pid = milk; fr.qty = 2; fr.life = 0;
  check('review', 'stock clerks will not top up an expired fixture', !g.fixtureFits(fr, milk));
  giveBox(g, p, milk); p.box.life = 3; faceFix(p, fr);
  check('review', 'players are told to clear expired stock first', g.promptFor(1).bad && /clear it/.test(g.promptFor(1).label), g.promptFor(1).label);
}
{
  const tmp = path.join(os.tmpdir(), `mm-rev-${process.pid}.json`);
  const g = new Game({ savePath: tmp }); const p = g.addPlayer(1, 'Holder');
  g.order(1, pidOf('Cola Can'), 3); giveBox(g, p, pidOf('Rice 1kg'), 7); g.rep = 0;
  g.save();
  const h = new Game({ savePath: tmp });
  check('review', 'deliveries on the truck survive a save', h.pending.length === 3);
  check('review', 'a box in someone\'s hands survives a save', h.boxes.some(b => b.pid === pidOf('Rice 1kg') && b.units === 7));
  check('review', 'reputation 0 loads as 0, not 50', h.rep === 0);
  fs.unlinkSync(tmp);
  const k = new Game(); const q = k.addPlayer(1, '__proto__'); q.stats.served = 3; k.removePlayer(1);
  check('review', 'a player called __proto__ cannot pollute objects', ({}).served === undefined && k.career['__proto__'].served === 3);
  const m = new Game(); m.addPlayer(1, 'Box'); m.cash = 1e7;
  for (let i = 0; i < 20; i++) { m.order(1, 2, 20); m.update(30); }
  check('review', 'loose boxes are capped so a reload never cuts them off', m.boxes.length + m.pending.length <= 240, String(m.boxes.length));
}
{
  // hired cashiers stay on their till when a player walks past another one
  const g = new Game(); const p = g.addPlayer(1, 'Walker'); g.lvl = 2; g.openPartitions();
  g.upgrades.cashier = 2; g.syncStaff(); g.update(1 / 30);
  const before = g.staff.filter(s => s.k === 'cashier').map(s => s.till).join();
  const spare = g.checkouts.find(c => g.tillActive(c) && c.npc === null);
  p.x = spare.clerk.x; p.y = spare.clerk.y; g.update(1 / 30);
  const after = g.staff.filter(s => s.k === 'cashier').map(s => s.till).join();
  check('review', 'cashiers keep their tills when a player takes a free one', before === after, `${before} -> ${after}`);
}

// ------------------------------------------------------------------ prop collision (plants, baskets, bench)
{
  const g = new Game(); const p = g.addPlayer(1, 'Bump');
  const st = g.staticState();
  const palm = st.props.find(q => q.k === 'palm');
  check('physics', 'props are sent to clients with collision circles', st.props.length > 10 && st.colliders.length >= st.props.length);
  check('physics', 'you cannot stand inside a potted plant', !g.freeAt(palm.x, palm.y));
  p.x = palm.x; p.y = palm.y - 1.5; g.setInput(1, { mx: 0, mz: 1, yaw: 0 });
  for (let i = 0; i < 90; i++) g.update(1 / 30);
  let blocked = 0;
  for (let L = 1; L <= 4; L++) {
    g.lvl = L; g.openPartitions();
    const goals = [...g.fixtures.filter(f => g.fixtureActive(f)).map(f => [f.face.x, f.face.y]), ...g.checkouts.filter(c => g.tillActive(c)).map(c => [c.clerk.x, c.clerk.y]), [24, 38]];
    for (const [gx, gy] of goals) for (const w of g.findPath(8.5, 16.5, gx, gy) || []) for (const c of st.colliders) if (Math.hypot(w.x - c.x, w.y - c.y) < c.r + 0.33) blocked++;
  }
  g.lvl = 1; g.openPartitions();
  check('physics', 'no plant or basket stands on a walking route (all levels)', blocked === 0, `${blocked} blocked`);
  check('physics', 'walking into a plant stops you at its edge', Math.hypot(p.x - palm.x, p.y - palm.y) >= palm.r + 0.32, Math.hypot(p.x - palm.x, p.y - palm.y).toFixed(2));
}

// ------------------------------------------------------------------ pathing sanity over the whole map
{
  const g = new Game();
  let bad = 0;
  for (const f of g.fixtures) if (!g.findPath(24, 39.5, f.face.x, f.face.y) === (f.lvl === 1)) bad++;
  check('pathing', 'only the corner shop is reachable on day one', bad === 0, `${bad} wrong`);
  g.lvl = 4; g.openPartitions();
  bad = 0;
  for (const f of g.fixtures) if (!g.findPath(24, 39.5, f.face.x, f.face.y)) bad++;
  for (const c of g.checkouts) { if (!g.findPath(24, 39.5, c.cx, c.cy - 1.8)) bad++; if (!g.findPath(8.5, 16.5, c.clerk.x, c.clerk.y)) bad++; }
  check('pathing', 'at the top level every fixture, queue and till is reachable', bad === 0, `${bad} unreachable`);

}

console.log('');
console.log(fails === 0 ? `ALL ${passes} CHECKS PASSED` : `${fails} CHECK(S) FAILED, ${passes} passed`);
if (process.env.MM_REPORT) fs.writeFileSync(process.env.MM_REPORT, JSON.stringify(results, null, 1));
process.exit(fails ? 1 : 0);
