/* MiniMart Mayhem - detailed store props: potted plants, checkout counters, fridge and freezer
 * trim, produce stands, baskets, ceiling fittings and signage. Everything here is static, so it
 * goes through the scene's batcher and costs one draw call per material, however many props.
 */
import * as THREE from './vendor/three.module.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FONT = '"Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", "Segoe UI", sans-serif';

// A leaf as a bent strip running along +z from the origin: it rises, then droops, with a
// shallow V-fold along the midrib. The texture's alpha gives it its outline.
function leafGeometry(len, wid, rise, droop, segs = 7) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = len * t, y = rise * t - droop * t * t;
    for (let j = 0; j < 3; j++) {
      const u = j / 2, x = (u - 0.5) * wid;
      pos.push(x, y + (j === 1 ? wid * 0.12 : 0), z);
      uv.push(u, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < 2; j++) {
    const a = i * 3 + j, b = a + 1, c = a + 3, d = a + 4;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Props {
  constructor(sc) {
    this.sc = sc;
    this.M = sc.M;
    this.G = {
      pot: new THREE.CylinderGeometry(0.5, 0.37, 1, 24),
      rim: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
      disc: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
      sph: new THREE.SphereGeometry(0.5, 12, 8),
      pebble: new THREE.IcosahedronGeometry(0.5, 0),
      hemi: new THREE.SphereGeometry(0.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      frond: leafGeometry(1, 0.42, 0.55, 0.95),
      broad: leafGeometry(1, 0.62, 0.12, 0.28, 4),
      blade: leafGeometry(1, 0.16, 0.0, 0.06, 5),
      plane: new THREE.PlaneGeometry(1, 1),
      crown: new THREE.IcosahedronGeometry(0.5, 2),
      crownLo: new THREE.IcosahedronGeometry(0.5, 1),   // background trees
    };
    // knock the crown sphere out of round so clusters don't look like balls
    for (const geo of [this.G.crown, this.G.crownLo]) {
      const p = geo.attributes.position, r = rng(21);
      for (let i = 0; i < p.count; i++) { const k = 0.82 + r() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
      geo.computeVertexNormals();
    }
    this.buildMaterials();
  }

  // ---------------------------------------------------------------- materials + textures
  buildMaterials() {
    const lam = (c, x = {}) => new THREE.MeshLambertMaterial({ color: c, ...x });
    const phong = (c, x = {}) => new THREE.MeshPhongMaterial({ color: c, ...x });
    const env = this.sc.envTex;
    const leafMat = map => { const m = lam(0xffffff, { map, alphaTest: 0.5, side: THREE.DoubleSide }); m.userData.cast = false; return m; };

    // pinnate palm frond: a stem with narrow leaflets swept forward
    const frondTex = canvasTex(128, 512, (g, w, h) => {
      const r = rng(3);
      for (let y = 16; y < h - 10; y += 9) {
        const t = y / h, L = w * 0.48 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08));
        for (const s of [-1, 1]) {
          const sh = 70 + r() * 40;
          g.strokeStyle = `rgb(${40 + r() * 25},${sh + 40},${30 + r() * 20})`; g.lineWidth = 5;
          g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + s * L * 0.6, y + 10, w / 2 + s * L, y + 34); g.stroke();
        }
      }
      g.strokeStyle = '#5d7a2c'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    });
    // broad glossy leaf (rubber plant / ficus) with a midrib and veins
    const broadTex = canvasTex(128, 256, (g, w, h) => {
      g.save(); g.beginPath(); g.moveTo(w / 2, 4);
      g.bezierCurveTo(w * 1.02, h * 0.25, w * 0.95, h * 0.8, w / 2, h - 2);
      g.bezierCurveTo(w * 0.05, h * 0.8, -w * 0.02, h * 0.25, w / 2, 4); g.closePath(); g.clip();
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, '#2c6a2a'); gr.addColorStop(0.5, '#4f9a3c'); gr.addColorStop(1, '#2f6e2c');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(200,235,160,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
      g.lineWidth = 1.5;
      for (let y = 30; y < h - 20; y += 22) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + s * 25, y + 6, w / 2 + s * 55, y + 26); g.stroke(); }
      g.restore();
    });
    // snake plant: banded sword leaf with a yellow edge
    const bladeTex = canvasTex(64, 512, (g, w, h) => {
      // base at the top of the canvas (v = 0), pointed tip at the bottom
      g.save(); g.beginPath(); g.moveTo(w * 0.1, 0); g.lineTo(w * 0.12, h * 0.8); g.quadraticCurveTo(w / 2, h + 10, w * 0.88, h * 0.8); g.lineTo(w * 0.9, 0); g.closePath(); g.clip();
      g.fillStyle = '#d7c94a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2f5e2a'; g.fillRect(w * 0.2, 0, w * 0.6, h);
      const r = rng(8);
      for (let y = 0; y < h; y += 14 + r() * 10) { g.fillStyle = `rgba(${r() < 0.5 ? '160,200,120' : '20,50,20'},.45)`; g.fillRect(w * 0.2, y, w * 0.6, 5); }
      g.restore();
    });
    // flip the uv so the stem end is at the pot
    for (const t of [frondTex, broadTex, bladeTex]) { t.flipY = false; }

    this.mat = {
      frond: leafMat(frondTex), broad: leafMat(broadTex), blade: leafMat(bladeTex),
      ceramic: phong(0xf1efe9, { shininess: 60, specular: 0x444444, envMap: env, reflectivity: 0.12 }),
      terracotta: lam(0xb8633a), charcoal: phong(0x2e3236, { shininess: 40, specular: 0x333333 }),
      soil: lam(0x3a2a1c), bark: lam(0x6b4a2f), pebble: lam(0xb9b2a4),
      steel: phong(0xc9ced4, { shininess: 90, specular: 0x888888, envMap: env, reflectivity: 0.5 }),
      laminate: lam(0xf4f4f1), counterTop: phong(0x30353b, { shininess: 70, specular: 0x555555, envMap: env, reflectivity: 0.15 }),
      darkGlass: phong(0x1a2430, { shininess: 100, specular: 0xffffff, envMap: env, reflectivity: 0.35 }),
      laser: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
      screenOn: new THREE.MeshBasicMaterial({ color: 0x9fd8ff }),
      paper: lam(0xfbfaf4), red: lam(0xd8342c), redPlastic: phong(0xd8342c, { shininess: 50, specular: 0x444444 }),
      bluePlastic: phong(0x2f6fbf, { shininess: 50, specular: 0x444444 }),
      kick: lam(0x3a4048), grille: null, white: lam(0xfafafa), black: lam(0x1b1e22), wood: lam(0x9a6a3c), woodDark: lam(0x5d3d22),
      chalk: null, exit: new THREE.MeshBasicMaterial({ color: 0x1fa85a }), glow: new THREE.MeshBasicMaterial({ color: 0xf0fbff }),
      domeGlass: phong(0x111418, { shininess: 120, specular: 0xffffff, envMap: env, reflectivity: 0.45, transparent: true, opacity: 0.85 }),
    };
    this.mat.grille = lam(0xffffff, { map: canvasTex(128, 32, (g, w, h) => {
      g.fillStyle = '#3a4048'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d2126'; for (let x = 4; x < w; x += 8) g.fillRect(x, 6, 4, h - 12);
    }, { repeat: [6, 1] }) });
    this.mat.counterFront = lam(0xffffff, { map: canvasTex(1024, 190, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#22895a'); gr.addColorStop(1, '#176a43');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2c230'; g.fillRect(0, h * 0.18, w, 6);
      g.fillStyle = 'rgba(255,255,255,.95)'; g.font = `700 ${h * 0.36}px ${FONT}`; g.textBaseline = 'middle';
      g.fillText('MiniMart', 40, h * 0.58);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `500 ${h * 0.15}px ${FONT}`; g.textAlign = 'right';
      g.fillText('Thank you for shopping with us', w - 40, h * 0.62);
    }) });
    this.mat.keypad = lam(0xffffff, { map: canvasTex(64, 96, (g, w, h) => {
      g.fillStyle = '#23272c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9fd8ff'; g.fillRect(6, 6, w - 12, 30);
      g.fillStyle = '#0f3d2e'; g.font = `700 13px ${FONT}`; g.fillText('PAY', 10, 26);
      for (let i = 0; i < 12; i++) { g.fillStyle = i === 9 ? '#e5483b' : i === 11 ? '#2f9a5e' : '#d6dbe0'; g.fillRect(8 + (i % 3) * 17, 42 + Math.floor(i / 3) * 13, 13, 9); }
    }) });
    this.mat.bagRoll = lam(0xffffff, { map: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#f2f4f1'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1f7a4d'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText('MiniMart', w / 2, h * 0.55);
      g.fillStyle = '#f2c230'; g.fillRect(w * 0.25, h * 0.65, w * 0.5, 4);
    }) });
    this.mat.crate = lam(0xffffff, { map: canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#b98550'; g.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(90,55,25,${0.08 + r() * 0.12})`; g.lineWidth = 1; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 6); g.stroke(); }
      g.fillStyle = 'rgba(60,35,15,.55)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
      g.fillStyle = '#4a3a2a'; for (const x of [10, w - 14]) for (const y of [14, h - 18]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    }) });
    this.mat.basketSide = phong(0xffffff, { shininess: 40, specular: 0x333333, side: THREE.DoubleSide, alphaTest: 0.5, map: canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#d8342c'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      for (let y = 12; y < h - 8; y += 11) for (let x = 6; x < w - 6; x += 11) g.fillRect(x, y, 8, 8);
    }) });
    this.mat.basketSide.userData.cast = false;
    // dappled foliage for tree crowns and hedges
    const foliage = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#3d7a31'; g.fillRect(0, 0, w, h);
      const r = rng(17);
      for (let i = 0; i < 1400; i++) {
        const v = r(); g.fillStyle = v < 0.35 ? 'rgba(25,60,22,.55)' : v < 0.75 ? 'rgba(95,160,70,.5)' : 'rgba(150,200,100,.45)';
        g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 6, 2 + r() * 3, r() * 3, 0, 7); g.fill();
      }
    }, { repeat: [2, 2] });
    this.mat.foliage = lam(0xffffff, { map: foliage });
    this.mat.foliage2 = lam(0xc8e0a0, { map: foliage });
    this.mat.hedge = lam(0xffffff, { map: canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#356d2c'; g.fillRect(0, 0, w, h);
      const r = rng(19);
      for (let i = 0; i < 700; i++) { const v = r(); g.fillStyle = v < 0.4 ? 'rgba(20,50,18,.6)' : 'rgba(110,170,80,.5)'; g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 4, 1.5 + r() * 2, r() * 3, 0, 7); g.fill(); }
    }, { repeat: [8, 1] }) });
    this.mat.turf = lam(0xffffff, { map: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#3f8a35'; g.fillRect(0, 0, w, h);
      const r = rng(5);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,190,90' : '30,80,25'},.6)`; g.fillRect(r() * w, r() * h, 1.5, 4); }
    }, { repeat: [3, 1] }) });
    this.mat.chalk = lam(0xffffff, { map: canvasTex(256, 192, (g, w, h) => {
      g.fillStyle = '#6b4a2f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#25302b'; g.fillRect(10, 10, w - 20, h - 20);
      g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 30, 2);
      g.fillStyle = '#f4f1e6'; g.textAlign = 'center'; g.font = `italic 700 34px Georgia, serif`;
      g.fillText('Fresh', w / 2, 66); g.fillText('today!', w / 2, 106);
      g.fillStyle = '#f2c230'; g.font = `600 22px ${FONT}`; g.fillText('farm to shelf', w / 2, 150);
    }) });
    this.mat.shelfBack = lam(0xffffff, { map: canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#e6e9ec'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(80,90,100,.22)';
      for (let y = 30; y < h - 30; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
      g.fillStyle = '#1f7a4d'; g.fillRect(0, 0, w, 22);
      g.fillStyle = '#f2c230'; g.fillRect(0, 22, w, 4);
      g.fillStyle = '#ffffff'; g.font = `700 15px ${FONT}`; g.textAlign = 'center'; g.fillText('MiniMart · everyday low prices', w / 2, 16);
      g.fillStyle = '#4b5560'; g.fillRect(0, h - 24, w, 24);
    }) });
    this.mat.freezerSide = lam(0xffffff, { map: canvasTex(512, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2a74c0'); gr.addColorStop(1, '#5fb4ec');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `700 ${h * 0.5}px ${FONT}`; g.textBaseline = 'middle';
      g.fillText('❄ FROZEN FOODS', 18, h / 2 + 2);
      g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(w * 0.55 + i * 16, h * (0.3 + (i % 3) * 0.2), 3, 0, 7); g.fill(); }
    }) });
    this.mat.frost = lam(0xffffff, { emissive: 0x1c2a36, map: canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#d6e7f2'; g.fillRect(0, 0, w, h);
      const r = rng(4); for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.5})`; g.fillRect(r() * w, r() * h, 2, 2); }
    }) });
    this.mat.fridgeHeader = lam(0xffffff, { emissive: 0x334455, map: canvasTex(512, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d4f8c'); gr.addColorStop(1, '#2f6fbf');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = `700 ${h * 0.46}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'center';
      g.fillText('FRESH  ·  CHILLED  ·  2–5 °C', w / 2, h / 2 + 2);
    }) });
    this.mat.exitSign = new THREE.MeshBasicMaterial({ map: canvasTex(256, 96, (g, w, h) => {
      g.fillStyle = '#16994f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = `700 52px ${FONT}`; g.textBaseline = 'middle'; g.fillText('EXIT', 92, h / 2 + 3);
      g.lineWidth = 7; g.strokeStyle = '#fff'; g.lineCap = 'round';
      g.beginPath(); g.arc(40, 22, 7, 0, 7); g.fillStyle = '#fff'; g.fill();
      g.beginPath(); g.moveTo(38, 32); g.lineTo(32, 56); g.lineTo(48, 74); g.moveTo(32, 56); g.lineTo(20, 76); g.moveTo(36, 40); g.lineTo(54, 48); g.moveTo(36, 40); g.lineTo(22, 46); g.stroke();
    }) });
    for (const k of ['laser', 'screenOn', 'glow', 'exit']) this.mat[k].userData.cast = false;
  }

  // ---------------------------------------------------------------- batching helpers
  add(geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.sc.B.add(geo, mat, _m);
  }
  // rotation given as yaw then pitch then roll (good for leaves: pick a direction, then tilt)
  addYPR(geo, mat, x, y, z, sx, sy, sz, yaw, pitch, roll = 0) {
    _e.set(pitch, yaw, roll, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.sc.B.add(geo, mat, _m);
  }
  box(w, h, d, x, y, z, mat, ry = 0, rx = 0, rz = 0) { this.add(BOX, mat, x, y, z, w, h, d, rx, ry, rz); }
  cyl(r, h, x, y, z, mat, rx = 0, rz = 0) { this.add(this.G.disc, mat, x, y, z, r * 2, h, r * 2, rx, 0, rz); }

  // ---------------------------------------------------------------- plants
  pot(x, z, r, h, mat) {
    const M = this.mat;
    this.add(this.G.pot, mat, x, h / 2, z, r * 2, h, r * 2);
    this.add(this.G.rim, mat, x, h - 0.03, z, r * 2.12, 0.07, r * 2.12);
    this.add(this.G.disc, M.soil, x, h - 0.05, z, r * 1.86, 0.03, r * 1.86);
    for (let i = 0; i < 7; i++) { const a = i * 2.4, d = r * 0.55 * ((i % 3) / 3 + 0.3); this.add(this.G.pebble, M.pebble, x + Math.cos(a) * d, h - 0.03, z + Math.sin(a) * d, 0.07, 0.04, 0.06); }
    this.sc.contact(x, z, r * 3, r * 3);
  }

  // areca palm: a tall pot with arching fronds
  palm(x, z, s = 1, seed = 1) {
    const r = rng(seed), M = this.mat, top = 0.62 * s;
    this.pot(x, z, 0.3 * s, top, seed % 2 ? M.ceramic : M.charcoal);
    for (let i = 0; i < 5; i++) {      // a few bare stems
      const a = r() * 6.28;
      this.add(this.G.disc, M.bark, x + Math.cos(a) * 0.05, top + 0.25 * s, z + Math.sin(a) * 0.05, 0.035 * s, 0.5 * s, 0.035 * s, Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
    }
    const n = 13;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + r() * 0.4;
      const inner = i % 3 === 0;
      const len = (inner ? 1.05 : 1.35 + r() * 0.35) * s;
      const pitch = inner ? -1.0 - r() * 0.3 : -0.55 - r() * 0.35;     // tilt up out of the pot
      this.addYPR(this.G.frond, M.frond, x, top + 0.18 * s, z, len * 0.75, len, len, yaw, pitch, (r() - 0.5) * 0.5);
    }
  }

  // rubber plant / ficus: a short trunk with a crown of broad glossy leaves
  ficus(x, z, s = 1, seed = 2) {
    const r = rng(seed), M = this.mat, top = 0.48 * s;
    this.pot(x, z, 0.27 * s, top, seed % 2 ? M.terracotta : M.ceramic);
    const crownY = top + 0.95 * s;
    this.add(this.G.disc, M.bark, x, (top + crownY) / 2, z, 0.06 * s, crownY - top, 0.06 * s);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + r();
      this.add(this.G.disc, M.bark, x + Math.cos(a) * 0.12 * s, crownY - 0.1 * s, z + Math.sin(a) * 0.12 * s, 0.03 * s, 0.4 * s, 0.03 * s, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    }
    for (let i = 0; i < 46; i++) {
      // leaves spread over an upper sphere
      const u = r(), yaw = r() * Math.PI * 2, el = Math.acos(1 - u * 1.3) - 0.3;
      const rad = (0.22 + r() * 0.2) * s;
      const px = x + Math.cos(yaw) * Math.sin(el) * rad, pz = z + Math.sin(yaw) * Math.sin(el) * rad, py = crownY + Math.cos(el) * rad * 0.8 - 0.1 * s;
      const L = (0.24 + r() * 0.12) * s;
      this.addYPR(this.G.broad, M.broad, px, py, pz, L, L, L, -yaw + Math.PI / 2 + (r() - 0.5), -0.2 + r() * 0.9 - el * 0.4, (r() - 0.5) * 0.8);
    }
  }

  // snake plant in a square planter
  snake(x, z, s = 1, seed = 3) {
    const r = rng(seed), M = this.mat, top = 0.4 * s;
    this.box(0.46 * s, top, 0.46 * s, x, top / 2, z, M.charcoal);
    this.box(0.4 * s, 0.03, 0.4 * s, x, top - 0.02, z, M.soil);
    this.sc.contact(x, z, 0.9 * s, 0.9 * s);
    for (let i = 0; i < 11; i++) {
      const yaw = r() * Math.PI * 2, d = r() * 0.12 * s;
      const h = (0.7 + r() * 0.55) * s;
      this.addYPR(this.G.blade, M.blade, x + Math.cos(yaw) * d, top, z + Math.sin(yaw) * d, 0.9 * s, h, h, yaw, -1.35 - r() * 0.15, 0);
    }
  }

  // street tree in a raised planter: tapered trunk, branches, a crown of foliage clusters
  tree(x, z, s = 1, seed = 1, planter = true) {
    const r = rng(seed * 31 + 7), M = this.mat, sm = this.sc.M;
    if (planter) {
      this.add(this.G.rim, sm.concrete, x, 0.22, z, 1.8, 0.44, 1.8);
      this.add(this.G.disc, M.soil, x, 0.43, z, 1.6, 0.04, 1.6);
      for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 0.35 + r() * 0.35; this.add(this.G.sph, M.foliage, x + Math.cos(a) * d, 0.48, z + Math.sin(a) * d, 0.32, 0.18, 0.32); }
    }
    const H = (2.6 + r() * 0.6) * s;
    this.add(this.G.pot, M.bark, x, (planter ? 0.4 : 0) + H / 2, z, 0.34 * s, H, 0.34 * s, Math.PI, 0, 0);
    const crownY = (planter ? 0.4 : 0) + H + 0.5 * s;
    const tips = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + r() * 0.6, tilt = 0.55 + r() * 0.3, L = (1.1 + r() * 0.4) * s;
      const bx = x + Math.cos(a) * Math.sin(tilt) * L / 2, bz = z + Math.sin(a) * Math.sin(tilt) * L / 2, by = crownY - 0.9 * s + Math.cos(tilt) * L / 2;
      this.add(this.G.disc, M.bark, bx, by, bz, 0.11 * s, L, 0.11 * s, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      tips.push([x + Math.cos(a) * Math.sin(tilt) * L, crownY - 0.9 * s + Math.cos(tilt) * L, z + Math.sin(a) * Math.sin(tilt) * L]);
    }
    const blobs = [[x, crownY + 0.6 * s, z, 2.6]].concat(tips.map(t => [t[0], t[1] + 0.2 * s, t[2], 1.9 + r() * 0.5]));
    for (let i = 0; i < 3; i++) { const a = r() * 6.28; blobs.push([x + Math.cos(a) * 0.8 * s, crownY + 1.2 * s + r() * 0.4, z + Math.sin(a) * 0.8 * s, 1.6]); }
    const crownGeo = planter ? this.G.crown : this.G.crownLo;
    blobs.forEach(([bx, by, bz, d], i) => this.add(crownGeo, i % 3 === 1 ? M.foliage2 : M.foliage, bx, by, bz, d * s, d * 0.82 * s, d * s, r(), r() * 6, r()));
    // leaf sprigs poking out of the crown so the outline isn't smooth
    for (let i = 0; i < (planter ? 34 : 14); i++) {
      const [bx, by, bz, d] = blobs[i % blobs.length];
      const yaw = r() * 6.28, el = r() * 1.4 - 0.3, rad = d * 0.46 * s;
      const L = (0.5 + r() * 0.3) * s;
      this.addYPR(this.G.broad, M.broad, bx + Math.cos(yaw) * Math.cos(el) * rad, by + Math.sin(el) * rad, bz + Math.sin(yaw) * Math.cos(el) * rad, L, L, L, -yaw + Math.PI / 2, -el, r() - 0.5);
    }
    this.sc.contact(x, z, 3.2 * s, 3.2 * s);
  }

  // a small car: length along local +z (front), built as real meshes in a group so it can
  // either drive (traffic) or be flattened into the static batch (parked)
  carGroup(body) {
    const M = this.mat, sm = this.sc.M, g = new THREE.Group();
    if (!this.carMats) this.carMats = {
      head: new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), tail: new THREE.MeshBasicMaterial({ color: 0xd81e1e }),
      plate: this.mat.white, trim: new THREE.MeshLambertMaterial({ color: 0x24272b }),
    };
    const C = this.carMats;
    const B = (w, h, d, x, y, z, mat, rx = 0) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
    B(1.8, 0.42, 4.3, 0, 0.52, 0, body);                 // lower body
    B(1.76, 0.2, 4.1, 0, 0.82, -0.02, body);             // shoulders
    B(1.68, 0.1, 1.2, 0, 0.94, 1.45, body, 0.07);        // bonnet, sloping down to the nose
    B(1.68, 0.1, 0.75, 0, 0.95, -1.7, body, -0.05);      // boot lid
    B(1.54, 0.46, 1.55, 0, 1.15, -0.32, sm.carGlass);    // cabin glass
    // windscreen and rear window run from the roof edge down to the bonnet / boot
    B(1.5, 0.05, 0.72, 0, 1.17, 0.73, sm.carGlass, 0.69);
    B(1.5, 0.05, 0.64, 0, 1.17, -1.32, sm.carGlass, -0.78);
    B(1.52, 0.06, 1.35, 0, 1.4, -0.32, body);            // roof
    for (const sx of [-1, 1]) {
      B(0.06, 0.46, 0.08, sx * 0.76, 1.15, 0.42, body);  // A-pillars
      B(0.06, 0.46, 0.08, sx * 0.76, 1.15, -0.32, body); // B-pillars
      B(0.12, 0.08, 0.16, sx * 0.95, 1.0, 0.62, body);   // mirrors
      B(0.36, 0.1, 0.03, sx * 0.58, 0.76, 2.16, C.head); // headlights
      B(0.34, 0.12, 0.03, sx * 0.6, 0.8, -2.16, C.tail); // tail-lights
      for (const sz of [-1, 1]) {
        const t = new THREE.Mesh(this.G.disc, sm.tire); t.scale.set(0.68, 0.24, 0.68); t.rotation.z = Math.PI / 2; t.position.set(sx * 0.82, 0.34, sz * 1.35); g.add(t);
        const r = new THREE.Mesh(this.G.disc, M.steel); r.scale.set(0.42, 0.02, 0.42); r.rotation.z = Math.PI / 2; r.position.set(sx * 0.95, 0.34, sz * 1.35); g.add(r);
        B(0.04, 0.12, 0.9, sx * 0.9, 0.62, sz * 1.35, C.trim);  // wheel-arch trim
      }
    }
    for (const sz of [-1, 1]) {
      B(1.84, 0.2, 0.14, 0, 0.36, sz * 2.13, C.trim);    // bumpers
      B(0.5, 0.12, 0.02, 0, 0.42, sz * 2.21, C.plate);   // number plates
    }
    B(0.8, 0.14, 0.02, 0, 0.66, 2.16, C.trim);           // grille
    return g;
  }

  parkedCar(x, z, ry, body) {
    const g = this.carGroup(body);
    g.position.set(x, 0, z); g.rotation.y = ry; g.updateMatrixWorld(true);
    for (const m of g.children) this.sc.B.add(m.geometry, m.material, m.matrixWorld);
    this.sc.contact(x, z, 2.4, 5.0);
  }

  // ---------------------------------------------------------------- checkout counter
  // counter runs along x, customers on -z, clerk on +z. Parts the scene animates (screens,
  // lamp, belt items) are made by the scene; this adds everything around them.
  checkout(cx, cz) {
    const M = this.mat, sc = this.sc;
    // cabinet: laminate body, printed front panel, steel kick plate, dark worktop
    this.box(4.0, 0.84, 1.0, cx, 0.5, cz, M.laminate);
    this.box(4.02, 0.12, 1.02, cx, 0.06, cz, M.steel);
    this.add(this.G.plane, M.counterFront, cx, 0.52, cz - 0.512, 3.9, 0.72, 1, 0, Math.PI, 0);
    this.box(4.08, 0.05, 1.08, cx, 0.945, cz, M.counterTop);
    // conveyor: steel rails either side of the belt, end rollers, a divider bar
    for (const s of [-1, 1]) this.box(2.7, 0.06, 0.05, cx - 0.6, 1.0, cz + s * 0.33, M.steel);
    for (const ex of [-1.92, 0.72]) this.add(this.G.disc, M.steel, cx + ex, 1.0, cz, 0.08, 0.64, 0.08, Math.PI / 2, 0, 0);
    this.box(0.5, 0.06, 0.06, cx - 1.6, 1.06, cz + 0.28, M.bluePlastic, 0.2);
    // flatbed scanner: dark glass with the red laser showing through + the tower
    this.box(0.46, 0.012, 0.42, cx + 1.0, 0.98, cz, M.darkGlass);
    this.box(0.3, 0.004, 0.04, cx + 1.0, 0.985, cz, M.laser);
    this.box(0.42, 0.28, 0.07, cx + 1.0, 1.1, cz - 0.24, M.black);
    this.box(0.3, 0.16, 0.01, cx + 1.0, 1.12, cz - 0.2, M.darkGlass);
    this.box(0.12, 0.012, 0.01, cx + 1.0, 1.12, cz - 0.194, M.laser);
    // bagging well past the scanner: lower steel shelf, bag dispenser with branded bags
    this.box(0.62, 0.03, 0.82, cx + 1.66, 0.82, cz, M.steel);
    for (const s of [-1, 1]) this.box(0.03, 0.42, 0.03, cx + 1.66 + s * 0.27, 1.17, cz - 0.3, M.steel);
    this.box(0.57, 0.03, 0.03, cx + 1.66, 1.38, cz - 0.3, M.steel);
    for (let i = 0; i < 6; i++) this.add(this.G.plane, M.bagRoll, cx + 1.66, 1.14, cz - 0.31 + i * 0.012, 0.5, 0.48, 1, 0, 0, 0);
    // clerk side: cash drawer, receipt printer with paper, card terminal on a swivel post
    this.box(0.5, 0.14, 0.42, cx + 0.95, 0.82, cz + 0.36, M.black);
    this.box(0.46, 0.02, 0.02, cx + 0.95, 0.8, cz + 0.58, M.steel);
    this.box(0.18, 0.12, 0.2, cx + 0.5, 1.03, cz + 0.32, M.black);
    this.box(0.08, 0.002, 0.14, cx + 0.5, 1.09, cz + 0.42, M.paper, 0, 0.6);
    this.box(0.03, 0.18, 0.03, cx + 1.42, 1.05, cz - 0.28, M.steel);
    this.box(0.11, 0.17, 0.05, cx + 1.42, 1.2, cz - 0.3, M.keypad, 0, -0.5);
    // impulse rack facing the queue: gum, chocolate and mints at child height
    const rk = cx - 1.55, rz = cz - 0.68;
    this.box(0.62, 1.3, 0.03, rk, 0.65, rz + 0.1, M.laminate);
    for (const s of [-1, 1]) this.box(0.03, 1.3, 0.22, rk + s * 0.3, 0.65, rz, M.laminate);
    this.box(0.64, 0.12, 0.24, rk, 1.36, rz, M.red);
    const r = rng(Math.round(cx * 7));
    const sweets = [M.red, M.bluePlastic, this.sc.M.yellow, this.sc.M.orange, this.sc.M.green, M.white];
    for (const ly of [0.25, 0.55, 0.85, 1.12]) {
      this.box(0.6, 0.02, 0.2, rk, ly - 0.01, rz - 0.02, M.steel);
      for (let i = 0; i < 6; i++) for (let d = 0; d < 2; d++) this.box(0.08, 0.13 + r() * 0.05, 0.06, rk - 0.25 + i * 0.1, ly + 0.08, rz - 0.06 + d * 0.08, sweets[Math.floor(r() * sweets.length)]);
    }
  }

  // ---------------------------------------------------------------- fixture trim
  fridgeTrim(cx, cz) {
    const M = this.mat;
    // glowing canopy with the department strip, chrome door frames and handles, kick grille
    this.add(this.G.plane, M.fridgeHeader, cx, 2.52, cz + 0.6, 3.92, 0.24, 1);
    for (const s of [-1.95, -0.975, 0, 0.975, 1.95]) this.box(0.05, 1.98, 0.06, cx + s, 1.25, cz + 0.6, M.steel);
    for (const s of [-1.95, 1.95]) this.box(0.06, 0.06, 0.06, cx + s * 0.999, 2.25, cz + 0.6, M.steel);
    this.box(3.96, 0.05, 0.07, cx, 2.24, cz + 0.6, M.steel);
    this.box(3.96, 0.05, 0.07, cx, 0.27, cz + 0.6, M.steel);
    for (const hx of [-1.08, -0.11, 0.11, 1.08]) this.box(0.025, 0.7, 0.04, cx + hx, 1.3, cz + 0.65, M.steel);
    this.add(this.G.plane, M.grille, cx, 0.14, cz + 0.6, 3.9, 0.22, 1);
    this.box(3.8, 0.02, 0.02, cx, 2.18, cz + 0.45, M.glow);
  }

  freezerTrim(cx, cz) {
    const M = this.mat;
    // printed side panels, bumper rail, frosted well floor, sliding lid frames with handles
    for (const sd of [-1, 1]) this.add(this.G.plane, M.freezerSide, cx, 0.42, cz + sd * 0.765, 3.96, 0.5, 1, 0, sd > 0 ? 0 : Math.PI, 0);
    for (const sd of [-1, 1]) this.box(4.04, 0.06, 0.05, cx, 0.2, cz + sd * 0.78, M.kick);
    this.box(3.78, 0.02, 1.28, cx, 0.545, cz, M.frost);
    this.box(0.04, 0.04, 1.42, cx, 0.95, cz, M.steel);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.4, 0.035, 0.035, cx + sx * 0.95, 0.975, cz + sz * 0.18, M.steel);
  }

  shelfTrim(cx, cz) {
    const M = this.mat;
    this.add(this.G.plane, M.shelfBack, cx, 1.3, cz - 0.607, 3.9, 2.2, 1, 0, Math.PI, 0);
    this.add(this.G.plane, M.grille, cx, 0.09, cz + 0.6, 3.9, 0.16, 1);
    // chrome top rail and green trim on the uprights
    this.box(4.0, 0.05, 0.08, cx, 2.43, cz - 0.52, M.steel);
    for (const s of [-1, 1]) this.box(0.02, 2.2, 0.05, cx + s * 2.0, 1.15, cz + 0.58, this.sc.M.green);
  }

  produceStand(cx, cz, seed) {
    const M = this.mat, sc = this.sc;
    // timber frame on legs, crates with slatted sides, turf liner and a chalkboard
    for (const sx of [-1.9, 1.9]) for (const sz of [-0.62, 0.62]) this.box(0.1, 0.72, 0.1, cx + sx, 0.36, cz + sz, M.woodDark);
    for (const sz of [-0.62, 0.62]) this.box(3.9, 0.1, 0.08, cx, 0.68, cz + sz, M.woodDark);
    this.add(this.G.plane, M.turf, cx, 0.74, cz + 0.05, 3.8, 1.2, 1, -Math.PI / 2 + 0.05, 0, 0);
    for (const s of [-1, 1]) {
      const x = cx + s * 1.0;
      // front, back and side slats of each tilted crate
      this.box(1.92, 0.2, 0.04, x, 0.9, cz + 0.64, M.crate, 0, 0.18);
      this.box(1.92, 0.34, 0.04, x, 1.02, cz - 0.62, M.crate, 0, 0.18);
      for (const e of [-0.95, 0.95]) this.box(0.04, 0.3, 1.28, x + e, 0.95, cz, M.crate, 0, 0.18);
    }
    // back board shelf of baskets
    this.box(3.9, 0.06, 0.32, cx, 1.42, cz - 0.6, M.wood);
    const r = rng(seed * 13 + 1);
    for (let i = 0; i < 5; i++) this.add(this.G.hemi, M.wood, cx - 1.6 + i * 0.8, 1.6, cz - 0.6, 0.42, -0.22, 0.3);
    // chalkboard on a stake at the front corner
    const bx = cx + 1.75 - (seed % 2) * 3.5;
    this.box(0.04, 0.9, 0.04, bx, 0.45, cz + 0.85, M.woodDark);
    this.add(this.G.plane, M.chalk, bx, 1.05, cz + 0.88, 0.5, 0.38, 1, -0.1, 0, 0);
    // a hanging scale on every other stand
    if (seed % 2 === 0) {
      this.box(0.02, 0.5, 0.02, cx + 0.2, 2.3, cz - 0.3, M.steel);
      this.add(this.G.disc, M.white, cx + 0.2, 1.98, cz - 0.3, 0.26, 0.08, 0.26, Math.PI / 2, 0, 0);
      this.add(this.G.hemi, M.steel, cx + 0.2, 1.72, cz - 0.3, 0.42, -0.14, 0.42);
      for (let k = 0; k < 3; k++) this.box(0.005, 0.22, 0.005, cx + 0.2 + Math.cos(k * 2.1) * 0.18, 1.82, cz - 0.3 + Math.sin(k * 2.1) * 0.18, M.steel);
    }
  }

  // ---------------------------------------------------------------- storage room
  // cardboard with brown tape, a printed label and "this way up" arrows; three looks
  cardboard(i) {
    if (!this.cardMats) {
      this.cardMats = [0, 1, 2].map(k => new THREE.MeshLambertMaterial({ map: canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = ['#b98a55', '#a87a46', '#c79c66'][k]; g.fillRect(0, 0, w, h);
        const r = rng(30 + k);
        for (let n = 0; n < 60; n++) { g.fillStyle = `rgba(90,60,30,${r() * 0.08})`; g.fillRect(0, r() * h, w, 1); }
        g.fillStyle = 'rgba(150,110,60,.9)'; g.fillRect(w / 2 - 9, 0, 18, h);              // tape
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(w / 2 - 9, 0, 4, h);
        if (k !== 1) { g.fillStyle = '#f4f1e8'; g.fillRect(12, 70, 38, 26); g.fillStyle = '#333'; for (let y = 76; y < 92; y += 5) g.fillRect(16, y, 28, 2); }
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 3;
        for (const x of [w - 34, w - 20]) { g.beginPath(); g.moveTo(x, 36); g.lineTo(x, 18); g.moveTo(x - 5, 24); g.lineTo(x, 17); g.lineTo(x + 5, 24); g.stroke(); }
      }) }));
    }
    return this.cardMats[i % 3];
  }

  pallet(x, z, ry = 0) {
    const M = this.mat;
    for (let i = 0; i < 5; i++) this.box(0.18, 0.03, 1.0, x + Math.cos(ry) * (-0.5 + i * 0.25), 0.135, z - Math.sin(ry) * (-0.5 + i * 0.25), M.wood, ry);
    for (const o of [-0.4, 0, 0.4]) this.box(1.2, 0.1, 0.12, x + Math.sin(ry) * o, 0.07, z + Math.cos(ry) * o, M.woodDark, ry);
  }

  palletJack(x, z, ry = 0) {
    const M = this.mat, sm = this.sc.M;
    const fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
    for (const s of [-0.18, 0.18]) this.box(0.16, 0.06, 1.15, x + sx * s, 0.06, z + sz * s, sm.orange, ry);
    this.box(0.55, 0.32, 0.22, x - fx * 0.62, 0.2, z - fz * 0.62, sm.orange, ry);
    this.box(0.05, 1.05, 0.05, x - fx * 0.72, 0.75, z - fz * 0.72, M.black, ry, -0.25);
    this.box(0.32, 0.05, 0.05, x - fx * 0.85, 1.24, z - fz * 0.85, M.black, ry);
    this.add(this.G.disc, M.black, x - fx * 0.62, 0.09, z - fz * 0.62, 0.18, 0.12, 0.18, 0, ry, Math.PI / 2);
  }

  floorLine(x0, z0, x1, z1, w = 0.1) {
    if (!this.lineMat) { this.lineMat = new THREE.MeshLambertMaterial({ color: 0xf2c230, polygonOffset: true, polygonOffsetFactor: -1 }); this.lineMat.userData.cast = false; }
    const len = Math.hypot(x1 - x0, z1 - z0);
    this.add(this.G.plane, this.lineMat, (x0 + x1) / 2, 0.011, (z0 + z1) / 2, w, len, 1, -Math.PI / 2, 0, -Math.atan2(x1 - x0, z1 - z0));
  }

  // shopping trolley: wire basket, push bar, child seat flap, four castors
  cart(x, z, ry = 0) {
    const M = this.mat;
    if (!this.wireMat) {
      this.wireMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80, specular: 0x888888, side: THREE.DoubleSide, alphaTest: 0.5, map: canvasTex(64, 64, (g, w, h) => {
        g.strokeStyle = '#c9ced4'; g.lineWidth = 3;
        for (let i = 2; i < w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
      }, { repeat: [3, 2] }) });
      this.wireMat.userData.cast = false;
    }
    const W = this.wireMat, fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
    const at = (f, s2) => [x + fx * f + sx * s2, z + fz * f + sz * s2];
    let p;
    for (const s2 of [-0.27, 0.27]) { p = at(0, s2); this.add(this.G.plane, W, p[0], 0.78, p[1], 0.85, 0.42, 1, 0, ry + Math.PI / 2, 0); }
    for (const f of [-0.42, 0.42]) { p = at(f, 0); this.add(this.G.plane, W, p[0], 0.78, p[1], 0.54, 0.42, 1, 0, ry, 0); }
    p = at(0, 0); this.add(this.G.plane, W, p[0], 0.57, p[1], 0.54, 0.85, 1, -Math.PI / 2, ry, 0);
    this.add(this.G.plane, W, p[0], 0.22, p[1], 0.5, 0.8, 1, -Math.PI / 2, ry, 0);            // bottom tray
    for (const s2 of [-0.27, 0.27]) for (const f of [-0.42, 0.42]) { p = at(f, s2); this.box(0.025, 0.42, 0.025, p[0], 0.78, p[1], M.steel, ry); }
    for (const s2 of [-0.24, 0.24]) { p = at(-0.5, s2); this.box(0.025, 0.95, 0.025, p[0], 0.5, p[1], M.steel, ry, -0.12); }
    p = at(-0.56, 0); this.box(0.56, 0.04, 0.04, p[0], 1.02, p[1], this.sc.M.green, ry);         // push bar
    for (const s2 of [-0.22, 0.22]) for (const f of [-0.38, 0.38]) { p = at(f, s2); this.add(this.G.disc, M.black, p[0], 0.06, p[1], 0.11, 0.04, 0.11, 0, ry, Math.PI / 2); }
  }

  // ---------------------------------------------------------------- loose dressing
  basketStack(x, z, n = 7, ry = 0) {
    const M = this.mat;
    this.sc.contact(x, z, 0.8, 0.6);
    for (let i = 0; i < n; i++) {
      // nested baskets: a solid floor, perforated sides, a solid top rim
      const y = 0.02 + i * 0.07;
      this.box(0.44, 0.02, 0.3, x, y, z, M.redPlastic, ry);
      for (const s of [-1, 1]) {
        this.add(this.G.plane, M.basketSide, x + Math.sin(ry) * s * 0.17, y + 0.11, z + Math.cos(ry) * s * 0.17, 0.5, 0.22, 1, 0, ry, 0);
        this.add(this.G.plane, M.basketSide, x + Math.cos(ry) * s * 0.25, y + 0.11, z - Math.sin(ry) * s * 0.25, 0.34, 0.22, 1, 0, ry + Math.PI / 2, 0);
      }
      this.box(0.52, 0.025, 0.36, x, y + 0.225, z, M.redPlastic, ry);
      this.box(0.46, 0.03, 0.3, x, y + 0.226, z, M.black, ry);   // hollow look from above
    }
    // the handles of the top basket
    this.box(0.02, 0.16, 0.3, x, 0.02 + n * 0.07 + 0.18, z, M.black, ry);
  }

  cctvDome(x, y, z) {
    this.add(this.G.disc, this.mat.white, x, y - 0.02, z, 0.22, 0.04, 0.22);
    this.add(this.G.hemi, this.mat.domeGlass, x, y - 0.03, z, 0.18, -0.16, 0.18);
  }

  speaker(x, y, z) {
    this.add(this.G.disc, this.mat.white, x, y - 0.01, z, 0.3, 0.02, 0.3);
    this.add(this.G.disc, this.mat.grille, x, y - 0.022, z, 0.24, 0.005, 0.24);
  }

  exitSign(x, y, z, ry = 0) {
    this.box(0.62, 0.26, 0.06, x, y, z, this.mat.white, ry);
    this.add(this.G.plane, this.mat.exitSign, x + Math.sin(ry) * 0.032, y, z + Math.cos(ry) * 0.032, 0.56, 0.21, 1, 0, ry, 0);
    this.box(0.02, 0.4, 0.02, x, y + 0.33, z, this.mat.steel);
  }

  extinguisher(x, z, wallRy) {
    const M = this.mat, nx = Math.sin(wallRy), nz = Math.cos(wallRy);
    const px = x + nx * 0.14, pz = z + nz * 0.14;
    this.add(this.G.disc, M.red, px, 0.62, pz, 0.16, 0.56, 0.16);
    this.add(this.G.hemi, M.red, px, 0.9, pz, 0.16, 0.08, 0.16);
    this.box(0.06, 0.08, 0.06, px, 0.97, pz, M.black);
    this.box(0.14, 0.03, 0.03, px + nx * 0.06, 1.0, pz + nz * 0.06, M.black, wallRy);
    const sign = this.sc.textSign('FIRE', 0.32, 0.2, { bg: '#d8342c', px: 128, font: 0.6 });
    sign.position.set(x + nx * 0.02, 1.45, z + nz * 0.02); sign.rotation.y = wallRy;
  }

  bin(x, z, mat) {
    this.add(this.G.pot, mat || this.mat.charcoal, x, 0.42, z, 0.44, 0.84, 0.44);
    this.add(this.G.hemi, this.mat.steel, x, 0.84, z, 0.46, 0.14, 0.46);
    this.sc.contact(x, z, 0.8, 0.8);
  }

  bench(x, z, ry = 0) {
    const M = this.mat;
    for (let i = 0; i < 4; i++) this.box(1.8, 0.04, 0.1, x - Math.sin(ry) * (i - 1.5) * 0.12, 0.46, z - Math.cos(ry) * (i - 1.5) * 0.12, M.wood, ry);
    for (let i = 0; i < 2; i++) this.box(1.8, 0.1, 0.04, x - Math.sin(ry) * 0.26, 0.64 + i * 0.16, z - Math.cos(ry) * 0.26, M.wood, ry);
    for (const s of [-0.8, 0.8]) this.box(0.06, 0.46, 0.5, x + Math.cos(ry) * s, 0.23, z - Math.sin(ry) * s, M.black, ry);
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
