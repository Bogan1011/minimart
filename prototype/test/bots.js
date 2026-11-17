'use strict';
/*
 * Multiplayer smoke test over real WebSockets: bots join, order, walk, stock,
 * chat, buy an expansion, run the tills through a whole day and reconnect.
 *   MM_SAVE_DIR=/tmp/mm-test MM_FRESH=1 MM_PASS=letmein MM_DAY=75 MM_CLOSE=20 MM_DELIVERY=2 MM_CASH=40000 MM_SERVED=50 node server.js 8099 &
 *   PASS=letmein PORT=8099 node test/bots.js
 */
const PORT = process.env.PORT || 8099;
const URL = `ws://127.0.0.1:${PORT}`;
const SOLID = new Set(['#', 'G', 'L', 'X', 'P', 'S', 'F', 'Z', 'V', 'C', 'R', 'K', 'T', 'U']);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function bfs(rows, w, h, sx, sy, tx, ty) {
  const walk = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !SOLID.has(rows[y][x]);
  let g = { x: Math.floor(tx), y: Math.floor(ty) };
  if (!walk(g.x, g.y)) {
    const a = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: g.x + dx, y: g.y + dy })).find(n => walk(n.x, n.y));
    if (!a) return null; g = a;
  }
  const s = { x: Math.floor(sx), y: Math.floor(sy) };
  if (!walk(s.x, s.y)) return null;
  const prev = new Int32Array(w * h).fill(-1), seen = new Uint8Array(w * h);
  const q = [s.y * w + s.x]; seen[s.y * w + s.x] = 1;
  const goal = g.y * w + g.x; let head = 0, found = false;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) { found = true; break; }
    const cx = cur % w, cy = (cur / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, ni = ny * w + nx;
      if (!walk(nx, ny) || seen[ni]) continue;
      seen[ni] = 1; prev[ni] = cur; q.push(ni);
    }
  }
  if (!found) return null;
  const out = []; let cur = goal;
  while (cur !== -1) { out.push({ x: (cur % w) + 0.5, y: ((cur / w) | 0) + 0.5 }); cur = prev[cur]; }
  out.reverse(); out.shift(); out.push({ x: tx, y: ty });
  return out;
}

class Bot {
  constructor(name, pass = process.env.PASS || '') {
    this.name = name;
    this.events = [];
    this.ws = new WebSocket(URL);
    this.ready = new Promise((res, rej) => { this.resolve = res; this.reject = rej; });
    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'join', name, pass }));
    this.ws.onerror = e => this.reject(e);
    this.ws.onclose = () => { this.closed = true; this.resolve(); };
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { this.id = m.id; this.world = m.world; this.world.rows = m.world.map; this.resolve(); }
      else if (m.t === 'map') { this.world.rows = m.map; this.gotMap = m.mapVer; }
      else if (m.t === 'full') { this.full = true; }
      else if (m.t === 'denied') { this.denied = m.reason; }
      else if (m.t === 'reload') { this.reload = true; }
      else if (m.t === 'slots') { this.slots = m; }
      else { this.state = m; this.me = m.pl.find(p => p.id === this.id); for (const ev of m.ev || []) this.events.push(ev); }
    };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  face(x, y) { const dx = x - this.me.x, dy = y - this.me.y; this.send({ t: 'input', mx: 0, mz: 0, yaw: Math.atan2(dx, dy) * 180 / Math.PI }); }
  async walkTo(x, y, maxMs = 30000) {
    const path = bfs(this.world.rows, this.world.w, this.world.h, this.me.x, this.me.y, x, y);
    if (!path) return false;
    const t0 = Date.now();
    for (const w of path) {
      while (Math.hypot(w.x - this.me.x, w.y - this.me.y) > 0.25) {
        if (Date.now() - t0 > maxMs) { this.send({ t: 'input', mx: 0, mz: 0 }); return false; }
        const dx = w.x - this.me.x, dy = w.y - this.me.y, l = Math.hypot(dx, dy) || 1;
        this.send({ t: 'input', mx: dx / l, mz: dy / l, yaw: Math.atan2(dx, dy) * 180 / Math.PI, sp: true });
        await sleep(40);
      }
    }
    this.send({ t: 'input', mx: 0, mz: 0 });
    await sleep(120);
    return true;
  }
}

let failures = 0, passes = 0;
function check(label, cond, extra = '') {
  console.log(`${cond ? ' PASS' : ' FAIL'}  [network] ${label}${extra ? '  (' + extra + ')' : ''}`);
  cond ? passes++ : failures++;
}
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await sleep(100); return fn(); };

(async () => {
  if (process.env.PASS) {
    const bad = new Bot('Intruder', 'wrong');
    await bad.ready; await sleep(300);
    check('a wrong room password is refused', !!bad.denied && !bad.id, bad.denied);
  }
  const A = new Bot('Stocker'), B = new Bot('Cashier');
  await Promise.all([A.ready, B.ready]);
  await waitFor(() => A.state && B.state && A.state.pl.length === 2, 3000);
  check('two players connect and see each other', A.state.pl.length === 2 && B.state.pl.length === 2);
  check('welcome carries the full world', A.world.fixtures.length === 87 && A.world.products.length === 36 && A.world.levels[2].name === 'Mini Market' && !!A.world.licenses.kitchen);
  check('a new shop starts as a level 1 corner shop', A.state.lvl === 1 && A.world.rows[20][27] === 'L');

  A.send({ t: 'chat', text: 'hi team' });
  await waitFor(() => B.events.some(e => e.kind === 'chat'), 2000);
  check('chat reaches the other player', B.events.some(e => e.kind === 'chat' && e.msg === 'hi team' && e.from === 'Stocker'));

  A.send({ t: 'price', pid: 2, price: 28 });
  await waitFor(() => B.state.prices[2] === 28, 2000);
  check('price change reaches everyone', B.state.prices[2] === 28);

  const cash0 = A.state.cash;
  A.send({ t: 'order', pid: 2, boxes: 2 });
  A.send({ t: 'order', pid: 0, boxes: 1 });
  await waitFor(() => A.state.cash < cash0, 2000);
  check('ordering deducts cash', A.state.cash < cash0, `${cash0} -> ${A.state.cash}`);
  await waitFor(() => A.state.bx.length >= 3, 10000);
  check('boxes are delivered to storage', A.state.bx.length >= 3, `${A.state.bx.length} boxes`);

  let stocked = 0;
  for (let i = 0; i < 3; i++) {
    const b = A.state.bx[0];
    await A.walkTo(b.x + 0.9, b.y);
    A.face(b.x, b.y); await sleep(150);
    A.send({ t: 'act' }); await sleep(250);
    if (A.me.b < 0) continue;
    const f = A.world.fixtures.filter(x => x.kind === 'shelf' && x.lvl === 1)[i];
    await A.walkTo(f.cx, f.cy + 1.3);
    A.face(f.cx, f.cy); await sleep(150);
    A.send({ t: 'act' }); await sleep(300);
    if (A.state.sh[f.id][1] > 0) stocked++;
  }
  check('a player can carry boxes and stock shelves', stocked >= 2, `${stocked} shelves stocked`);

  A.send({ t: 'license', key: 'kitchen' });
  await waitFor(() => B.state.lic && B.state.lic.kitchen, 2000);
  check('a product licence reaches everyone', !!(B.state.lic && B.state.lic.kitchen));
  A.send({ t: 'level' });
  await waitFor(() => A.gotMap && B.gotMap, 3000);
  check('expanding to a Mini Market reaches every client with a new map', !!(A.gotMap && B.gotMap) && B.world.rows[20][27] === '.' && B.state.lvl === 2);
  check('the level-up is announced', B.events.some(e => e.lvl === 2));
  A.send({ t: 'buy', key: 'cashier' });
  await waitFor(() => (A.state.sf || []).length === 1, 2000);
  check('hired staff appear in the snapshot', (A.state.sf || []).length === 1);

  const till = B.world.checkouts[0];
  await B.walkTo(till.kx, till.ky);
  await sleep(300);
  check('standing on the pad mans the till', B.state.ck[0].m === B.id, `m=${B.state.ck[0].m}`);
  A.send({ t: 'ready' });
  await waitFor(() => A.state.ph === 'open', 2000);
  check('Enter opens the store for everyone', A.state.ph === 'open' && B.state.ph === 'open');

  let sawCustomer = false, sawActive = false, sawCash = false;
  const loop = setInterval(() => {
    const ck = B.state.ck[0];
    if (ck.st === 'cash' && ck.pay && ck.pay.due > ck.pay.g) { sawCash = true; B.send({ t: 'change', amt: ck.pay.due - ck.pay.g }); }
    else B.send({ t: 'scan' });
    if (B.state.cu.length) sawCustomer = true;
    if (ck.tot > 0) sawActive = true;
  }, 110);
  await waitFor(() => A.state.ph === 'summary', 150000);
  clearInterval(loop);
  check('shoppers arrive', sawCustomer);
  check('a shopper reaches the player till', sawActive);
  check('cash shoppers wait for their change', sawCash);
  check('the clerk gets a printed receipt', B.events.some(e => e.kind === 'receipt' && e.to === B.id && e.receipt.lines.length > 0));
  const sum = A.state.sum;
  check('the day ends in a summary for everyone', A.state.ph === 'summary' && B.state.ph === 'summary' && sum && sum.day === 1);
  check('sales were rung up', sum && sum.revenue > 0 && sum.served > 0, sum && `revenue=${sum.revenue} served=${sum.served}`);
  check('wages charged for the hired cashier', sum && sum.wages === 350);
  check('crew table lists both players', sum && sum.crew.length === 2);

  B.send({ t: 'ready' });
  await waitFor(() => A.state.ph === 'prep', 2000);
  check('continue returns everyone to prep for day 2', A.state.ph === 'prep' && A.state.day === 2);

  B.ws.close();
  await waitFor(() => A.state.pl.length === 1, 3000);
  check('a leaving player is removed', A.state.pl.length === 1);
  const C = new Bot('Rejoin');
  await C.ready;
  await waitFor(() => C.state, 2000);
  check('a late joiner gets the current map and day', C.world.map[20][27] === '.' && C.state.day === 2 && C.state.lvl === 2);

  const extra = [];
  for (let i = 0; i < 7; i++) extra.push(new Bot('X' + i));
  await Promise.all(extra.map(b => b.ready));
  await sleep(500);
  const refused = extra.filter(b => b.full).length;
  check('the 9th player is turned away', refused === 1, `${refused} refused`);
  for (const b of extra) b.ws.close();

  // host-only save slots
  C.send({ t: 'slots' }); A.send({ t: 'slots' });
  await waitFor(() => A.slots && C.slots, 2000);
  check('the longest-serving player is the host', A.slots && A.slots.host === true && C.slots.host === false);
  check('three save slots are listed', A.slots && A.slots.slots.length === 3);
  C.slots = null; C.send({ t: 'host', op: 'new', slot: 2 });
  await waitFor(() => C.slots, 2000);
  check('non-hosts cannot reset the game', C.slots && C.slots.err && A.state.day === 2);

  A.ws.send('not json'); A.send({ t: 'order', pid: 999, boxes: 'x' }); A.send({ t: 'buy', key: '__proto__' }); A.send({ t: 'price', pid: -1 });
  A.send({ t: 'license', key: 'constructor' }); A.send({ t: 'change', amt: 'lots' }); A.send({ t: 'level' });
  await sleep(400);
  check('garbage messages are ignored safely', A.ws.readyState === 1 && A.state.day === 2);

  // host starts a new game in slot 2: everyone is told to reload, then rejoins a fresh shop
  A.send({ t: 'host', op: 'new', slot: 2 });
  await waitFor(() => A.reload && C.reload && A.closed && C.closed, 3000);
  check('switching slot tells every client to reload', !!(A.reload && C.reload));
  const D = new Bot('Back');
  await D.ready; await waitFor(() => D.state, 2000);
  check('after a new game the shop is back on day 1', D.state && D.state.day === 1 && D.world.map[20][27] === 'L' && D.state.lvl === 1);
  D.send({ t: 'slots' }); await waitFor(() => D.slots, 2000);
  check('the new game runs in slot 2', D.slots && D.slots.current === 2);
  D.send({ t: 'host', op: 'load', slot: 1 });
  await waitFor(() => D.reload, 3000);
  const E = new Bot('Again');
  await E.ready; await waitFor(() => E.state, 2000);
  check('loading slot 1 brings the old shop back (day 2, Mini Market)', E.state && E.state.day === 2 && E.state.lvl === 2 && E.world.map[20][27] === '.');

  console.log('');
  console.log(failures === 0 ? `ALL ${passes} CHECKS PASSED` : `${failures} CHECK(S) FAILED, ${passes} passed`);
  E.ws.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('test crashed:', e); process.exit(1); });
