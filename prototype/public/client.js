/* MiniMart Mayhem - first-person client: input, prediction, HUD, panels, sound, minimap */
import { StoreScene, TILE } from './scene.js';

const PLAYER_R = 0.33;
const SPEED = 2.6, SPEED_SPRINT = 3.7, SPEED_CARRY = 2.0;     // must match game.js
const SOLID = new Set(['#', 'G', 'L', 'X', 'P', 'S', 'F', 'Z', 'V', 'C', 'R', 'K', 'T', 'U', 'W']);
const money = v => (v < 0 ? '−₹' : '₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KIND_LABEL = { dry: 'Dry goods', chilled: 'Chilled', frozen: 'Frozen', produce: 'Fruit & veg' };
const KIND_FIX = { dry: 'shelf', chilled: 'fridge', frozen: 'freezer', produce: 'produce' };

// ------------------------------------------------------------ settings

const store = {
  get(k, d) { try { const v = localStorage.getItem('mm.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mm.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const settings = {
  sens: store.get('sens', 1), vol: store.get('vol', 0.6), mus: store.get('mus', 0.35), quality: store.get('quality', 'medium'),
  invert: store.get('invert', false), autoRes: store.get('autoRes', true),
  fov: store.get('fov', 72), bob: store.get('bob', true),
};
const isTouch = matchMedia('(pointer: coarse)').matches;   // touchscreen laptops have a fine pointer and keep mouse controls
const touch = { mx: 0, my: 0, sprint: false };
let leaving = null;          // why the socket is closing on purpose ('reload' | 'denied' | 'full')
let wasInGame = false;

let ws = null, myId = null, world = null, state = null;
let scene = null, me = null;
let keys = {}, panel = null, locked = false, chatting = false;
let camYaw = -Math.PI / 2, camPitch = 0;
let lastSent = 0, lastSig = '', scanTimer = 0;
let orderTab = 'dry';
const orderQty = {};

// ------------------------------------------------------------ sound (synthesised, no files)

const sfx = (() => {
  let ac = null, master = null;
  const ctx = () => {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.connect(ac.destination); }
      catch { return null; }
    }
    master.gain.value = settings.vol;
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  const tone = (f, t0, dur, type = 'sine', vol = 0.2, f2 = null) => {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, a.currentTime + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol, a.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    o.connect(g); g.connect(master);
    o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.05);
  };
  const noiseBufs = new Map();     // one decaying-noise buffer per length, made once (footsteps play constantly)
  const noise = (dur, vol = 0.15, hp = 800) => {
    const a = ctx(); if (!a) return;
    let b = noiseBufs.get(dur);
    if (!b) {
      b = a.createBuffer(1, Math.max(1, Math.round(a.sampleRate * dur)), a.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      noiseBufs.set(dur, b);
    }
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start();
  };
  // ---- generative in-store music: a soft chord loop with a wandering melody
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const CHORDS = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];
  const PENTA = [72, 74, 76, 79, 81, 84];
  let musGain = null, musNext = 0, musBar = 0, ambGain = null, ambFilter = null;
  function pad(f, t, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musGain); o.start(t); o.stop(t + dur + 0.1);
  }
  function pluck(f, t, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(musGain); o.start(t); o.stop(t + 1);
  }
  function music(on, level) {
    const a = ctx(); if (!a) return;
    if (!musGain) {
      musGain = a.createGain(); const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      musGain.connect(lp); lp.connect(master); musGain.gain.value = 0;
    }
    musGain.gain.setTargetAtTime(on ? settings.mus * 0.5 * level : 0, a.currentTime, 0.6);
    if (!on || settings.mus <= 0) return;
    const beat = 60 / 88;
    if (musNext < a.currentTime) musNext = a.currentTime + 0.1;
    while (musNext < a.currentTime + 1.5) {          // schedule one bar ahead
      const ch = CHORDS[musBar % 4];
      for (const n of ch) pad(NOTE(n - 12), musNext, beat * 4, 0.05);
      pluck(NOTE(ch[0] - 24), musNext, 0.12); pluck(NOTE(ch[0] - 24), musNext + beat * 2, 0.08);
      for (let i = 0; i < 4; i++) if (Math.random() < 0.55) pluck(NOTE(PENTA[(Math.random() * PENTA.length) | 0]), musNext + i * beat + (Math.random() < 0.3 ? beat / 2 : 0), 0.05);
      musNext += beat * 4; musBar++;
    }
  }
  // ---- ambience: filtered noise; muffled air-con hum inside, brighter street noise outside
  function ambience(outside, level) {
    const a = ctx(); if (!a) return;
    if (!ambGain) {
      const len = a.sampleRate * 2, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = a.createBufferSource(); src.buffer = b; src.loop = true;
      ambFilter = a.createBiquadFilter(); ambFilter.type = 'lowpass';
      ambGain = a.createGain(); ambGain.gain.value = 0;
      src.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(master); src.start();
    }
    ambFilter.frequency.setTargetAtTime(outside ? 900 : 260, a.currentTime, 0.5);
    ambGain.gain.setTargetAtTime((outside ? 0.22 : 0.12) * level, a.currentTime, 0.5);
  }
  return {
    unlock: ctx, music, ambience,
    step: () => noise(0.05, 0.04, 2500),
    chime: () => { tone(1320, 0, 0.5, 'sine', 0.1); tone(990, 0.18, 0.7, 'sine', 0.1); },
    beep: () => tone(1850, 0, 0.07, 'square', 0.08),
    till: () => { tone(1320, 0, 0.09, 'triangle', 0.18); tone(1760, 0.08, 0.18, 'triangle', 0.18); noise(0.12, 0.05, 3000); },
    pick: () => tone(220, 0, 0.12, 'triangle', 0.18, 140),
    stock: () => { tone(500, 0, 0.05, 'square', 0.06); tone(650, 0.05, 0.05, 'square', 0.06); },
    drop: () => noise(0.15, 0.12, 300),
    alarm: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 700 : 950, i * 0.16, 0.15, 'sawtooth', 0.07); },
    caught: () => { tone(523, 0, 0.1, 'triangle', 0.2); tone(659, 0.1, 0.1, 'triangle', 0.2); tone(784, 0.2, 0.25, 'triangle', 0.2); },
    upgrade: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.16)); },
    open: () => { tone(880, 0, 0.18, 'sine', 0.2); tone(1100, 0.2, 0.3, 'sine', 0.2); },
    close: () => { tone(1100, 0, 0.18, 'sine', 0.2); tone(880, 0.2, 0.3, 'sine', 0.2); },
    truck: () => { tone(90, 0, 0.6, 'sawtooth', 0.05, 60); },
    slip: () => tone(600, 0, 0.3, 'sine', 0.15, 180),
    bad: () => tone(200, 0, 0.18, 'square', 0.06),
    mop: () => noise(0.18, 0.08, 1500),
    chat: () => tone(1200, 0, 0.06, 'sine', 0.08),
    // cash drawer: a clunk and a bell; card terminal: two short beeps; UPI: a soft "received" chime
    drawer: () => { noise(0.09, 0.14, 400); tone(2600, 0.06, 0.35, 'sine', 0.06); },
    card: () => { tone(1500, 0, 0.08, 'square', 0.05); tone(1500, 0.14, 0.08, 'square', 0.05); },
    paid: () => { tone(988, 0, 0.12, 'sine', 0.14); tone(1319, 0.11, 0.3, 'sine', 0.14); },
    coin: () => { tone(2900 + Math.random() * 400, 0, 0.09, 'triangle', 0.07); tone(4200, 0.02, 0.06, 'sine', 0.03); },
    note: () => noise(0.06, 0.06, 2200),
    levelup: () => { [523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.17)); noise(0.5, 0.05, 5000); },
  };
})();

// ------------------------------------------------------------ connection

function loading(frac, text) {
  $('#loadScreen').classList.remove('hidden');
  $('#loadStep').textContent = text;
  $('#loadBar').style.width = Math.round(frac * 100) + '%';
}

function connect(name, pass) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  loading(0.02, 'Connecting to the shop…');
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, pass: pass || '', acks: true }));   // we acknowledge snapshots (flow control)
  ws.onmessage = async ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'welcome') {
      myId = m.id;
      world = m.world;
      world.rows = world.map;
      $('#joinScreen').classList.add('hidden');
      try {
        scene = new StoreScene($('#cv'), world, settings.quality);
        await scene.build((f, t) => loading(0.05 + f * 0.95, t));
      } catch (e) {
        console.error(e);
        scene = null;
        leaving = 'webgl';
        if (ws) ws.close();
        $('#loadScreen').classList.add('hidden');
        $('#joinErr').textContent = 'This browser could not start 3D graphics (WebGL). Try Chrome or Edge with hardware acceleration on.';
        $('#joinScreen').classList.remove('hidden');
        return;
      }
      wasInGame = true;
      applyView();
      $('#loadScreen').classList.add('hidden');
      $('#game').classList.remove('hidden');
      buildOrderTabs(); buildOrderTable(); buildPriceTable(); buildUpgrades(); drawMapBase();
      if (isTouch) { document.body.classList.add('is-touch'); $('#touch').classList.remove('hidden'); }
      requestAnimationFrame(frame);
    } else if (m.t === 'reload') {
      leaving = 'reload';
    } else if (m.t === 'denied') {
      leaving = 'denied';
      $('#joinErr').textContent = m.reason;
    } else if (m.t === 'slots') {
      renderSlots(m);
    } else if (m.t === 'map') {
      world.rows = world.map = m.map; world.mapVer = m.mapVer;
      drawMapBase();
    } else if (m.t === 'full') {
      leaving = 'full';
      $('#joinErr').textContent = `The shop is full - ${m.max || 8} clerks are already on shift.`;
    } else {
      queueSnapshot(m);
    }
  };
  ws.onerror = () => { $('#joinErr').textContent = 'Could not reach the server. Check it is still running and the address is right.'; };
  ws.onclose = () => {
    ws = null;
    document.exitPointerLock && document.exitPointerLock();
    // the host switched save slots: rejoin straight away
    if (leaving === 'reload') { loading(0.02, 'The host changed the save - rejoining…'); setTimeout(rejoin, 700); return; }
    // lost the connection mid-game: keep trying for a minute
    if (wasInGame && !leaving) { reconnect(0); return; }
    $('#loadScreen').classList.add('hidden');
    if (!$('#joinErr').textContent) $('#joinErr').textContent = 'Could not join the shop.';
    $('#joinScreen').classList.remove('hidden');
    $('#game').classList.add('hidden');
    closePanels();
  };
}

const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function rejoin() {
  const n = store.get('name', 'Clerk');
  location.href = location.pathname + '?name=' + encodeURIComponent(n);
}
function reconnect(tries) {
  closePanels();
  loading(Math.min(0.95, tries / 30), `Connection lost - reconnecting (${tries + 1})…`);
  if (tries > 30) {
    $('#loadScreen').classList.add('hidden');
    $('#joinErr').textContent = 'The shop server is not answering. Check it is still running, then press Start shift.';
    $('#joinScreen').classList.remove('hidden');
    $('#game').classList.add('hidden');
    return;
  }
  fetch('/ping', { cache: 'no-store' }).then(r => { if (r.ok) rejoin(); else throw 0; })
    .catch(() => setTimeout(() => reconnect(tries + 1), 2000));
}

// Snapshots are applied once per frame, newest only. If the page was busy (loading the world, a slow
// phone, a background tab) a backlog of stale snapshots would otherwise be replayed one by one and
// the game would lag seconds behind. Events from skipped snapshots are still all played.
let latestSnap = null, pendingEv = [], flushQueued = false, flushTimer = 0;
function queueSnapshot(m) {
  if (m.xev) { m.ev = m.xev.concat(m.ev || []); delete m.xev; }   // events from snapshots the server skipped for us
  if (m.ev && m.ev.length) { pendingEv.push(...m.ev); if (pendingEv.length > 150) pendingEv.splice(0, pendingEv.length - 150); }
  latestSnap = m;
  // next frame, or within 100 ms if frames are slow / the tab is in the background
  if (!flushQueued) { flushQueued = true; requestAnimationFrame(flushSnapshot); flushTimer = setTimeout(flushSnapshot, 100); }
}
function flushSnapshot() {
  flushQueued = false;
  clearTimeout(flushTimer);
  const m = latestSnap; latestSnap = null;
  if (!m) return;
  m.ev = pendingEv; pendingEv = [];
  onSnapshot(m);
  if (m.sq) send({ t: 'ack', n: m.sq });     // lets the server pace snapshots to what we can show
}

// shopper fields, in the order the server packs them (game.js snapshot)
const CU_FIELDS = ['id', 'x', 'y', 'yaw', 's', 'lk', 'n', 'th', 'p', 'cart', 'm', 'mb', 'an', 'sl'];
function unpackShoppers(list) {
  return (list || []).map(a => { if (!Array.isArray(a)) return a; const o = {}; for (let i = 0; i < CU_FIELDS.length; i++) o[CU_FIELDS[i]] = a[i]; return o; });
}

function onSnapshot(s) {
  s.cu = unpackShoppers(s.cu);
  const prevPh = state && state.ph;
  state = s;

  const sp = s.pl.find(p => p.id === myId);
  if (sp) {
    if (!me) me = { x: sp.x, y: sp.y };
    const d = Math.hypot(sp.x - me.x, sp.y - me.y);
    if (d > 1.4) { me.x = sp.x; me.y = sp.y; }
    else { me.x += (sp.x - me.x) * 0.18; me.y += (sp.y - me.y) * 0.18; }
  }

  for (const e of s.ev || []) handleEvent(e);
  if (s.ph === 'summary' && s.sum && s.sum.day !== dismissedDay) showSummary(s.sum);
  else $('#summaryPanel').classList.add('hidden');
  if (prevPh && prevPh !== s.ph && s.ph === 'open') closePanels();

  updateHud();
  if (panel === 'price') refreshPriceTable();
  if (panel === 'order') refreshOrderTable();
  if (panel === 'up') refreshUpgrades();
  if (boardOpen) renderBoard();
}

function handleEvent(e) {
  if (e.kind === 'receipt') {
    if (e.to === myId) { showReceipt(e.receipt); sfx.paid(); }
    else nearTill(e.at) && sfx.till();
    return;
  }
  // messages meant for one clerk (short change, card declined at your till)
  if (e.to !== undefined && e.to !== myId) return;
  if (e.short) drawerShort(e.short);
  if (e.lvl) showLevelUp(e.lvl);
  if (e.kind === 'sfx') {
    // till sounds are only for whoever is near that till
    if (e.at !== undefined && !nearTill(e.at)) return;
    sfx[e.sfx] && sfx[e.sfx]();
    return;
  }
  if (e.kind === 'chat') { chatLine(e.from, e.color, e.msg); sfx.chat(); return; }
  if (e.sfx && sfx[e.sfx]) sfx[e.sfx]();
  else if (e.kind === 'bad') sfx.bad();
  toast(e.msg, e.kind);
}

function nearTill(i) {
  if (i === undefined || !me || !world) return true;
  const c = world.checkouts[i];
  return !c || Math.hypot(c.kx - me.x, c.ky - me.y) <= 6;
}

// ------------------------------------------------------------ HUD

const PHASE_LABEL = { prep: 'Prep', open: 'Open', closing: 'Closing', summary: 'Closed' };
const fmtClock = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// HUD writes go through these so an unchanged value never touches the DOM (15 snapshots a second)
const elCache = new Map(), lastVal = new Map();
const E = sel => { let e = elCache.get(sel); if (!e) { e = $(sel); elCache.set(sel, e); } return e; };
const txt = (sel, v) => { v = String(v); if (lastVal.get(sel) !== v) { lastVal.set(sel, v); E(sel).textContent = v; } };
const html = (sel, v) => { if (lastVal.get(sel + '#h') !== v) { lastVal.set(sel + '#h', v); E(sel).innerHTML = v; } };
const cls = (sel, v) => { if (lastVal.get(sel + '#c') !== v) { lastVal.set(sel + '#c', v); E(sel).className = v; } };
const show = (sel, on) => { if (lastVal.get(sel + '#v') !== on) { lastVal.set(sel + '#v', on); E(sel).classList.toggle('hidden', !on); } };

function updateHud() {
  const s = state; if (!s || !world) return;
  txt('#hDay', s.day);
  txt('#hClock', fmtClock(s.clk));
  txt('#hPhase', PHASE_LABEL[s.ph] || s.ph);
  cls('#hPhase', 'v pill ' + s.ph);
  txt('#hWx', (world.weathers[s.wx] || {}).label || s.wx);
  txt('#hCash', money(s.cash));
  txt('#hRep', Math.round(s.rep));
  const rw = s.rep + '%';
  if (lastVal.get('repw') !== rw) { lastVal.set('repw', rw); E('#hRepBar').firstElementChild.style.width = rw; }
  txt('#hCrew', s.pl.length);
  txt('#hLoyal', s.ly || 0);
  renderGoals(s);
  renderLevel(s);
  renderPos(s);
  txt('#hDeliv', s.pend ? `${s.pend} box${s.pend > 1 ? 'es' : ''} on the truck` : '');

  if (s.ph === 'prep') {
    const wx = world.weathers[s.wx] || { label: s.wx };
    html('#openBanner', `<b>Day ${s.day} prep</b> · forecast: ${esc(wx.label)} · stock up, then press <kbd>Enter</kbd> to open the doors`);
    show('#openBanner', true);
  } else if (s.ph === 'closing') {
    html('#openBanner', `<b>Doors closed</b> · serve the last shoppers (${s.tm}s)`);
    show('#openBanner', true);
  } else show('#openBanner', false);

  const p = s.prompt;
  cls('#crosshair', p && p.label ? (p.bad ? 'bad' : p.key ? 'active' : 'look') : '');
  if (p && p.label) {
    if (lastVal.get('#prompt#h') !== undefined && !lastVal.get('#prompt#h').includes(esc(p.label))) {
      const pe = E('#prompt'); pe.classList.remove('pop'); void pe.offsetWidth; pe.classList.add('pop');
    }
    cls('#prompt', 'tag' + (p.bad ? ' bad' : !p.key ? ' info' : '') + ' pop');
    html('#prompt', (p.key ? `<span class="key">${esc(p.key)}</span>` : '') + `<span class="lbl">${esc(p.label)}</span>` +
      (p.alt ? `<span class="alt"><b>${esc(p.alt)}</b>${esc(p.altLabel || '')}</span>` : ''));
  } else cls('#prompt', 'tag hidden');

  const self = s.pl.find(x => x.id === myId);
  if (self && self.b >= 0) {
    const pr = world.products[self.b];
    const life = self.bl === 0 ? ' · <b style="color:#ff8a80">expired - bin it</b>' : self.bl > 0 ? ` · ${self.bl} day${self.bl === 1 ? '' : 's'} left` : '';
    html('#carry', `<span class="sw" style="background:${pr.color}"></span>${esc(pr.name)} × ${self.bu} <span class="muted">→ ${KIND_FIX[pr.kind]}${life}</span>`);
    show('#carry', true);
  } else show('#carry', false);
}

// ---- store level badge: name + progress towards the next level
let levelKey = '';
function renderLevel(s) {
  const L = world.levels, lv = s.lvl || 1, next = L[lv + 1];
  const key = `${lv}|${s.srv}|${Math.round(s.rep)}|${Math.round(s.cash / 100)}`;
  if (key === levelKey) return;
  levelKey = key;
  $('#hLvl').textContent = lv;
  $('#hLvlName').textContent = L[lv].name;
  let frac = 1, tip = 'Top store level reached';
  if (next) {
    const parts = [Math.min(1, s.srv / Math.max(1, next.served)), next.rep ? Math.min(1, s.rep / next.rep) : 1, Math.min(1, s.cash / next.cost)];
    frac = parts.reduce((a, b) => a + b, 0) / parts.length;
    tip = `Next: ${next.name} · ${Math.min(s.srv, next.served)}/${next.served} shoppers served` + (next.rep ? ` · reputation ${Math.round(s.rep)}/${next.rep}` : '') + ` · ${money(next.cost)}`;
  }
  $('#hLvlBar').style.width = Math.round(frac * 100) + '%';
  $('#hLevel').title = tip + ' · click to grow the store';
  $('#hLevel').classList.toggle('ready', !!next && !(s.lvb || []).length);
}
$('#hLevel').addEventListener('click', () => togglePanel('up'));

// ---- the bill on the till you're standing at
let posKey = '';
function myTill(s) {
  const self = s.pl.find(p => p.id === myId);
  if (!self || self.co === null || self.co === undefined) return null;
  return s.ck.find(k => k.i === self.co) || null;
}
function billLines(ck) {
  // one row per product in scan order; scanned rows show their price, the rest are still on the belt
  const out = [];
  let left = ck.sc;
  for (const it of ck.items || []) {
    const done = Math.max(0, Math.min(it.qty, left));
    left -= it.qty;
    out.push({ pid: it.pid, q: it.qty, done, p: it.p });
  }
  return out;
}
function renderPos(s) {
  const ck = myTill(s), el = $('#pos');
  if (!ck || (!ck.items && !ck.last)) { el.classList.add('hidden'); posKey = ''; if (panel === 'drawer') closePanels(); return; }
  const pk = ck.pay ? [ck.pay.m, ck.pay.td, ck.pay.due, ck.pay.g] : null;
  const key = JSON.stringify([ck.i, ck.sc, ck.st, pk, ck.last, ck.sum]);
  if (key === posKey) return;
  posKey = key;
  el.classList.remove('hidden');
  $('#posTill').textContent = `Till ${ck.i + 1}` + (ck.mb ? ' · ★ member' : '');
  const P = world.products;
  const st = $('#posState');
  if (!ck.items) {
    // the sale just finished: show how it was paid for a moment
    const l = ck.last;
    $('#posBill').textContent = 'Paid';
    $('#posLines').innerHTML = '';
    $('#posTotal').textContent = money(l.total);
    st.className = 'pos-state ok';
    st.textContent = `✓ Paid by ${l.m === 'upi' ? 'UPI' : l.m === 'card' ? 'card' : 'cash'}` + (l.m === 'cash' && l.ch ? ` · change ${money(l.ch)}` : '') + ' · thank you!';
    if (panel === 'drawer') closePanels();
    return;
  }
  const lines = billLines(ck);
  $('#posBill').textContent = `${ck.sc}/${ck.tot} items`;
  let lastDone = -1;
  lines.forEach((l, i) => { if (l.done > 0) lastDone = i; });
  $('#posLines').innerHTML = lines.map((l, i) => {
    const p = P[l.pid];
    if (!l.done) return `<div class="pos-line todo"><span>${esc(p.name)} <span class="q">× ${l.q}</span></span><span>on belt</span></div>`;
    return `<div class="pos-line${i === lastDone && ck.st === 'scan' ? ' new' : ''}"><span>${esc(p.name)} <span class="q">${l.done} × ${l.p}</span></span><span>${money(l.done * l.p)}</span></div>`;
  }).join('');
  const sub = lines.reduce((a, l) => a + l.done * l.p, 0);
  $('#posTotal').textContent = money(ck.st === 'scan' ? sub : ck.sum);
  const pay = ck.pay;
  if (ck.st === 'scan') { st.className = 'pos-state'; st.innerHTML = 'Scanning · <kbd>Space</kbd> per item'; }
  else if (ck.st === 'total') { st.className = 'pos-state'; st.innerHTML = `Bill ready · <kbd>Space</kbd> to ask for ${money(ck.sum)}`; }
  else if (ck.st === 'card') { st.className = 'pos-state card'; st.innerHTML = `💳 Card · waiting for PIN<span class="dots"></span>`; }
  else if (ck.st === 'upi') { st.className = 'pos-state upi'; st.innerHTML = `📱 UPI · shopper scanning the QR<span class="dots"></span>`; }
  else if (ck.st === 'cash' && pay) {
    const left = pay.due - pay.g;
    st.className = 'pos-state cash';
    st.innerHTML = left > 0 ? `💵 Cash ${money(pay.td)} · give ${money(left)} change · <kbd>Space</kbd> opens the drawer`
      : `💵 Exact cash ${money(pay.td)} · <kbd>Space</kbd> to close the drawer`;
    if (panel === 'drawer') refreshDrawer(ck);
  }
  const box = $('#posLines'); box.scrollTop = box.scrollHeight;
}

// ---- cash drawer: pick notes and coins to make up the change
const NOTE_STYLE = {
  500: ['#c9c2a6', '#9f9a86'], 200: ['#f4b259', '#e08a2e'], 100: ['#c6b7e6', '#9c87cf'], 50: ['#8fd3dd', '#5ab4c3'],
  20: ['#d6e48a', '#b3c65a'], 10: ['#d2a678', '#b07e4f'], 5: ['#d9b44a'], 2: ['#c9ccd1'], 1: ['#b9bdc4'],
};
let tray = [];
function buildDrawer() {
  const box = $('#drNotes');
  box.innerHTML = '';
  world.notes.forEach((v, i) => {
    const b = document.createElement('button');
    const coin = v < 10;
    b.className = 'money ' + (coin ? 'coin' : 'note');
    const [a, c] = NOTE_STYLE[v] || ['#ddd', '#bbb'];
    b.style.setProperty('--n1', a); b.style.setProperty('--n2', c || a);
    b.innerHTML = `<kbd>${9 - i}</kbd>₹${v}<small>${coin ? 'coin' : 'note'}</small>`;
    b.setAttribute('aria-label', `Add a ${v} rupee ${coin ? 'coin' : 'note'}`);
    b.onclick = () => addToTray(v);
    box.appendChild(b);
  });
}
function addToTray(v) {
  tray.push(v); (v < 10 ? sfx.coin : sfx.note)(); drawTray();
  // a focused button would also fire on Space/Enter, which mean "give change" here
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
}
function drawTray() {
  const sum = tray.reduce((a, b) => a + b, 0);
  const ck = state && myTill(state);
  const left = ck && ck.pay ? ck.pay.due - ck.pay.g : 0;
  $('#drGive').textContent = money(sum);
  const wrap = document.querySelector('.tray-wrap');
  wrap.classList.toggle('ok', sum === left && left > 0);
  wrap.classList.toggle('over', sum > left);
  $('#drTray').innerHTML = tray.map(v => {
    const [a, c] = NOTE_STYLE[v] || ['#ddd', '#bbb'];
    return `<span class="money ${v < 10 ? 'coin' : 'note'}" style="--n1:${a};--n2:${c || a}">₹${v}</span>`;
  }).join('');
}
function refreshDrawer(ck) {
  if (!ck || !ck.pay) return;
  $('#drBill').textContent = money(ck.sum);
  $('#drTd').textContent = money(ck.pay.td);
  $('#drDue').textContent = money(Math.max(0, ck.pay.due - ck.pay.g));
  drawTray();
}
function openDrawer() {
  const ck = state && myTill(state);
  if (!ck || ck.st !== 'cash' || !ck.pay) return;
  if (!world.notesBuilt) { buildDrawer(); world.notesBuilt = true; }
  tray = [];
  $('#drSay').textContent = ck.pay.g ? '' : `The shopper hands you ${money(ck.pay.td)}.`;
  $('#drSay').style.color = '#cfe0d7';
  if (panel !== 'drawer') togglePanel('drawer');
  sfx.drawer();
  refreshDrawer(ck);
}
function giveChange() {
  const sum = tray.reduce((a, b) => a + b, 0);
  const ck = state && myTill(state);
  if (!ck || ck.st !== 'cash') { closePanels(); return; }
  if (sum === 0 && ck.pay && ck.pay.due - ck.pay.g > 0) { $('#drSay').style.color = '#ff9a9a'; $('#drSay').textContent = 'Pick the notes and coins to give back first.'; return; }
  send({ t: 'change', amt: sum });
  tray = [];
  drawTray();
  // the click or Enter is a user gesture, so we can grab the mouse straight back
  setTimeout(() => { if (panel !== 'drawer' && !locked) lockPointer(); }, 400);
}
function drawerShort(n) {
  $('#drSay').style.color = '#ff9a9a';
  $('#drSay').textContent = `"Excuse me, that's ₹${n} short!" - give the rest.`;
  if (panel !== 'drawer') openDrawer();
}
$('#drGiveBtn').addEventListener('click', giveChange);
$('#drClear').addEventListener('click', () => { tray = []; drawTray(); });

// ---- receipt slip after a sale
let receiptT = null;
function showReceipt(r) {
  const P = world.products, L = world.levels[state ? state.lvl : 1];
  const t = `${String(Math.floor(r.clk / 60) % 24).padStart(2, '0')}:${String(r.clk % 60).padStart(2, '0')}`;
  const line = (a, b, cls = '') => `<div class="l ${cls}"><span>${a}</span><span>${b}</span></div>`;
  const gst = Math.round(r.total - r.total / 1.05);
  $('#receipt').innerHTML =
    `<h5>MiniMart</h5><div class="c">${esc(L ? L.name : '')} · Till ${r.till} · ${esc(r.cashier)}</div>` +
    `<div class="c">Bill #${String(r.no).padStart(5, '0')} · Day ${r.day} · ${t}</div><hr>` +
    r.lines.map(l => line(`${esc(P[l.pid].name)} ${l.q}×${l.p}`, money(l.q * l.p))).join('') +
    `<hr>${line('TOTAL', money(r.total), 't')}` +
    line(`Paid (${r.m === 'upi' ? 'UPI' : r.m === 'card' ? 'Card' : 'Cash'})`, money(r.m === 'cash' ? r.td : r.total)) +
    (r.m === 'cash' ? line('Change', money(r.ch)) : '') +
    `<div class="c">incl. GST ${money(gst)} · MRP incl. of all taxes</div>` +
    (r.member ? '<div class="c">★ Loyalty member</div>' : '') +
    '<hr><div class="c">Thank you, visit again!</div>';
  $('#receipt').classList.remove('hidden');
  clearTimeout(receiptT);
  receiptT = setTimeout(() => $('#receipt').classList.add('hidden'), 5000);
}

// ---- level-up fanfare
let levelUpT = null;
function showLevelUp(lv) {
  const L = world.levels[lv];
  if (!L) return;
  $('#levelUpName').textContent = `Level ${lv} · ${L.name}`;
  $('#levelUpDesc').textContent = L.desc;
  $('#levelUp').classList.remove('hidden');
  clearTimeout(levelUpT);
  levelUpT = setTimeout(() => $('#levelUp').classList.add('hidden'), 5200);
}

let goalsKey = '';
function renderGoals(s) {
  const gl = s.gl || [];
  const key = gl.map(g => g.v + ':' + g.done).join('|') + s.ph;
  if (key === goalsKey) return;
  goalsKey = key;
  const prog = g => ['nothief', 'nowalk', 'clean'].includes(g.k) ? (g.done ? 'on track' : g.k === 'clean' ? `${g.v} spill${g.v === 1 ? '' : 's'}` : 'missed')
    : g.k === 'revenue' ? `${money(g.v)} / ${money(g.n)}` : g.k === 'rep' ? `${g.v} / ${g.n}` : `${Math.min(g.v, g.n)} / ${g.n}`;
  $('#goals').innerHTML = gl.length ? `<div class="gh">Today's goals · ${money(gl[0].r)} each</div>` +
    gl.map(g => `<div class="goal ${g.done ? 'done' : ''}"><span class="ck"></span>${esc(g.t)}<span class="pr">${esc(prog(g))}</span></div>`).join('') : '';
}

function toast(msg, kind) {
  if (!msg) return;
  const d = document.createElement('div');
  d.className = 'toast ' + (kind || '');
  d.textContent = msg;
  const box = $('#toasts');
  box.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .4s'; setTimeout(() => d.remove(), 420); }, 4600);
  while (box.children.length > 6) box.firstChild.remove();
}

function chatLine(from, color, msg) {
  const d = document.createElement('div');
  d.className = 'chatline';
  d.innerHTML = `<b style="color:${esc(color)}">${esc(from)}</b> ${esc(msg)}`;
  const log = $('#chatLog');
  log.appendChild(d);
  while (log.children.length > 7) log.firstChild.remove();
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 14000);
}

// ------------------------------------------------------------ crew board (hold Tab)

let boardOpen = false;
function renderBoard() {
  if (!state) return;
  const rows = state.pl.map(p => {
    const [stk, scn, srv, cau, cln] = p.st;
    return { p, stk, scn, srv, cau, cln, score: stk + scn + srv * 5 + cau * 20 + cln * 8 };
  }).sort((a, b) => b.score - a.score);
  $('#boardTable').innerHTML = '<thead><tr><th>Clerk</th><th class="num">Stocked</th><th class="num">Scanned</th><th class="num">Served</th><th class="num">Thieves</th><th class="num">Spills</th><th class="num">Score</th></tr></thead><tbody>' +
    rows.map(r => `<tr><td><span class="sw" style="background:${r.p.c}"></span>${esc(r.p.n)}${r.p.id === myId ? ' <span class="muted">(you)</span>' : ''}</td>` +
      `<td class="num">${r.stk}</td><td class="num">${r.scn}</td><td class="num">${r.srv}</td><td class="num">${r.cau}</td><td class="num">${r.cln}</td><td class="num"><b>${r.score}</b></td></tr>`).join('') + '</tbody>';
}

// ------------------------------------------------------------ input

const cv = $('#cv');
function lockPointer() {
  if (isTouch || !cv.requestPointerLock) return;
  try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* not allowed right now */ }
}
cv.addEventListener('click', () => { sfx.unlock(); if (!panel && world && !chatting) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === cv;
  $('#clickHint').classList.toggle('hidden', locked || !!panel || chatting);
  if (!locked) keys = {};
});

document.addEventListener('mousemove', e => {
  if (!locked) return;
  const sens = 0.0022 * settings.sens;
  camYaw -= e.movementX * sens;
  camPitch -= e.movementY * sens * (settings.invert ? -1 : 1);
  camPitch = Math.max(-1.35, Math.min(1.35, camPitch));
});

function interact() {
  const pr = state && state.prompt;
  if (pr && pr.open === 'drawer') { openDrawer(); return; }
  if (pr && pr.key === 'SPACE') { send({ t: 'scan' }); scanTimer = 0.26; return; }
  if (pr && pr.open) { togglePanel(pr.open); return; }
  if (!pr || !pr.key) return;
  send({ t: 'act' });
  if (/^Pick up/.test(pr.label)) sfx.pick();
  else if (/^Stock/.test(pr.label)) sfx.stock();
  else if (/^Mop/.test(pr.label)) sfx.mop();
}

cv.addEventListener('mousedown', e => {
  if (!locked || panel) return;
  if (e.button === 0) interact();
  if (e.button === 2) { send({ t: 'drop' }); sfx.drop(); }
});
cv.addEventListener('contextmenu', e => e.preventDefault());

// physical key for letters and Space (WASD works on AZERTY, Cyrillic...), the typed key otherwise
const keyOf = e => (e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code === 'Space' ? ' ' : (e.key || '').toLowerCase());
addEventListener('keydown', e => {
  const k = keyOf(e);
  if (k === 'tab') { e.preventDefault(); if (world && !chatting) { boardOpen = true; $('#board').classList.remove('hidden'); renderBoard(); } return; }

  if (chatting) {
    if (k === 'enter') { const t = $('#chatInput').value.trim(); if (t) send({ t: 'chat', text: t }); closeChat(); e.preventDefault(); }
    else if (k === 'escape') { closeChat(); e.preventDefault(); }
    return;
  }
  if (k === 'escape') { if (panel) { closePanels(); e.preventDefault(); } return; }
  if (panel === 'drawer') {
    if (e.repeat) { e.preventDefault(); return; }
    const i = '123456789'.indexOf(e.key);
    if (i >= 0) { addToTray(world.notes[8 - i]); e.preventDefault(); return; }
    if (k === 'backspace') { tray.pop(); drawTray(); e.preventDefault(); return; }
    if (k === 'enter' || k === ' ') { giveChange(); e.preventDefault(); return; }
    return;
  }
  if (document.activeElement && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) {
    if (k === 'enter') document.activeElement.blur();
    return;
  }
  if (keys[k]) return;
  keys[k] = true;
  if (!world) return;

  if (k === 'o') { togglePanel('order'); e.preventDefault(); return; }
  if (k === 'p') { togglePanel('price'); e.preventDefault(); return; }
  if (k === 'u') { togglePanel('up'); e.preventDefault(); return; }
  if (k === 'h' || k === 'f1') { togglePanel('help'); e.preventDefault(); return; }
  if (k === 'enter' && state && state.ph === 'summary') { $('#sumBtn').click(); e.preventDefault(); return; }
  if (panel) return;

  if (k === 'e') interact();
  if (k === 'q') { send({ t: 'drop' }); sfx.drop(); }
  if (k === 'r') send({ t: 'pull' });
  if (k === ' ') {
    e.preventDefault();
    if (state && state.prompt && state.prompt.open === 'drawer') { openDrawer(); return; }
    send({ t: 'scan' }); scanTimer = 0.26;
  }
  if (k === 'enter') send({ t: 'ready' });
  if (k === 't') { openChat(); e.preventDefault(); }
  if (k === 'm') { $('#mapWrap').classList.toggle('big'); }
});
addEventListener('keyup', e => {
  const k = keyOf(e);
  keys[k] = false;
  if (k === 'tab') { boardOpen = false; $('#board').classList.add('hidden'); }
});
addEventListener('blur', () => { keys = {}; boardOpen = false; $('#board').classList.add('hidden'); });

function openChat() {
  chatting = true; keys = {};
  send({ t: 'input', mx: 0, mz: 0 });
  $('#chatBox').classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
  setTimeout(() => $('#chatInput').focus(), 0);
}
function closeChat() {
  chatting = false;
  $('#chatInput').value = '';
  $('#chatInput').blur();
  $('#chatBox').classList.add('hidden');
  $('#clickHint').classList.toggle('hidden', locked || !!panel);
}

// ------------------------------------------------------------ movement + prediction

function solidAt(tx, ty) {
  if (!world || tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
  return SOLID.has(world.rows[ty][tx]);
}
// must match Game.freeAt: tiles plus the round props (plants, baskets, bench) the server collides with
function freeAt(x, y) {
  const r = PLAYER_R;
  if (solidAt(Math.floor(x - r), Math.floor(y - r)) || solidAt(Math.floor(x + r), Math.floor(y - r))
    || solidAt(Math.floor(x - r), Math.floor(y + r)) || solidAt(Math.floor(x + r), Math.floor(y + r))) return false;
  for (const c of world.colliders || []) { const dx = x - c.x, dy = y - c.y, rr = c.r + r; if (dx * dx + dy * dy < rr * rr) return false; }
  return true;
}

function basis() {
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  return { fx, fz, rx: -fz, rz: fx };
}

function moveVector() {
  if (panel || chatting) return { mx: 0, mz: 0, sp: false };
  const b = basis();
  let mx = 0, mz = 0;
  if (keys['w'] || keys['arrowup']) { mx += b.fx; mz += b.fz; }
  if (keys['s'] || keys['arrowdown']) { mx -= b.fx; mz -= b.fz; }
  if (keys['d'] || keys['arrowright']) { mx += b.rx; mz += b.rz; }
  if (keys['a'] || keys['arrowleft']) { mx -= b.rx; mz -= b.rz; }
  if (touch.mx || touch.my) { mx += b.rx * touch.mx - b.fx * touch.my; mz += b.rz * touch.mx - b.fz * touch.my; }
  const len = Math.hypot(mx, mz);
  if (len > 1 || (len > 0 && !(touch.mx || touch.my))) { mx /= len; mz /= len; }
  return { mx, mz, sp: !!keys['shift'] || touch.sprint };
}

function carrying() {
  const self = state && state.pl.find(p => p.id === myId);
  return !!(self && self.b >= 0);
}

function predict(dt, mv) {
  if (!me || !state || (!mv.mx && !mv.mz)) return;
  const c = carrying();
  const sp = (c ? SPEED_CARRY : mv.sp ? SPEED_SPRINT : SPEED) * dt;
  const nx = me.x + mv.mx * sp;
  if (freeAt(nx, me.y)) me.x = nx;
  const ny = me.y + mv.mz * sp;
  if (freeAt(me.x, ny)) me.y = ny;
}

function pump(dt, now, mv) {
  const b = basis();
  const yawDeg = Math.atan2(b.fx, b.fz) * 180 / Math.PI;
  const sig = `${mv.mx.toFixed(2)},${mv.mz.toFixed(2)},${yawDeg.toFixed(0)},${mv.sp}`;
  if (sig !== lastSig || now - lastSent > 150) {
    send({ t: 'input', mx: +mv.mx.toFixed(3), mz: +mv.mz.toFixed(3), yaw: +yawDeg.toFixed(1), sp: mv.sp });
    lastSig = sig; lastSent = now;
  }
  if (keys[' '] && !panel && !chatting) {
    scanTimer -= dt;
    if (scanTimer <= 0) { send({ t: 'scan' }); scanTimer = 0.2; }
  }
}

let stepT = 0, audioT = 0;
function audioTick(dt, moving, prevDoor) {
  const inside = me.y < world.door.y && me.x > 2 && me.x < 57;
  audioT -= dt;
  if (audioT <= 0) {
    audioT = 0.5;
    sfx.music(inside && (state.ph === 'open' || state.ph === 'prep' || state.ph === 'closing'), 1);
    sfx.ambience(!inside, 1);
  }
  if (moving) { stepT -= dt; if (stepT <= 0) { sfx.step(); stepT = carrying() ? 0.5 : 0.38; } }
  const dcx = (world.door.x0 + world.door.x1 + 1) / 2;
  if (prevDoor < 0.2 && scene.doorOpen >= 0.2 && Math.hypot(me.x - dcx, me.y - world.door.y) < 10) sfx.chime();
}

// lower the render resolution when frames get slow, raise it again when there's headroom
let ftAvg = 1 / 60, slowT = 0, fastT = 0;
function autoResolution(dt) {
  if (!settings.autoRes) return;
  ftAvg += (dt - ftAvg) * 0.05;
  if (ftAvg > 1 / 38) { slowT += dt; fastT = 0; } else if (ftAvg < 1 / 56) { fastT += dt; slowT = 0; } else { slowT = fastT = 0; }
  if (slowT > 1.5) { scene.setResScale(scene.resScale - 0.1); slowT = 0; }
  if (fastT > 5) { scene.setResScale(scene.resScale + 0.05); fastT = 0; }
}

let mapT = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - (frame.last || ts)) / 1000);
  frame.last = ts;
  const mv = moveVector();
  pump(dt, performance.now(), mv);
  predict(dt, mv);
  if (scene && me && state) {
    scene.setLook(camYaw, camPitch);
    const moving = !!(mv.mx || mv.mz);
    const prevDoor = scene.doorOpen;
    scene.update(state, myId, me, dt, moving, moving && mv.sp && !carrying());
    audioTick(dt, moving, prevDoor);
    autoResolution(dt);
    mapT -= dt;
    if (mapT <= 0) { drawMap(); mapT = 0.1; }
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ minimap

const mapCv = $('#minimap');
const mapBase = document.createElement('canvas');
const MAP_VIEW = { x0: 0, y0: 1, x1: 60, y1: 46 };
function mapScale() { return { sx: mapCv.width / (MAP_VIEW.x1 - MAP_VIEW.x0), sy: mapCv.height / (MAP_VIEW.y1 - MAP_VIEW.y0) }; }

function drawMapBase() {
  if (!world) return;
  mapBase.width = mapCv.width; mapBase.height = mapCv.height;
  const g = mapBase.getContext('2d');
  const { sx, sy } = mapScale();
  const col = {
    '#': '#d8ddd9', 'G': '#8fc7e0', 'L': '#4a6a5a', 'X': '#24452f', '.': '#3a4d45', 'o': '#4a4e54', 'D': '#8a7a3a', 'E': '#7fd896',
    'P': '#4ea3e0', 'W': '#e5483b', 'S': '#c9b98a', 'F': '#7fb2e0', 'Z': '#a6d4f2', 'V': '#7fc76a', 'C': '#2f9a5e', 'R': '#b0703a', 'K': '#7a838c', 'T': '#3f7a34', 'U': '#9aa3ab',
  };
  g.fillStyle = '#1b2f24'; g.fillRect(0, 0, mapBase.width, mapBase.height);
  for (let y = MAP_VIEW.y0; y < MAP_VIEW.y1; y++) for (let x = MAP_VIEW.x0; x < MAP_VIEW.x1; x++) {
    const c = world.rows[y][x];
    g.fillStyle = col[c] || '#333';
    g.fillRect((x - MAP_VIEW.x0) * sx, (y - MAP_VIEW.y0) * sy, Math.ceil(sx), Math.ceil(sy));
  }
}

function drawMap() {
  if (!state || !world) return;
  const g = mapCv.getContext('2d');
  const { sx, sy } = mapScale();
  g.drawImage(mapBase, 0, 0);
  const P = (x, y) => [(x - MAP_VIEW.x0) * sx, (y - MAP_VIEW.y0) * sy];
  const dot = (x, y, r, c) => { const [px, py] = P(x, y); g.fillStyle = c; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); };
  // empty fixtures get a red mark so the crew knows what to restock
  world.fixtures.forEach(f => {
    const [pid, q] = state.sh[f.id];
    const active = f.lvl <= (state.lvl || 1);
    if (!active) return;
    if (pid >= 0 && q > 0 && state.sh[f.id][2] === 0) { const [px, py] = P(f.tx, f.ty); g.fillStyle = 'rgba(150,150,150,.95)'; g.fillRect(px, py, sx * 2, sy); }
    else if (pid < 0 || q === 0) { const [px, py] = P(f.tx, f.ty); g.fillStyle = 'rgba(228,91,91,.85)'; g.fillRect(px, py, sx * 2, sy); }
    else if (q < 5) { const [px, py] = P(f.tx, f.ty); g.fillStyle = 'rgba(242,194,48,.85)'; g.fillRect(px, py, sx * 2, sy); }
  });
  for (const b of state.bx) dot(b.x, b.y, 1.8, '#d8a35a');
  for (const s of state.sp || []) dot(s.x, s.y, 2.6, '#6fd0ff');
  for (const c of state.cu) dot(c.x, c.y, 1.9, c.th ? '#ff4040' : '#e8e8e8');
  for (const s of state.sf || []) dot(s.x, s.y, 2.2, '#2f9a5e');
  for (const p of state.pl) if (p.id !== myId) dot(p.x, p.y, 2.8, p.c);
  if (me) {
    const [px, py] = P(me.x, me.y);
    const b = basis();
    g.save(); g.translate(px, py); g.rotate(Math.atan2(b.fz, b.fx));
    g.fillStyle = '#f2c230'; g.strokeStyle = '#000'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -4); g.lineTo(-2, 0); g.lineTo(-4, 4); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

// ------------------------------------------------------------ panels

const PANELS = { order: '#orderPanel', price: '#pricePanel', up: '#upPanel', set: '#setPanel', help: '#helpPanel', drawer: '#drawerPanel' };

function togglePanel(which) {
  if (panel === which) { closePanels(); return; }
  closePanels();
  panel = which;
  if (which === 'order') refreshOrderTable();
  if (which === 'price') refreshPriceTable();
  if (which === 'up') refreshUpgrades();
  if (which === 'set') loadSettingsUI();
  $(PANELS[which]).classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
  send({ t: 'input', mx: 0, mz: 0 });
  keys = {};
}
function closePanels() {
  panel = null;
  // a focused field inside a closed panel would swallow every hotkey afterwards
  const ae = document.activeElement;
  if (ae && ae !== document.body && ae.id !== 'chatInput' && ae.id !== 'nameInput') ae.blur();
  for (const sel of Object.values(PANELS)) $(sel).classList.add('hidden');
  $('#clickHint').classList.toggle('hidden', locked || chatting);
}
document.querySelectorAll('.close').forEach(b => b.addEventListener('click', closePanels));
$('#btnOrder').addEventListener('click', () => togglePanel('order'));
$('#btnPrice').addEventListener('click', () => togglePanel('price'));
$('#btnUp').addEventListener('click', () => togglePanel('up'));
$('#btnSet').addEventListener('click', () => togglePanel('set'));
// clicking the dimmed backdrop closes a panel
for (const sel of Object.values(PANELS)) $(sel).addEventListener('mousedown', e => { if (e.target === e.currentTarget) closePanels(); });

// ---- supplier

function stockOf() {
  const stock = {}, boxes = {};
  if (!state) return { stock, boxes };
  for (const [pid, q] of state.sh) if (pid >= 0) stock[pid] = (stock[pid] || 0) + q;
  for (const b of state.bx) boxes[b.p] = (boxes[b.p] || 0) + b.u;
  return { stock, boxes };
}

function buildOrderTabs() {
  const t = $('#orderTabs');
  t.innerHTML = '';
  for (const k of Object.keys(KIND_LABEL)) {
    const b = document.createElement('button');
    b.dataset.k = k;
    b.innerHTML = esc(KIND_LABEL[k]) + '<span class="lock" data-lock></span>';
    b.onclick = () => { orderTab = k; buildOrderTable(); refreshOrderTable(); };
    t.appendChild(b);
  }
}

function buildOrderTable() {
  for (const b of document.querySelectorAll('#orderTabs button')) b.classList.toggle('on', b.dataset.k === orderTab);
  const t = $('#orderTable');
  t.innerHTML = '<thead><tr><th>Product</th><th class="num">Unit cost</th><th class="num">Expected</th><th class="num">Per box</th>' +
    '<th class="num">On shelves</th><th class="num">In storage</th><th class="num">Boxes</th><th class="num">Total</th><th></th></tr></thead><tbody></tbody>';
  const tb = t.querySelector('tbody');
  world.products.filter(p => p.kind === orderTab).forEach(p => {
    orderQty[p.id] = orderQty[p.id] || 1;
    const tr = document.createElement('tr');
    tr.dataset.pid = p.id;
    tr.innerHTML =
      `<td><span class="swatch" style="background:${p.color}"></span>${esc(p.name)} <span class="muted">${esc(p.brand)} · ${esc(p.size)}</span><div class="lic" data-lic></div></td>` +
      `<td class="num">${money(p.cost)}</td><td class="num">${money(p.base)}</td><td class="num">${p.per}</td>` +
      `<td class="num" data-shelf></td><td class="num" data-store></td>` +
      `<td class="num"><div class="qtyctl"><button data-dec aria-label="Fewer boxes">−</button><input type="number" min="1" max="20" value="${orderQty[p.id]}" data-qty aria-label="Boxes"><button data-inc aria-label="More boxes">+</button></div></td>` +
      `<td class="num" data-boxprice></td><td class="num"><button class="buy" data-buy>Order</button></td>`;
    const qty = tr.querySelector('[data-qty]');
    const sync = () => {
      const v = Math.max(1, Math.min(20, parseInt(qty.value || '1', 10) || 1));
      qty.value = v; orderQty[p.id] = v;
      tr.querySelector('[data-boxprice]').textContent = money(p.cost * p.per * v);
      refreshOrderTable();
    };
    tr.querySelector('[data-dec]').onclick = () => { qty.value = +qty.value - 1; sync(); };
    tr.querySelector('[data-inc]').onclick = () => { qty.value = +qty.value + 1; sync(); };
    qty.oninput = sync;
    tr.querySelector('[data-buy]').onclick = ev => {
      const n = ev.shiftKey ? 5 : orderQty[p.id];
      send({ t: 'order', pid: p.id, boxes: n });
    };
    sync();
    tb.appendChild(tr);
  });
}

// which licence a product belongs to, and whether we hold it
function licenceOf(pid) {
  for (const [k, l] of Object.entries(world.licenses)) if (l.pids.includes(pid)) return { k, l, owned: !!(state && state.lic && state.lic[k]) };
  return { k: null, l: null, owned: true };
}

function refreshOrderTable() {
  if (!state || !world) return;
  for (const b of document.querySelectorAll('#orderTabs button')) {
    const any = world.products.some(p => p.kind === b.dataset.k && licenceOf(p.id).owned);
    b.querySelector('[data-lock]').textContent = any ? '' : ' · locked';
  }
  $('#orderCash').textContent = `Cash ${money(state.cash)} · ${state.pend} box${state.pend === 1 ? '' : 'es'} on the way`;
  const { stock, boxes } = stockOf();
  for (const tr of document.querySelectorAll('#orderTable tbody tr')) {
    const pid = +tr.dataset.pid, p = world.products[pid];
    tr.querySelector('[data-shelf]').textContent = stock[pid] || 0;
    tr.querySelector('[data-store]').textContent = boxes[pid] || 0;
    const btn = tr.querySelector('[data-buy]');
    const cost = p.cost * p.per * orderQty[pid];
    const lic = licenceOf(pid);
    const blocked = !lic.owned;
    tr.classList.toggle('locked', blocked);
    tr.querySelector('[data-lic]').textContent = blocked ? `🔒 ${lic.l.name} licence · store level ${lic.l.lvl} (U)` : '';
    btn.disabled = blocked || cost > state.cash;
    btn.textContent = blocked ? 'Locked' : 'Order';
    btn.title = blocked ? `Buy the ${lic.l.name} licence first` : cost > state.cash ? 'Not enough cash' : '';
  }
}

// ---- prices

function buildPriceTable() {
  const t = $('#priceTable');
  t.innerHTML = '<thead><tr><th>Product</th><th class="num">You pay</th><th class="num">Shoppers expect</th>' +
    '<th class="num">Your price</th><th class="num">Margin</th><th class="num">On shelves</th><th class="num">Promo</th></tr></thead><tbody></tbody>';
  const tb = t.querySelector('tbody');
  for (const kind of Object.keys(KIND_LABEL)) {
    const g = document.createElement('tr');
    g.className = 'group';
    g.innerHTML = `<td colspan="7">${KIND_LABEL[kind]}</td>`;
    tb.appendChild(g);
    world.products.filter(p => p.kind === kind).forEach(p => {
      const tr = document.createElement('tr');
      tr.dataset.pid = p.id;
      tr.innerHTML =
        `<td><span class="swatch" style="background:${p.color}"></span>${esc(p.name)} <span class="muted">${esc(p.brand)} · ${esc(p.size)}</span></td>` +
        `<td class="num">${money(p.cost)}</td><td class="num">${money(p.base)}</td>` +
        `<td class="num"><div class="qtyctl"><button data-dec aria-label="Lower price">−</button><input type="number" min="1" data-price aria-label="Price"><button data-inc aria-label="Raise price">+</button></div></td>` +
        `<td class="num" data-margin></td><td class="num" data-stock></td>` +
        `<td class="num"><input type="checkbox" data-promo aria-label="Put ${esc(p.name)} on promotion"></td>`;
      tr.querySelector('[data-promo]').onchange = e => send({ t: 'promo', pid: p.id, on: e.target.checked });
      const inp = tr.querySelector('[data-price]');
      const push = () => {
        const v = Math.max(1, Math.min(9999, parseInt(inp.value || p.base, 10) || p.base));
        inp.value = v;
        send({ t: 'price', pid: p.id, price: v });
      };
      tr.querySelector('[data-dec]').onclick = () => { inp.value = Math.max(1, +inp.value - 1); push(); };
      tr.querySelector('[data-inc]').onclick = () => { inp.value = +inp.value + 1; push(); };
      inp.onchange = push;
      tb.appendChild(tr);
    });
  }
}
$('#priceReset').addEventListener('click', () => world.products.forEach(p => send({ t: 'price', pid: p.id, price: p.base })));
$('#priceUp').addEventListener('click', () => world.products.forEach(p => send({ t: 'price', pid: p.id, price: Math.round(state.prices[p.id] * 1.1) })));

function refreshPriceTable() {
  if (!state) return;
  const { stock } = stockOf();
  for (const tr of document.querySelectorAll('#priceTable tbody tr[data-pid]')) {
    const pid = +tr.dataset.pid, p = world.products[pid];
    const inp = tr.querySelector('[data-price]');
    if (document.activeElement !== inp) inp.value = state.prices[pid];
    const price = state.prices[pid], m = price - p.cost;
    const mc = tr.querySelector('[data-margin]');
    mc.textContent = `${money(m)} (${Math.round((m / p.cost) * 100)}%)`;
    mc.className = 'num ' + (price > p.base * 1.3 ? 'lo' : m <= 0 ? 'lo' : price < p.base * 0.9 ? 'ok' : 'hi');
    mc.title = price > p.base * 1.3 ? 'Most shoppers will refuse this price' : '';
    tr.querySelector('[data-stock]').textContent = stock[pid] || 0;
    const pc = tr.querySelector('[data-promo]');
    const on = (state.pr || []).includes(pid);
    pc.checked = on;
    pc.disabled = !on && (state.pr || []).length >= (world.maxPromos || 3);
    pc.title = on && price > p.base ? 'Price is above what shoppers expect, so the promotion has no effect' : '';
  }
}

// ---- upgrades

function buildUpgrades() {
  // store levels
  const track = $('#lvlTrack');
  track.innerHTML = '';
  world.levels.forEach((L, lv) => {
    if (!L) return;
    const d = document.createElement('div');
    d.className = 'lvcard';
    d.dataset.lv = lv;
    d.innerHTML = `<span class="badge" data-badge></span><span class="n">LEVEL ${lv}</span><h4>${esc(L.name)}</h4><p>${esc(L.desc)}</p><ul data-req></ul>` +
      `<button data-buy class="hidden">Expand for ${money(L.cost)}</button>`;
    d.querySelector('[data-buy]').onclick = () => send({ t: 'level' });
    track.appendChild(d);
  });
  // licences
  const lg = $('#licGrid');
  lg.innerHTML = '';
  for (const [key, l] of Object.entries(world.licenses)) {
    const d = document.createElement('div');
    d.className = 'up';
    d.dataset.key = key;
    d.innerHTML = `<h4>${esc(l.name)}</h4><p class="prods">${l.pids.map(i => esc(world.products[i].name)).join(' · ')}</p>` +
      `<div class="foot"><span><span class="price" data-price></span> <span class="lvl" data-lvl></span></span><button data-buy>Buy licence</button></div>`;
    d.querySelector('[data-buy]').onclick = () => send({ t: 'license', key });
    lg.appendChild(d);
  }
  // equipment + staff
  const grid = $('#upGrid');
  grid.innerHTML = '';
  for (const [key, u] of Object.entries(world.upgrades)) {
    const d = document.createElement('div');
    d.className = 'up';
    d.dataset.key = key;
    d.innerHTML = `<h4>${esc(u.name)}</h4><p>${esc(u.desc)}</p><div class="foot"><span><span class="price" data-price></span> <span class="lvl" data-lvl></span></span><button data-buy>Buy</button></div>`;
    d.querySelector('[data-buy]').onclick = () => send({ t: 'buy', key });
    grid.appendChild(d);
  }
}

function refreshUpgrades() {
  if (!state) return;
  $('#upCash').textContent = `Cash ${money(state.cash)}`;
  const lvNow = state.lvl || 1;
  for (const d of document.querySelectorAll('#lvlTrack .lvcard')) {
    const lv = +d.dataset.lv, L = world.levels[lv];
    const done = lv < lvNow, cur = lv === lvNow, next = lv === lvNow + 1;
    d.className = 'lvcard' + (done ? ' done' : cur ? ' cur' : next ? ' next' : ' locked');
    d.querySelector('[data-badge]').textContent = done ? 'Done' : cur ? 'You are here' : '';
    d.querySelector('[data-badge]').classList.toggle('hidden', !done && !cur);
    const req = d.querySelector('[data-req]');
    if (lv === 1 || done || cur) req.innerHTML = '';
    else {
      const it = (ok, t) => `<li class="${ok ? 'met' : ''}">${t}</li>`;
      req.innerHTML = it(state.srv >= L.served, `${Math.min(state.srv, L.served)}/${L.served} shoppers served`) +
        (L.rep ? it(state.rep >= L.rep, `Reputation ${Math.round(state.rep)}/${L.rep}`) : '') +
        it(state.cash >= L.cost, `${money(L.cost)} cash`) + (lv > lvNow + 1 ? it(false, `Reach ${world.levels[lv - 1].name} first`) : '');
    }
    const b = d.querySelector('[data-buy]');
    b.classList.toggle('hidden', !next);
    b.disabled = !next || (state.lvb || []).length > 0;
    b.title = (state.lvb || []).join(' · ');
  }
  for (const d of document.querySelectorAll('#licGrid .up')) {
    const l = world.licenses[d.dataset.key];
    const owned = !!(state.lic && state.lic[d.dataset.key]);
    const lvOk = l.lvl <= lvNow;
    d.classList.toggle('owned', owned);
    d.classList.toggle('locked', !owned && !lvOk);
    d.querySelector('[data-price]').textContent = owned ? 'Licensed' : l.cost ? money(l.cost) : 'Free';
    d.querySelector('[data-lvl]').textContent = owned ? '' : `· level ${l.lvl}`;
    const b = d.querySelector('[data-buy]');
    b.classList.toggle('hidden', owned);
    b.disabled = !lvOk || l.cost > state.cash;
    b.textContent = lvOk ? 'Buy licence' : `Needs ${world.levels[l.lvl].name}`;
  }
  const up = state.up || {};
  for (const d of document.querySelectorAll('#upGrid .up')) {
    const key = d.dataset.key, u = world.upgrades[key];
    const lvl = up[key] | 0, max = u.max || 1;
    const owned = lvl >= max;
    const cost = Array.isArray(u.cost) ? u.cost[Math.min(lvl, u.cost.length - 1)] : u.cost;
    const lvOk = (u.lvl || 1) <= lvNow;
    d.classList.toggle('owned', owned);
    d.classList.toggle('locked', !lvOk && !owned);
    d.querySelector('[data-price]').textContent = owned ? 'Owned' : money(cost);
    d.querySelector('[data-lvl]').textContent = max > 1 ? `${lvl}/${max} hired` : '';
    const b = d.querySelector('[data-buy]');
    b.classList.toggle('hidden', owned);
    b.disabled = !lvOk || cost > state.cash;
    b.textContent = !lvOk ? `Needs ${world.levels[u.lvl].name}` : max > 1 && lvl ? 'Hire another' : max > 1 ? 'Hire' : 'Buy';
  }
}

// ---- settings

function loadSettingsUI() {
  $('#setSens').value = settings.sens;
  $('#setVol').value = settings.vol;
  $('#setQ').value = settings.quality;
  $('#setInv').checked = settings.invert;
  $('#setFov').value = settings.fov; $('#setFovV').textContent = settings.fov + '°';
  $('#setBob').checked = settings.bob;
  $('#setMus').value = settings.mus;
  $('#setAuto').checked = settings.autoRes;
  $('#setNote').textContent = '';
  $('#slotList').innerHTML = '<span class="muted">Loading…</span>';
  send({ t: 'slots' });
}
$('#setSens').addEventListener('input', e => { settings.sens = +e.target.value; store.set('sens', settings.sens); });
$('#setVol').addEventListener('input', e => { settings.vol = +e.target.value; store.set('vol', settings.vol); sfx.beep(); });
$('#setInv').addEventListener('change', e => { settings.invert = e.target.checked; store.set('invert', settings.invert); });
$('#setFov').addEventListener('input', e => { settings.fov = +e.target.value; store.set('fov', settings.fov); $('#setFovV').textContent = settings.fov + '°'; applyView(); });
$('#setBob').addEventListener('change', e => { settings.bob = e.target.checked; store.set('bob', settings.bob); applyView(); });
function applyView() { if (scene) { scene.baseFov = settings.fov; scene.viewBob = settings.bob; } }
$('#setMus').addEventListener('input', e => { settings.mus = +e.target.value; store.set('mus', settings.mus); });
$('#setAuto').addEventListener('change', e => { settings.autoRes = e.target.checked; store.set('autoRes', settings.autoRes); if (!settings.autoRes && scene) scene.setResScale(1); });
$('#saveNow').addEventListener('click', () => send({ t: 'host', op: 'save' }));

function renderSlots(m) {
  $('#hostBadge').textContent = m.host ? '· you are the host' : '· only the host can load or reset';
  $('#slotMsg').textContent = m.err || (m.saving ? '' : 'Saving is switched off on this server.');
  $('#saveNow').disabled = !m.host;
  $('#slotList').innerHTML = '';
  for (const sl of m.slots) {
    const d = document.createElement('div');
    d.className = 'slot' + (sl.n === m.current ? ' cur' : '');
    d.innerHTML = `<b>Slot ${sl.n}</b><span class="grow muted">${sl.empty ? 'empty' : `day ${sl.day} · ${money(sl.cash)}`}${sl.n === m.current ? ' · playing' : ''}</span>`;
    if (m.host) {
      if (sl.n !== m.current && !sl.empty) {
        const b = document.createElement('button'); b.className = 'chip'; b.textContent = 'Load';
        b.onclick = () => { if (confirm(`Save this game and switch everyone to slot ${sl.n}?`)) send({ t: 'host', op: 'load', slot: sl.n }); };
        d.appendChild(b);
      }
      const n = document.createElement('button'); n.className = 'danger'; n.textContent = 'New game';
      n.onclick = () => { if (confirm(`Start a brand-new shop in slot ${sl.n}? Anything saved in that slot is deleted.`)) send({ t: 'host', op: 'new', slot: sl.n }); };
      d.appendChild(n);
    }
    $('#slotList').appendChild(d);
  }
}
$('#setQ').addEventListener('change', e => {
  settings.quality = e.target.value; store.set('quality', settings.quality);
  $('#setNote').textContent = 'Graphics change applies after a page refresh - your progress is kept on the server.';
});

// ------------------------------------------------------------ summary

let shownDay = -1, dismissedDay = -1;
function showSummary(sum) {
  if (shownDay === sum.day && !$('#summaryPanel').classList.contains('hidden')) return;
  shownDay = sum.day;
  closePanels();
  document.exitPointerLock && document.exitPointerLock();
  $('#sumWx').textContent = sum.weather;
  $('#sumTitle').textContent = `Day ${sum.day} receipt`;
  const pr = $('#sumProfit');
  pr.textContent = (sum.profit >= 0 ? '+' : '') + money(sum.profit);
  pr.className = 'big ' + (sum.profit >= 0 ? 'pos' : 'neg');
  const row = (k, v, cls) => `<tr><td>${k}</td><td class="num ${cls || ''}">${v}</td></tr>`;
  const cost = v => (v ? '−' : '') + money(v);
  $('#sumTable').innerHTML =
    row('Shoppers served', sum.served) +
    row('Sales', money(sum.revenue), 'hi') +
    (sum.revenue ? row('&nbsp;&nbsp;Cash · Card · UPI', `${money(sum.cashTaken || 0)} · ${money(sum.cardTaken || 0)} · ${money(sum.upiTaken || 0)}`) : '') +
    (sum.overpaid ? row('Too much change given', cost(sum.overpaid), 'lo') : '') +
    (sum.shortChange ? row('Shoppers short-changed', sum.shortChange, 'lo') : '') +
    (sum.declined ? row('Cards declined', sum.declined) : '') +
    row('Stock bought', cost(sum.goods), sum.goods ? 'lo' : '') +
    (sum.upgrades ? row('Upgrades', cost(sum.upgrades), 'lo') : '') +
    row('Rent & bills', cost(sum.rent), 'lo') +
    (sum.wages ? row('Staff wages', cost(sum.wages), 'lo') : '') +
    row('Items shoppers could not find', sum.missed) +
    row('Abandoned baskets', money(sum.lost)) +
    row('Lost to shoplifters', money(sum.stolen), sum.stolen ? 'lo' : '') +
    (sum.recovered ? row('Items recovered from thieves', sum.recovered, 'hi') : '') +
    (sum.slips ? row('Shoppers who slipped', sum.slips, 'lo') : '') +
    (sum.bonus ? row('Goal bonuses', '+' + money(sum.bonus), 'hi') : '') +
    (sum.waste ? row('Thrown away (expired / binned)', money(sum.waste), 'lo') : '') +
    (sum.expiredFix ? row('Fixtures with stock expiring overnight', sum.expiredFix, 'lo') : '') +
    row('Loyalty club members', `${sum.members}${sum.newMembers ? ` (+${sum.newMembers} today)` : ''}`) +
    row('Cash in the till', money(sum.cash)) +
    (sum.lvlName ? row('Store', `Level ${sum.lvl} · ${esc(sum.lvlName)} · ${sum.servedTotal} served in total`) : '') +
    row('Reputation', sum.rep + ' / 100');
  $('#sumCrew').innerHTML = '<thead><tr><th>Clerk</th><th class="num">Stocked</th><th class="num">Scanned</th><th class="num">Served</th><th class="num">Score</th></tr></thead><tbody>' +
    (sum.crew || []).map(c => `<tr><td><span class="sw" style="background:${c.c}"></span>${esc(c.n)}${c.n === sum.mvp ? '<span class="mvp">Employee of the day</span>' : ''}</td><td class="num">${c.stocked}</td><td class="num">${c.scanned}</td><td class="num">${c.served}</td><td class="num">${c.score}</td></tr>`).join('') + '</tbody>';
  $('#sumGoals').innerHTML = (sum.goals || []).map(g => `<tr><td>${g.done ? '✔' : '✘'} ${esc(g.t)}</td><td class="num ${g.done ? 'hi' : 'lo'}">${g.done ? '+' + money(g.reward) : '—'}</td></tr>`).join('');
  $('#summaryPanel').classList.remove('hidden');
}
$('#sumBtn').addEventListener('click', () => { dismissedDay = shownDay; $('#summaryPanel').classList.add('hidden'); send({ t: 'ready' }); });

// ------------------------------------------------------------ join

$('#joinBtn').addEventListener('click', () => {
  if (ws) return;
  const n = $('#nameInput').value.trim() || 'Clerk';
  const pass = $('#passInput').value;
  $('#joinErr').textContent = '';
  store.set('name', n);
  try { sessionStorage.setItem('mm.pass', pass); } catch { /* ignore */ }
  sfx.unlock();
  // a fresh connection after a disconnect starts from a clean slate
  if (scene) { location.href = location.pathname + '?name=' + encodeURIComponent(n); return; }
  leaving = null;
  connect(n, pass);
});
$('#passInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });
$('#nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });
$('#nameInput').value = store.get('name', '');
$('#nameInput').focus();

const auto = new URLSearchParams(location.search).get('name');
let savedPass = '';
try { savedPass = sessionStorage.getItem('mm.pass') || ''; } catch { /* ignore */ }
$('#passInput').value = savedPass;
if (auto) { $('#nameInput').value = auto.slice(0, 12); store.set('name', auto.slice(0, 12)); connect(auto.slice(0, 12), savedPass); }

// ------------------------------------------------------------ touch controls (phones / tablets)

if (isTouch) {
  const stick = $('#stick'), knob = $('#stickKnob');
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); sfx.unlock(); });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return;
    let dx = (e.clientX - cx) / 60, dy = (e.clientY - cy) / 60;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    touch.mx = Math.abs(dx) < 0.12 ? 0 : dx; touch.my = Math.abs(dy) < 0.12 ? 0 : dy;
    knob.style.transform = `translate(${dx * 45}px, ${dy * 45}px)`;
  });
  const endStick = e => { if (e.pointerId !== sid) return; sid = null; touch.mx = touch.my = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  const pad = $('#lookPad');
  let lid = null, lx = 0, ly = 0;
  pad.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; pad.setPointerCapture(lid); });
  pad.addEventListener('pointermove', e => {
    if (e.pointerId !== lid) return;
    const s = 0.005 * settings.sens;
    camYaw -= (e.clientX - lx) * s; camPitch -= (e.clientY - ly) * s * (settings.invert ? -1 : 1);
    camPitch = Math.max(-1.35, Math.min(1.35, camPitch));
    lx = e.clientX; ly = e.clientY;
  });
  const endLook = e => { if (e.pointerId === lid) lid = null; };
  pad.addEventListener('pointerup', endLook); pad.addEventListener('pointercancel', endLook);

  let scanHold = null;
  for (const b of document.querySelectorAll('#touch [data-t]')) {
    const t = b.dataset.t;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); sfx.unlock();
      if (t === 'act') interact();
      else if (t === 'scan') {
        if (state && state.prompt && state.prompt.open === 'drawer') { openDrawer(); return; }
        send({ t: 'scan' }); clearInterval(scanHold); scanHold = setInterval(() => send({ t: 'scan' }), 220);
      }
      else if (t === 'drop') { send({ t: 'drop' }); sfx.drop(); }
      else if (t === 'pull') send({ t: 'pull' });
      else if (t === 'sprint') { touch.sprint = !touch.sprint; b.classList.toggle('on', touch.sprint); }
      else if (t === 'ready') send({ t: 'ready' });
      else if (t === 'chat') openChat();
      else if (t === 'board') { boardOpen = !boardOpen; $('#board').classList.toggle('hidden', !boardOpen); renderBoard(); }
      else togglePanel(t);
    });
    if (t === 'scan') for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearInterval(scanHold));
  }
}

// Debug/test handle (module scope isn't global).
window.__mm = {
  get state() { return state; },
  get me() { return me; },
  get world() { return world; },
  get myId() { return myId; },
  get yaw() { return camYaw; },
  get scene() { return scene; },
  touch,
  send,
  look(yaw, pitch) { camYaw = yaw; if (typeof pitch === 'number') camPitch = pitch; },
};
