'use strict';
/*
 * MiniMart Mayhem - LAN game server.
 * Zero dependencies: plain Node http + a small RFC6455 WebSocket implementation.
 *   node server.js [port]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { Game } = require('./game');

const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
const PUBLIC = path.join(__dirname, 'public');
const SIM_HZ = 30;
const SNAP_EVERY = 2;              // broadcast every 2nd tick -> 15 Hz

// ------------------------------------------------------------ static files
// Files are read once, gzipped once, and served with an ETag so a returning
// browser downloads nothing. three.module.js goes from 690 KB to ~170 KB on the wire.

const zlib = require('zlib');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};
const fileCache = new Map();

function loadStatic(file) {
  const st = fs.statSync(file);
  const hit = fileCache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit;
  const raw = fs.readFileSync(file);
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const compressible = /text|javascript|json|svg/.test(type);
  const entry = {
    mtime: st.mtimeMs, type, raw,
    gz: compressible && raw.length > 1024 ? zlib.gzipSync(raw, { level: 9 }) : null,
    etag: '"' + crypto.createHash('sha1').update(raw).digest('base64').slice(0, 16) + '"',
  };
  fileCache.set(file, entry);
  return entry;
}

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400).end(); return; }
  if (url === '/ping') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('ok'); return; }
  if (url === '/') url = '/index.html';
  const file = path.join(PUBLIC, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403).end('forbidden'); return; }
  let e;
  try { e = loadStatic(file); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
  const headers = {
    'Content-Type': e.type, 'ETag': e.etag, 'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  };
  if (req.headers['if-none-match'] === e.etag) { res.writeHead(304, headers).end(); return; }
  const gz = e.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gz) { headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding'; }
  res.writeHead(200, headers);
  res.end(gz ? e.gz : e.raw);
});

// ------------------------------------------------------------ websocket

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 16 * 1024;     // game messages are tiny (the server ignores anything over 4 KB anyway)

class WSConn extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frag = [];
    this.fragBytes = 0;
    this.fragOp = 0;
    this.open = true;
    this.ctlN = 0; this.ctlT = Date.now();     // control frames per second (pings)
    socket.setNoDelay(true);
    socket.on('data', d => this._data(d));
    socket.on('close', () => this._close());
    socket.on('error', () => this._close());
  }

  _close() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }

  _data(chunk) {
    if (!this.open) return;
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    if (this.buf.length > MAX_FRAME + 16) { this.kill(); return; }   // nobody legitimate sends this much unread
    for (;;) {
      const f = this._frame();
      if (!f) break;
      this._handle(f);
      if (!this.open) break;
    }
  }

  _frame() {
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) { if (b.length < off + 2) return null; len = b.readUInt16BE(off); off += 2; }
    else if (len === 127) {
      if (b.length < off + 8) return null;
      const big = b.readBigUInt64BE(off);
      if (big > BigInt(MAX_FRAME)) { this.kill(); return null; }
      len = Number(big); off += 8;
    }
    if (len > MAX_FRAME || !masked) { this.kill(); return null; }       // clients must mask (RFC 6455 5.1)
    let mask = null;
    if (masked) { if (b.length < off + 4) return null; mask = b.subarray(off, off + 4); off += 4; }
    if (b.length < off + len) return null;
    let payload = Buffer.from(b.subarray(off, off + len));
    if (masked) for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
    this.buf = b.subarray(off + len);
    return { fin, opcode, payload };
  }

  _handle(f) {
    if (f.opcode >= 0x8) {
      // control frames don't go through the game's flood guard, so rate-limit them here
      const now = Date.now();
      if (now - this.ctlT > 1000) { this.ctlT = now; this.ctlN = 0; }
      if (++this.ctlN > 20) { this.kill(); return; }
    }
    if (f.opcode === 0x8) { this.close(1000); return; }
    if (f.opcode === 0x9) { if (this.socket.writableLength < 64 * 1024) this._send(0xA, f.payload.subarray(0, 125)); return; }
    if (f.opcode === 0xA) return;
    if (f.opcode === 0x0) {
      if (!this.fragOp) { this.kill(); return; }                     // continuation without a start
      this.frag.push(f.payload);
      this.fragBytes += f.payload.length;
      if (this.fragBytes > MAX_FRAME || this.frag.length > 64) { this.kill(); return; }
      if (!f.fin) return;
      const full = Buffer.concat(this.frag);
      const op = this.fragOp; this.frag = []; this.fragBytes = 0; this.fragOp = 0;
      if (op === 0x1) this.emit('message', full.toString('utf8'));
      return;
    }
    if (!f.fin) { this.fragOp = f.opcode; this.frag = [f.payload]; this.fragBytes = f.payload.length; return; }
    if (f.opcode === 0x1) this.emit('message', f.payload.toString('utf8'));
  }

  _send(opcode, payload) {
    if (!this.open || this.socket.destroyed) return;
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.allocUnsafe(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.allocUnsafe(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.allocUnsafe(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | opcode;
    try { this.socket.write(Buffer.concat([head, payload])); } catch { this._close(); }
  }

  // true while a slow client still has unread data queued: new snapshots would only pile up behind
  // stale ones (and arrive seconds late), so the game loop skips this client until it catches up
  backedUp() { return this.socket.writableLength > 24 * 1024; }

  send(str) {
    if (this.socket.writableLength > 512 * 1024) return;   // hard cap for one-off messages
    this._send(0x1, Buffer.from(str, 'utf8'));
  }

  // drop an abusive or broken connection immediately (no polite close handshake)
  kill() {
    this.buf = Buffer.alloc(0); this.frag = [];
    try { this.socket.destroy(); } catch { /* already gone */ }
    this._close();
  }

  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.allocUnsafe(2); b.writeUInt16BE(code, 0);
    this._send(0x8, b);
    try { this.socket.end(); } catch { /* ignore */ }
    this._close();
  }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.destroy(); return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  attach(new WSConn(socket));
});


// ------------------------------------------------------------ game wiring

const { MAX_PLAYERS } = require('./game');
// Saves live in saves/slot1.json .. slot3.json. MM_SAVE=off disables saving,
// MM_FRESH=1 ignores what's there, MM_PASS=secret makes the shop password-protected.
const SAVE_DIR = process.env.MM_SAVE_DIR || path.join(__dirname, 'saves');
const SAVING = !process.env.MM_DEMO && process.env.MM_SAVE !== 'off';
const PASS = process.env.MM_PASS || '';
const SLOTS = 3;
let slot = 1;
try { slot = Math.min(SLOTS, Math.max(1, parseInt(fs.readFileSync(path.join(SAVE_DIR, 'current'), 'utf8'), 10) || 1)); } catch { /* first run */ }
const slotPath = n => (SAVING ? (process.env.MM_SAVE && process.env.MM_SAVE !== 'off' && n === 1 ? process.env.MM_SAVE : path.join(SAVE_DIR, `slot${n}.json`)) : null);
if (SAVING) fs.mkdirSync(SAVE_DIR, { recursive: true });

let game = new Game({ savePath: slotPath(slot), fresh: !!process.env.MM_FRESH });   // MM_FRESH only affects the first boot
const clients = new Map();          // id -> { conn, joined, seq, mapVer, name, rate }
let nextClientId = 1, joinSeq = 0;

// MM_DEMO=1 boots straight into a stocked, open store (used for screenshots/testing)
function demoSetup() {
  const { PRODUCTS } = require('./game');
  game.upgrades = { cardpos: 1, cashier: 1, stocker: 1 };
  game.lvl = 3; game.openPartitions();
  for (const k of Object.keys(require('./game').LICENSES)) game.licenses[k] = 1;
  game.syncStaff();
  const byKind = { shelf: 'dry', fridge: 'chilled', freezer: 'frozen', produce: 'produce' };
  game.fixtures.forEach((f, i) => {
    if (!game.fixtureActive(f) || i % 5 === 4) return;
    const pool = PRODUCTS.filter(p => p.kind === byKind[f.kind] && game.licensed(p.id));
    const pid = pool[i % pool.length].id;
    f.pid = pid; f.qty = 8 + (i * 7) % (game.capOf(f) - 7); f.life = PRODUCTS[pid].life || null;
  });
  [[2, 24], [16, 12], [26, 10], [9, 8]].forEach(([pid, units], k) =>
    game.boxes.push({ id: 9001 + k, pid, units, x: 4.5 + k, y: 4.5, held: null, life: PRODUCTS[pid].life || null }));
  game.promos = [2];
  game.openStore();
  for (let i = 0; i < 12; i++) game.spawnCustomer();
}
if (process.env.MM_DEMO) demoSetup();

// the host is whoever has been in the shop longest; only they can switch save slots or reset
function hostId() {
  let best = null;
  for (const [id, cl] of clients) if (cl.joined && (!best || cl.seq < clients.get(best).seq)) best = id;
  return best;
}

function slotInfo() {
  const out = [];
  for (let n = 1; n <= SLOTS; n++) {
    let info = { n, empty: true };
    const p = slotPath(n);
    if (p) try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); info = { n, empty: false, day: d.day, cash: Math.round(d.cash) }; } catch { /* empty */ }
    out.push(info);
  }
  return { slots: out, current: slot, saving: SAVING };
}

// swap the running game for another slot (or a fresh one) and make everyone reconnect
function switchGame(n, fresh) {
  game.save();
  slot = n;
  if (SAVING) { try { fs.writeFileSync(path.join(SAVE_DIR, 'current'), String(n)); } catch { /* read-only disk */ } }
  if (fresh && slotPath(n)) { try { fs.unlinkSync(slotPath(n)); } catch { /* nothing to delete */ } }
  game = new Game({ savePath: slotPath(n), fresh: !!fresh });
  for (const [, cl] of clients) { cl.conn.send(JSON.stringify({ t: 'reload' })); cl.conn.close(1000); }
  clients.clear();
}

function attach(conn) {
  const id = nextClientId++;
  clients.set(id, { conn, joined: false, rate: 0, rateT: Date.now() });

  conn.on('message', (raw) => {
    const cl = clients.get(id);
    if (!cl) return;
    // flood guard: a normal client sends ~10 messages a second
    const now = Date.now();
    if (now - cl.rateT > 1000) { cl.rateT = now; cl.rate = 0; }
    if (++cl.rate > 120) { if (cl.rate > 400) conn.close(1008); return; }
    if (raw.length > 4096) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (!cl.joined && m.t !== 'join') return;

    switch (m.t) {
      case 'join': {
        if (cl.joined) break;
        if (PASS && m.pass !== PASS) { conn.send(JSON.stringify({ t: 'denied', reason: m.pass ? 'Wrong room password.' : 'This shop needs a room password.' })); conn.close(1000); clients.delete(id); break; }
        const p = game.addPlayer(id, typeof m.name === 'string' ? m.name : 'Clerk');
        if (!p) { conn.send(JSON.stringify({ t: 'full', max: MAX_PLAYERS })); conn.close(1000); clients.delete(id); break; }
        cl.joined = true; cl.seq = joinSeq++; cl.mapVer = game.mapVer; cl.acks = m.acks === true; cl.acked = 0; cl.sq = 0;
        conn.send(JSON.stringify({ t: 'welcome', id, world: game.staticState() }));
        break;
      }
      case 'input':  game.setInput(id, m); break;
      case 'ack':    cl.acks = true; cl.acked = Math.min(cl.sq || 0, Math.max(cl.acked || 0, m.n | 0)); break;
      case 'act':    game.act(id); break;
      case 'drop':   game.drop(id); break;
      case 'scan':   game.scan(id); break;
      case 'order':  game.order(id, m.pid | 0, m.boxes | 0); break;
      case 'price':  game.setPrice(id, m.pid | 0, Number(m.price) || 0); break;
      case 'promo':  game.setPromo(id, m.pid | 0, !!m.on); break;
      case 'ready':  game.setReady(id); break;
      case 'pull':   game.pull(id); break;
      case 'buy':    game.buyUpgrade(id, m.key); break;
      case 'level':  game.buyLevel(id); break;
      case 'license': game.buyLicense(id, m.key); break;
      case 'change': game.giveChange(id, m.amt); break;
      case 'chat':   game.chat(id, m.text); break;
      case 'slots':  conn.send(JSON.stringify({ t: 'slots', ...slotInfo(), host: hostId() === id })); break;
      case 'host': {
        if (hostId() !== id) { conn.send(JSON.stringify({ t: 'slots', ...slotInfo(), host: false, err: 'Only the host can do that.' })); break; }
        const n = m.slot | 0;
        if (m.op === 'save') { game.save(); game.toast(SAVING ? `Saved to slot ${slot}` : 'Saving is switched off on this server', 'info'); conn.send(JSON.stringify({ t: 'slots', ...slotInfo(), host: true })); }
        else if (m.op === 'load' && n >= 1 && n <= SLOTS && SAVING) switchGame(n, false);
        else if (m.op === 'new' && n >= 1 && n <= SLOTS) switchGame(n, true);
        break;
      }
      case 'tp':     // screenshot/test helper, only in demo mode
        if (process.env.MM_DEMO) { const p = game.players.get(id); if (p && game.freeAt(+m.x, +m.y)) { p.x = +m.x; p.y = +m.y; } }
        break;
    }
  });

  conn.on('close', () => {
    if (clients.has(id)) { game.removePlayer(id); clients.delete(id); }
  });
}

let tick = 0;
let last = Date.now();

setInterval(() => {
  const now = Date.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;            // don't let a hiccup fast-forward the day
  game.update(dt);

  if (++tick % SNAP_EVERY === 0) {
    // serialise the shared part once; only the prompt differs per player
    const snap = game.snapshot();
    const base = JSON.stringify(snap).slice(0, -1);
    let mapMsg = null;
    const host = hostId();
    for (const [id, cl] of clients) {
      if (!cl.joined) continue;
      // flow control: a browser acknowledges each snapshot it applies; never run more than a few ahead
      // of it, or a slow / busy / background client would replay seconds of stale snapshots later
      if ((cl.acks && cl.sq - cl.acked > 4) || cl.conn.backedUp()) {
        // skip this snapshot, but keep its events (receipts, warnings, chat) for the next one
        cl.stash = (cl.stash || []).concat(snap.ev);
        if (cl.stash.length > 120) cl.stash.splice(0, cl.stash.length - 120);
        continue;
      }
      if (cl.mapVer !== game.mapVer) {
        mapMsg = mapMsg || JSON.stringify({ t: 'map', map: game.map.map(r => r.join('')), mapVer: game.mapVer });
        cl.conn.send(mapMsg);
        cl.mapVer = game.mapVer;
      }
      const xev = cl.stash && cl.stash.length ? `,"xev":${JSON.stringify(cl.stash)}` : '';
      cl.stash = null;
      cl.sq = (cl.sq || 0) + 1;
      cl.conn.send(`${base},"you":${id},"host":${id === host},"sq":${cl.sq},"prompt":${JSON.stringify(game.promptFor(id))}${xev}}`);
    }
  }
}, 1000 / SIM_HZ);

// autosave every two minutes so a crash never costs more than that
if (SAVING) setInterval(() => { if (game.phase !== 'summary') game.save(); }, 120000);

// ------------------------------------------------------------ start

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

function shutdown() {
  game.save();
  console.log('\n  Saved. Bye.');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`\n  Port ${PORT} is already in use. Try: node server.js ${PORT + 1}\n`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, process.env.MM_HOST || '0.0.0.0', () => {
  const addrs = lanAddresses();
  console.log('');
  console.log('  MiniMart Mayhem is running.');
  console.log('  ------------------------------------------');
  console.log(`  On this machine : http://localhost:${PORT}`);
  for (const a of addrs) console.log(`  On your LAN     : http://${a}:${PORT}`);
  console.log('  ------------------------------------------');
  console.log(`  Save slot ${slot}${SAVING ? '' : ' (saving off)'} · ${PASS ? 'room password ON' : 'no room password (set MM_PASS to add one)'}`);
  console.log('  Playing over the internet? See "Play over the internet" in README.md.');
  console.log('  Ctrl+C to stop (progress is saved).');
  console.log('');
});
