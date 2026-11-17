/* MiniMart Mayhem - product packaging: printed artwork (canvas) and pack shapes.
 * All brands and artwork are original; sizes and MRPs mirror real Indian shelf prices. */
import * as THREE from './vendor/three.module.js';

const FONT = '"Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", "Segoe UI", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

const DESC = {
  bread: 'Sandwich Bread', rice: 'Basmati Rice', cola: 'Cola', chips: 'Salted Potato Chips', soap: 'Neem & Tulsi Soap',
  coffee: 'Instant Coffee', noodles: 'Masala Cup Noodles', biscuit: 'Glucose Biscuits', tea: 'Strong Assam Tea',
  cereal: 'Corn Flakes', shampoo: 'Smooth & Shine Shampoo', paste: 'Fluoride Toothpaste', detergent: 'Detergent Powder',
  choc: 'Milk Chocolate', oil: 'Refined Sunflower Oil', atta: 'Whole Wheat Atta', milk: 'Toned Milk', eggs: 'Farm Eggs',
  paneer: 'Fresh Paneer', curd: 'Thick Dahi', butter: 'Salted Butter', juice: '100% Orange Juice',
  icecream: 'Vanilla Ice Cream', peas: 'Green Peas', pizza: 'Margherita Pizza',
};
const NON_FOOD = new Set(['soap', 'shampoo', 'paste', 'detergent']);

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f > 0) c.lerp(new THREE.Color(1, 1, 1), f); else c.multiplyScalar(1 + f);
  return '#' + c.getHexString();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opts.wrap) { t.wrapS = THREE.RepeatWrapping; t.offset.x = 0.5; }
  return t;
}
function fit(g, text, maxW, size, weight = 700, font = FONT) {
  let s = size;
  do { g.font = `${weight} ${s}px ${font}`; s -= 1; } while (g.measureText(text).width > maxW && s > 8);
}

// ---------------------------------------------------------------- illustrations
function illo(g, art, x, y, r, p) {
  const c2 = p.c2 || '#ffffff';
  g.save();
  g.translate(x, y);
  const circ = (cx, cy, rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.fill(); };
  switch (art) {
    case 'bread': {
      g.fillStyle = '#e6b06a'; rr(g, -r, -r * 0.7, r * 2, r * 1.5, r * 0.6); g.fill();
      g.fillStyle = '#f7e2b5'; rr(g, -r * 0.78, -r * 0.48, r * 1.56, r * 1.1, r * 0.45); g.fill();
      break;
    }
    case 'rice': case 'atta': {
      for (let i = 0; i < 9; i++) {
        const a = -1.1 + i * 0.28;
        g.save(); g.rotate(a); g.fillStyle = art === 'rice' ? '#fbf6e6' : '#e8c27a';
        g.beginPath(); g.ellipse(0, -r * 0.55, r * 0.11, r * 0.32, 0, 0, 7); g.fill(); g.restore();
      }
      g.strokeStyle = art === 'rice' ? '#c9a24a' : '#8a5a1f'; g.lineWidth = r * 0.06;
      g.beginPath(); g.moveTo(0, r * 0.9); g.lineTo(0, -r * 0.2); g.stroke();
      break;
    }
    case 'cola': {
      g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.16;
      g.beginPath(); g.moveTo(-r * 1.2, r * 0.3); g.bezierCurveTo(-r * 0.4, -r * 0.6, r * 0.4, r * 0.8, r * 1.2, -r * 0.2); g.stroke();
      for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(-r * 0.6 + i * r * 0.25, -r * 0.5 - (i % 3) * r * 0.15, r * 0.07, 0, 7); g.stroke(); }
      break;
    }
    case 'chips': {
      for (let i = 0; i < 5; i++) {
        g.save(); g.rotate(-0.6 + i * 0.3); g.translate(0, -r * 0.1);
        g.fillStyle = i % 2 ? '#f7d36b' : '#f0be3c';
        g.beginPath(); g.ellipse(0, -r * 0.45, r * 0.42, r * 0.3, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(160,90,20,.35)'; circ(r * 0.1, -r * 0.5, r * 0.04, g.fillStyle); g.restore();
      }
      break;
    }
    case 'soap': case 'shampoo': {
      for (let i = 0; i < 5; i++) {
        g.save(); g.rotate(i * 1.25);
        g.fillStyle = i % 2 ? '#3f9d5a' : '#6cc36f';
        g.beginPath(); g.ellipse(0, -r * 0.45, r * 0.2, r * 0.48, 0, 0, 7); g.fill(); g.restore();
      }
      circ(0, 0, r * 0.18, art === 'shampoo' ? '#f7d6ff' : '#ffffff');
      break;
    }
    case 'coffee': case 'tea': {
      g.fillStyle = '#ffffff'; rr(g, -r * 0.7, -r * 0.2, r * 1.2, r * 0.95, r * 0.25); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.12; g.beginPath(); g.arc(r * 0.55, r * 0.25, r * 0.25, -1.4, 1.4); g.stroke();
      g.fillStyle = art === 'coffee' ? '#5a3418' : '#a0522d'; rr(g, -r * 0.6, -r * 0.12, r, r * 0.2, 4); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = r * 0.06;
      for (const dx of [-0.3, 0, 0.3]) { g.beginPath(); g.moveTo(dx * r - r * 0.1, -r * 0.35); g.quadraticCurveTo(dx * r + r * 0.12, -r * 0.6, dx * r - r * 0.05, -r * 0.9); g.stroke(); }
      break;
    }
    case 'noodles': {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI); g.fill();
      g.strokeStyle = '#f4c94a'; g.lineWidth = r * 0.07;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-r * 0.85, r * 0.05 + i * r * 0.1); for (let k = 0; k < 8; k++) g.quadraticCurveTo(-r * 0.85 + (k + 0.5) * r * 0.22, i * r * 0.1 + (k % 2 ? -r * 0.12 : r * 0.12), -r * 0.85 + (k + 1) * r * 0.22, r * 0.05 + i * r * 0.1); g.stroke(); }
      circ(-r * 0.3, -r * 0.05, r * 0.12, '#3fa34d'); circ(r * 0.25, -r * 0.08, r * 0.1, '#e5483b');
      break;
    }
    case 'biscuit': case 'cereal': {
      const n = art === 'biscuit' ? 3 : 7;
      for (let i = 0; i < n; i++) {
        const bx = art === 'biscuit' ? (i - 1) * r * 0.35 : (Math.cos(i * 2.4) * r * 0.5), by = art === 'biscuit' ? (i - 1) * r * 0.2 : (Math.sin(i * 2.4) * r * 0.35);
        g.fillStyle = art === 'biscuit' ? '#e1a95a' : '#f4c25b';
        if (art === 'biscuit') { rr(g, bx - r * 0.55, by - r * 0.38, r * 1.1, r * 0.76, r * 0.12); g.fill(); g.fillStyle = '#b77a35'; for (let k = 0; k < 6; k++) circ(bx - r * 0.35 + (k % 3) * r * 0.35, by - r * 0.15 + Math.floor(k / 3) * r * 0.3, r * 0.04, '#b77a35'); }
        else { g.beginPath(); g.ellipse(bx, by, r * 0.3, r * 0.22, i, 0, 7); g.fill(); }
      }
      if (art === 'cereal') { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, r * 0.55, r * 1.1, r * 0.35, 0, 0, Math.PI); g.fill(); }
      break;
    }
    case 'paste': {
      g.fillStyle = '#ffffff'; rr(g, -r * 1.1, -r * 0.18, r * 2, r * 0.36, r * 0.18); g.fill();
      g.fillStyle = '#e23b3b'; rr(g, -r * 1.1, -r * 0.18, r * 0.5, r * 0.36, r * 0.1); g.fill();
      for (let i = 0; i < 3; i++) circ(r * 0.95, -r * 0.3 + i * r * 0.3, r * 0.08, 'rgba(255,255,255,.9)');
      break;
    }
    case 'detergent': {
      for (let i = 0; i < 9; i++) circ(Math.cos(i * 2.1) * r * 0.6, Math.sin(i * 2.1) * r * 0.45, r * (0.18 + (i % 3) * 0.06), 'rgba(255,255,255,.85)');
      g.strokeStyle = '#ffd23f'; g.lineWidth = r * 0.1; g.beginPath(); g.arc(0, 0, r * 0.95, 0, 7); g.stroke();
      break;
    }
    case 'choc': {
      for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 3; xx++) { g.fillStyle = '#5a2d14'; rr(g, -r + xx * r * 0.68, -r * 0.5 + yy * r * 0.55, r * 0.6, r * 0.48, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-r + xx * r * 0.68 + 3, -r * 0.5 + yy * r * 0.55 + 3, r * 0.6 - 6, 4); }
      break;
    }
    case 'oil': {
      circ(0, 0, r * 0.4, '#5a3a12');
      for (let i = 0; i < 14; i++) { g.save(); g.rotate(i * Math.PI / 7); g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(0, -r * 0.72, r * 0.14, r * 0.32, 0, 0, 7); g.fill(); g.restore(); }
      break;
    }
    case 'milk': case 'curd': case 'paneer': case 'butter': {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(-r, r * 0.2); g.bezierCurveTo(-r * 0.6, -r * 0.6, -r * 0.2, r * 0.1, 0, -r * 0.5); g.bezierCurveTo(r * 0.2, r * 0.1, r * 0.6, -r * 0.6, r, r * 0.2); g.lineTo(r, r); g.lineTo(-r, r); g.closePath(); g.fill();
      if (art === 'paneer') { g.fillStyle = '#fff6d8'; rr(g, -r * 0.45, -r * 0.1, r * 0.9, r * 0.6, 6); g.fill(); g.strokeStyle = '#e8d9a8'; g.lineWidth = 2; g.stroke(); }
      if (art === 'butter') { g.fillStyle = '#f7d84a'; rr(g, -r * 0.55, -r * 0.05, r * 1.1, r * 0.5, 6); g.fill(); }
      break;
    }
    case 'eggs': {
      for (let i = 0; i < 3; i++) { g.fillStyle = i === 1 ? '#fff6e5' : '#e9c896'; g.beginPath(); g.ellipse((i - 1) * r * 0.6, 0, r * 0.32, r * 0.42, 0, 0, 7); g.fill(); }
      break;
    }
    case 'juice': {
      circ(0, 0, r * 0.85, '#f39c12'); circ(0, 0, r * 0.72, '#ffc04d');
      g.strokeStyle = '#ffe7b0'; g.lineWidth = 3;
      for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i * Math.PI / 4) * r * 0.7, Math.sin(i * Math.PI / 4) * r * 0.7); g.stroke(); }
      g.fillStyle = '#2e7d32'; g.beginPath(); g.ellipse(r * 0.55, -r * 0.85, r * 0.3, r * 0.14, -0.5, 0, 7); g.fill();
      break;
    }
    case 'icecream': {
      g.fillStyle = '#d9a35a'; g.beginPath(); g.moveTo(-r * 0.45, 0); g.lineTo(0, r); g.lineTo(r * 0.45, 0); g.fill();
      circ(0, -r * 0.2, r * 0.5, '#fff5dc'); circ(-r * 0.25, -r * 0.55, r * 0.35, '#f4a6c6'); circ(r * 0.25, -r * 0.5, r * 0.32, '#fff5dc');
      break;
    }
    case 'peas': {
      g.fillStyle = '#3c9b3c'; g.beginPath(); g.ellipse(0, 0, r, r * 0.38, -0.3, 0, 7); g.fill();
      for (let i = 0; i < 5; i++) circ(-r * 0.6 + i * r * 0.3, -r * 0.05 + (i - 2) * r * 0.06, r * 0.15, '#79d36b');
      break;
    }
    case 'pizza': {
      circ(0, 0, r, '#e0a24e'); circ(0, 0, r * 0.82, '#d8452e');
      for (let i = 0; i < 6; i++) circ(Math.cos(i) * r * 0.5, Math.sin(i * 1.7) * r * 0.45, r * 0.16, '#fff3c8');
      for (let i = 0; i < 4; i++) circ(Math.cos(i * 1.6 + 1) * r * 0.3, Math.sin(i * 1.6 + 1) * r * 0.3, r * 0.08, '#2e7d32');
      break;
    }
    default: circ(0, 0, r * 0.8, c2);
  }
  g.restore();
}

function vegMark(g, x, y, s, veg = true) {
  g.fillStyle = '#ffffff'; g.fillRect(x, y, s, s);
  g.strokeStyle = veg ? '#1e8a3a' : '#a5291b'; g.lineWidth = Math.max(2, s * 0.1); g.strokeRect(x + 1, y + 1, s - 2, s - 2);
  g.fillStyle = veg ? '#1e8a3a' : '#a5291b'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.26, 0, 7); g.fill();
}

function barcode(g, x, y, w, h, seed) {
  const r = rng(seed * 977 + 13);
  g.fillStyle = '#ffffff'; g.fillRect(x - 4, y - 4, w + 8, h + 20);
  g.fillStyle = '#111';
  let cx = x;
  while (cx < x + w) { const bw = 1 + Math.floor(r() * 3); if (r() > 0.45) g.fillRect(cx, y, bw, h); cx += bw + 1; }
  g.font = `600 ${Math.round(h * 0.28)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
  g.fillText('8 901234 ' + String(10000 + seed * 371).slice(-5) + ' ' + (seed % 10), x + w / 2, y + h + 2);
}

// ---------------------------------------------------------------- printed faces

function drawFront(g, W, H, p) {
  const c = p.color, c2 = p.c2 || '#ffffff', art = p.art;
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, shade(c, 0.12)); gr.addColorStop(1, shade(c, -0.18));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // diagonal accent band
  g.fillStyle = shade(c2, 0); g.globalAlpha = 0.9;
  g.beginPath(); g.moveTo(0, H * 0.72); g.lineTo(W, H * 0.6); g.lineTo(W, H * 0.68); g.lineTo(0, H * 0.8); g.fill();
  g.globalAlpha = 1;
  // brand wordmark
  const dark = new THREE.Color(c).getHSL({}).l > 0.62;
  g.fillStyle = dark ? '#1d2430' : '#ffffff';
  g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 6;
  fit(g, p.brand, W * 0.86, Math.round(H * 0.11), 700, art === 'tea' || art === 'coffee' ? SERIF : FONT);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(p.brand, W / 2, H * 0.1);
  g.shadowBlur = 0;
  // window / illustration disc
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(W / 2, H * 0.42, W * 0.32, 0, 7); g.fill();
  illo(g, art, W / 2, H * 0.42, W * 0.24, p);
  // descriptor
  g.fillStyle = dark ? '#1d2430' : '#ffffff';
  const desc = p.desc || DESC[art] || p.name;
  fit(g, desc, W * 0.9, Math.round(H * 0.07), 700);
  g.fillText(desc, W / 2, H * 0.68);
  // size badge, veg mark, MRP
  g.fillStyle = '#ffffff'; rr(g, W * 0.06, H * 0.82, W * 0.38, H * 0.1, H * 0.03); g.fill();
  g.fillStyle = '#1d2430'; fit(g, p.size, W * 0.34, Math.round(H * 0.07), 700); g.fillText(p.size, W * 0.25, H * 0.872);
  if (!NON_FOOD.has(art)) vegMark(g, W * 0.82, H * 0.82, H * 0.1, art !== 'eggs');
  g.fillStyle = dark ? 'rgba(20,30,40,.75)' : 'rgba(255,255,255,.85)';
  g.font = `500 ${Math.round(H * 0.035)}px ${FONT}`;
  g.fillText(`MRP ₹${p.base} incl. of all taxes`, W / 2, H * 0.965);
}

function drawSide(g, W, H, p) {
  g.fillStyle = shade(p.color, 0.55); g.fillRect(0, 0, W, H);
  g.fillStyle = shade(p.color, -0.1); g.fillRect(0, 0, W, H * 0.08);
  g.fillStyle = '#1d2430'; g.textAlign = 'left'; g.textBaseline = 'top';
  const food = !NON_FOOD.has(p.art);
  g.font = `700 ${Math.round(W * 0.075)}px ${FONT}`;
  g.fillText(food ? 'Nutrition per 100 g' : 'Directions', W * 0.08, H * 0.12);
  const r = rng(p.id + 7);
  const rows = food
    ? [['Energy', `${Math.round(60 + r() * 450)} kcal`], ['Protein', `${(r() * 12).toFixed(1)} g`], ['Carbohydrate', `${(r() * 70).toFixed(1)} g`], ['Total fat', `${(r() * 30).toFixed(1)} g`], ['Sodium', `${Math.round(r() * 600)} mg`]]
    : [['Use', 'as directed'], ['Store', 'cool, dry place'], ['Keep', 'away from eyes'], ['For', 'external use'], ['Made in', 'India']];
  g.font = `500 ${Math.round(W * 0.062)}px ${FONT}`;
  rows.forEach(([k, v], i) => {
    const y = H * (0.2 + i * 0.065);
    g.fillText(k, W * 0.08, y);
    g.textAlign = 'right'; g.fillText(v, W * 0.92, y); g.textAlign = 'left';
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(W * 0.08, y + W * 0.075, W * 0.84, 1); g.fillStyle = '#1d2430';
  });
  g.font = `500 ${Math.round(W * 0.055)}px ${FONT}`;
  g.fillText(p.life ? `Best before ${p.life} days from packing` : 'Best before 9 months', W * 0.08, H * 0.56);
  g.fillText(`Net qty ${p.size}`, W * 0.08, H * 0.61);
  g.fillText(`MRP ₹${p.base}.00`, W * 0.08, H * 0.66);
  barcode(g, W * 0.12, H * 0.74, W * 0.76, H * 0.12, p.id + 1);
}

function drawWrap(g, W, H, p, o) {
  // a label wrapped round a turned shape; o.v0..o.v1 is the side wall (texture v), the rest is cap colour
  g.fillStyle = o.capColor || '#c9ced4'; g.fillRect(0, 0, W, H);
  const y0 = H * (1 - o.v1), y1 = H * (1 - o.v0);
  const lh = y1 - y0;
  const sub = canvas(Math.round(lh * 0.72), Math.round(lh));
  drawFront(sub.getContext('2d'), sub.width, sub.height, p);
  // the front art centred, the side panel on the back
  const side = canvas(Math.round(lh * 0.5), Math.round(lh));
  drawSide(side.getContext('2d'), side.width, side.height, p);
  g.fillStyle = shade(p.color, -0.05); g.fillRect(0, y0, W, lh);
  g.drawImage(sub, W / 2 - sub.width / 2, y0);
  g.drawImage(side, 0 - side.width * 0.15, y0, side.width * 0.9, lh);
  g.drawImage(side, W - side.width * 0.75, y0, side.width * 0.9, lh);
  if (o.ring) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y0, W, 3); g.fillRect(0, y1 - 3, W, 3); }
}

// ---------------------------------------------------------------- geometry helpers

function resample(pts, n) {
  // even spacing along the profile so texture v follows height evenly
  const seg = [], L = [0];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L.push(L[i - 1] + d); }
  const total = L[L.length - 1], out = [];
  for (let k = 0; k < n; k++) {
    const t = total * k / (n - 1);
    let i = 1; while (i < L.length - 1 && L[i] < t) i++;
    const f = seg[i - 1] ? (t - L[i - 1]) / seg[i - 1] : 0;
    out.push(new THREE.Vector2(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f));
  }
  return { pts: out, frac: L.map(l => l / total) };
}

// turned shape; the label covers profile points li0..li1 (texture v measured along the outline)
function lathe(profile, segs = 22, li0 = 0, li1 = profile.length - 1) {
  const { pts, frac } = resample(profile, 48);
  const g = new THREE.LatheGeometry(pts, segs);
  g.computeVertexNormals();
  g.userData = { v0: frac[li0], v1: frac[li1] };
  return g;
}

// soft pack: a box whose faces bulge and whose ends crimp flat (chips, pouches, sacks)
function pillow(w, h, d, crimp = 0.12, lying = false) {
  const g = new THREE.BoxGeometry(w, h, d, 6, 8, 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ny = y / (h / 2), nx = x / (w / 2);
    const edge = Math.max(0, (Math.abs(ny) - (1 - crimp)) / crimp);
    const bulge = (1 - Math.pow(Math.abs(ny), 4)) * (1 - 0.35 * Math.pow(Math.abs(nx), 4));
    pos.setZ(i, z * Math.max(0.08, bulge * (1 - edge * 0.92)));
    pos.setX(i, x * (1 - 0.05 * edge));
  }
  if (lying) g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function gable(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d, 1, 6, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > h / 2 - 1e-5) pos.setZ(i, 0);
  g.computeVertexNormals();
  return g;
}

function sit(g) { g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); return g; }

// vertex-coloured merge for fresh produce
function mergeColored(parts) {
  let nv = 0, ni = 0;
  const geos = parts.map(([geo, col, m]) => { const g = (geo.index ? geo : geo.toNonIndexed()).clone(); if (m) g.applyMatrix4(m); nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; return [g, new THREE.Color(col)]; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), colA = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const [g, c] of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
    const yMin = (g.computeBoundingBox(), g.boundingBox.min.y), yMax = g.boundingBox.max.y;
    for (let i = 0; i < n; i++) {
      // subtle top-to-bottom gradient so fruit doesn't look flat
      const t = (g.attributes.position.getY(i) - yMin) / Math.max(1e-5, yMax - yMin);
      const k = 0.85 + 0.25 * t;
      colA[(vo + i) * 3] = c.r * k; colA[(vo + i) * 3 + 1] = c.g * k; colA[(vo + i) * 3 + 2] = c.b * k;
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
const M = (x, y, z, s = 1, rx = 0, rz = 0, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(s, sy, s));

function produceGeo(shape, color) {
  switch (shape) {
    case 'apple': {
      const body = lathe([[0, 0.01], [0.035, 0], [0.058, 0.03], [0.062, 0.06], [0.05, 0.095], [0.02, 0.1], [0.006, 0.092], [0, 0.088]], 18);
      return mergeColored([[body, color], [new THREE.CylinderGeometry(0.004, 0.005, 0.03, 5), '#5b3a1e', M(0.004, 0.1, 0, 1, 0, 0.3)], [new THREE.SphereGeometry(0.014, 6, 4), '#3f8a2a', M(0.02, 0.105, 0, 1, 0, 0, 0.35)]]);
    }
    case 'tomato': {
      const body = lathe([[0, 0.005], [0.03, 0], [0.055, 0.02], [0.06, 0.042], [0.05, 0.068], [0.02, 0.078], [0, 0.076]], 18);
      const leaves = [];
      for (let i = 0; i < 5; i++) leaves.push([new THREE.ConeGeometry(0.008, 0.03, 4), '#2f7a2a', new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(i * 1.256) * 0.012, 0.079, Math.sin(i * 1.256) * 0.012), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(i * 1.256) * 1.4, 0, -Math.cos(i * 1.256) * 1.4)), new THREE.Vector3(1, 1, 1))]);
      return mergeColored([[body, color], ...leaves]);
    }
    case 'onion': {
      const body = lathe([[0, 0], [0.012, 0.002], [0.05, 0.03], [0.058, 0.055], [0.04, 0.085], [0.012, 0.11], [0.003, 0.13], [0, 0.13]], 16);
      return mergeColored([[body, color]]);
    }
    case 'potato': {
      const g = new THREE.IcosahedronGeometry(0.05, 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const n = 1 + 0.08 * Math.sin(x * 90) * Math.cos(z * 70 + y * 40); pos.setXYZ(i, x * 1.35 * n, y * 0.8 * n + 0.04, z * n); }
      g.computeVertexNormals();
      return mergeColored([[g, color]]);
    }
    case 'banana': {
      const parts = [];
      for (let i = 0; i < 4; i++) {
        const a = (i - 1.5) * 0.25;
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0.09, 0.0, 0.0), new THREE.Vector3(0.17, 0.07, 0));
        const tube = new THREE.TubeGeometry(curve, 10, 0.017, 6, false);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(-0.08, 0.02 + i * 0.005, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1));
        parts.push([tube, color, m]);
      }
      parts.push([new THREE.CylinderGeometry(0.01, 0.012, 0.04, 5), '#5a4a1a', M(-0.09, 0.03, 0, 1, 0, 1.3)]);
      return mergeColored(parts);
    }
  }
  return null;
}

// ---------------------------------------------------------------- public API

// Returns { geometry, material } ready for an InstancedMesh.
export function productMesh(p) {
  const prod = produceGeo(p.shape, p.color);
  if (prod) {
    sit(prod);
    return { geometry: prod, material: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: p.shape === 'tomato' || p.shape === 'apple' ? 70 : 12, specular: 0x333333 }), produce: true };
  }

  const front = canvas(256, 360), side = canvas(128, 360);
  drawFront(front.getContext('2d'), 256, 360, p);
  drawSide(side.getContext('2d'), 128, 360, p);
  const fT = tex(front), sT = tex(side);
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const glossy = (o) => new THREE.MeshPhongMaterial({ shininess: 60, specular: 0x444444, ...o });
  const top = lam({ color: shade(p.color, -0.15) });
  const boxMats = (soft) => {
    const mk = soft ? glossy : lam;
    return [mk({ map: sT }), mk({ map: sT }), top, top, mk({ map: fT }), mk({ map: fT })];
  };
  const wrapMat = (geo, opts, shiny = true) => {
    const c = canvas(512, 256);
    drawWrap(c.getContext('2d'), 512, 256, p, { ...geo.userData, ...opts });
    return (shiny ? glossy : lam)({ map: tex(c, { wrap: true }) });
  };

  let geometry, material;
  switch (p.shape) {
    case 'can': {
      geometry = lathe([[0, 0], [0.04, 0], [0.047, 0.008], [0.047, 0.15], [0.041, 0.165], [0.039, 0.17], [0, 0.17]], 22, 2, 3);
      material = wrapMat(geometry, { capColor: '#c9ced4' });
      break;
    }
    case 'bottle': {     // shampoo: flattened oval
      geometry = lathe([[0, 0], [0.05, 0], [0.056, 0.02], [0.056, 0.17], [0.045, 0.2], [0.018, 0.215], [0.02, 0.215], [0.02, 0.25], [0, 0.25]], 22, 2, 3);
      geometry.scale(1, 1, 0.6);
      material = wrapMat(geometry, { capColor: p.c2 || '#ffffff' });
      break;
    }
    case 'oil': {
      geometry = lathe([[0, 0], [0.042, 0], [0.046, 0.02], [0.046, 0.19], [0.03, 0.23], [0.016, 0.245], [0.019, 0.25], [0.019, 0.275], [0, 0.275]], 22, 2, 3);
      material = wrapMat(geometry, { capColor: '#e8c21a' });
      break;
    }
    case 'jar': {
      geometry = lathe([[0, 0], [0.04, 0], [0.045, 0.01], [0.045, 0.1], [0.04, 0.11], [0.047, 0.112], [0.047, 0.14], [0, 0.14]], 22, 2, 3);
      material = wrapMat(geometry, { capColor: p.c2 || '#d9a441', ring: true });
      break;
    }
    case 'cup': {
      geometry = lathe([[0, 0], [0.04, 0], [0.056, 0.1], [0.059, 0.105], [0, 0.105]], 22, 1, 2);
      material = wrapMat(geometry, { capColor: '#e9eef2' }, false);
      break;
    }
    case 'tub': case 'icetub': {
      const big = p.shape === 'icetub';
      const r0 = big ? 0.065 : 0.05, r1 = big ? 0.078 : 0.06, h = big ? 0.11 : 0.085;
      geometry = lathe([[0, 0], [r0, 0], [r1, h], [r1 + 0.004, h + 0.004], [r1 + 0.004, h + 0.014], [0, h + 0.014]], 22, 1, 2);
      material = wrapMat(geometry, { capColor: p.c2 || '#ffffff' }, false);
      break;
    }
    case 'chips': geometry = pillow(0.2, 0.27, 0.075, 0.12); material = boxMats(true); break;
    case 'bag': geometry = pillow(0.17, 0.25, 0.07, 0.08); material = boxMats(true); break;
    case 'sack': geometry = pillow(0.26, 0.38, 0.11, 0.06); material = boxMats(true); break;
    case 'pouch': geometry = pillow(0.15, 0.21, 0.06, 0.14); material = boxMats(true); break;
    case 'biscuit': geometry = pillow(0.07, 0.2, 0.05, 0.12); geometry.rotateZ(Math.PI / 2); material = boxMats(true); break;
    case 'loaf': {
      geometry = new THREE.BoxGeometry(0.26, 0.13, 0.12, 4, 4, 2);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y > 0) pos.setY(i, y + 0.03 * (1 - Math.pow(pos.getZ(i) / 0.06, 2))); }
      geometry.computeVertexNormals();
      material = boxMats(true);
      break;
    }
    case 'carton': geometry = gable(0.09, 0.22, 0.09); material = boxMats(false); break;
    case 'eggs': geometry = new THREE.BoxGeometry(0.22, 0.07, 0.11); material = boxMats(false); material[2] = lam({ map: eggTopTex() }); break;
    case 'block': geometry = new THREE.BoxGeometry(0.13, 0.05, 0.085); material = boxMats(false); material[2] = lam({ map: fT }); break;
    case 'bar': geometry = new THREE.BoxGeometry(0.17, 0.022, 0.08); material = boxMats(true); material[2] = glossy({ map: fT }); break;
    case 'flat': geometry = new THREE.BoxGeometry(0.28, 0.04, 0.28); material = boxMats(false); material[2] = lam({ map: fT }); break;
    case 'soap': geometry = new THREE.BoxGeometry(0.1, 0.065, 0.035); material = boxMats(false); break;
    case 'paste': geometry = new THREE.BoxGeometry(0.2, 0.05, 0.05); material = boxMats(false); break;
    case 'tallbox': geometry = new THREE.BoxGeometry(0.2, 0.3, 0.07); material = boxMats(false); break;
    default: geometry = new THREE.BoxGeometry(0.13, 0.17, 0.06); material = boxMats(false);
  }
  sit(geometry);
  if (Array.isArray(material)) material = collapseGroups(geometry, material);
  return { geometry, material };
}

// A box's six faces are six draw calls even when only three materials differ. Merge neighbouring
// faces that share a material into one group, so each product costs as few draws as possible.
function collapseGroups(geo, mats) {
  if (!geo.groups.length || !geo.index) return mats;
  const order = [], byMat = new Map();
  for (const gr of geo.groups) {
    const m = mats[gr.materialIndex];
    if (!byMat.has(m)) { byMat.set(m, []); order.push(m); }
    byMat.get(m).push(gr);
  }
  if (order.length === geo.groups.length) return mats;
  const src = geo.index.array, out = new (src.constructor)(src.length);
  let o = 0;
  geo.clearGroups();
  order.forEach((m, mi) => {
    const start = o;
    for (const gr of byMat.get(m)) { out.set(src.subarray(gr.start, gr.start + gr.count), o); o += gr.count; }
    geo.addGroup(start, o - start, mi);
  });
  geo.setIndex(new THREE.BufferAttribute(out, 1));
  return order;
}

function eggTopTex() {
  const c = canvas(128, 64), g = c.getContext('2d');
  g.fillStyle = '#c9a66b'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 6; i++) { const x = 22 + (i % 3) * 42, y = 16 + Math.floor(i / 3) * 32; const r = g.createRadialGradient(x - 4, y - 4, 2, x, y, 16); r.addColorStop(0, '#e8cf9e'); r.addColorStop(1, '#a8834a'); g.fillStyle = r; g.beginPath(); g.arc(x, y, 15, 0, 7); g.fill(); }
  return tex(c);
}

// Printed supplier carton: the product's artwork on the front, cardboard everywhere else.
export function cartonMaterials(p) {
  const front = canvas(256, 256), g = front.getContext('2d');
  g.fillStyle = '#b5844b'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(80,50,20,.16)'; for (let i = 0; i < 256; i += 7) g.fillRect(i, 0, 2, 256);
  g.fillStyle = 'rgba(230,220,190,.6)'; g.fillRect(112, 0, 32, 256);
  const art = canvas(150, 210);
  if (produceGeo(p.shape, p.color)) {
    const a = art.getContext('2d'); a.fillStyle = '#2e7d32'; a.fillRect(0, 0, 150, 210);
    a.fillStyle = p.color; for (let i = 0; i < 9; i++) { a.beginPath(); a.arc(30 + (i % 3) * 45, 50 + Math.floor(i / 3) * 45, 18, 0, 7); a.fill(); }
    a.fillStyle = '#fff'; a.font = `700 22px ${FONT}`; a.textAlign = 'center'; a.fillText('FRESH', 75, 196);
  } else drawFront(art.getContext('2d'), 150, 210, p);
  g.drawImage(art, 16, 24, 110, 154);
  g.fillStyle = '#2b1d10'; g.font = `700 22px ${FONT}`; g.textAlign = 'left';
  fit(g, p.name.toUpperCase(), 100, 22); g.fillText(p.name.toUpperCase(), 136, 60);
  g.font = `600 17px ${FONT}`; g.fillText(`${p.per} × ${p.size}`, 136, 90);
  g.font = `500 14px ${FONT}`; g.fillText('THIS SIDE UP ↑', 136, 120);
  barcode(g, 140, 196, 100, 30, p.id + 50);
  const side = canvas(128, 128), s = side.getContext('2d');
  s.fillStyle = '#ad7c44'; s.fillRect(0, 0, 128, 128);
  s.fillStyle = 'rgba(80,50,20,.16)'; for (let i = 0; i < 128; i += 7) s.fillRect(i, 0, 2, 128);
  s.strokeStyle = '#2b1d10'; s.lineWidth = 5; s.beginPath(); s.moveTo(40, 90); s.lineTo(40, 40); s.moveTo(28, 52); s.lineTo(40, 38); s.lineTo(52, 52);
  s.moveTo(88, 90); s.lineTo(88, 40); s.moveTo(76, 52); s.lineTo(88, 38); s.lineTo(100, 52); s.stroke();
  const L = o => new THREE.MeshLambertMaterial(o);
  const fm = L({ map: tex(front) }), sm = L({ map: tex(side) }), tm = L({ color: 0xb08048 });
  return [sm, sm, tm, tm, fm, fm];
}

export { drawFront };
