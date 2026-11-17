/* MiniMart Mayhem - 3D world construction and per-frame rendering of the server snapshot. */
import * as THREE from './vendor/three.module.js';
import { productMesh, cartonMaterials } from './packaging.js';
import { Props } from './props.js';

export const TILE = 2.0;          // metres per simulation tile
export const EYE = 1.65;
const WALL_H = 4.4;               // ceiling height inside the store

const wx = t => t * TILE;
const wz = t => t * TILE;

// ------------------------------------------------------------------ small utils

function rng(seed) {                         // mulberry32
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickR = (r, arr) => arr[Math.floor(r() * arr.length)];

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

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

const FONT = '"Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", "Segoe UI", sans-serif';

// Merges many static primitives into one mesh per material - the whole store
// is a few dozen draw calls instead of a few thousand.
class Batcher {
  constructor() { this.byMat = new Map(); }
  add(geo, mat, matrix) {
    const g = geo.clone();
    g.applyMatrix4(matrix);
    if (!this.byMat.has(mat)) this.byMat.set(mat, []);
    this.byMat.get(mat).push(g);
  }
  build(parent) {
    const out = [];
    for (const [mat, geos] of this.byMat) {
      let nv = 0, ni = 0;
      for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
      const idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      for (const g of geos) {
        const n = g.attributes.position.count;
        pos.set(g.attributes.position.array, vo * 3);
        nor.set(g.attributes.normal.array, vo * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
        if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
        else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
        vo += n;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = mat.userData.cast !== false;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      parent.add(m);
      out.push(m);
    }
    this.byMat.clear();
    return out;
  }
}

const G = {                                          // shared unit geometries
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  sph: new THREE.SphereGeometry(0.5, 14, 10),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  plane: new THREE.PlaneGeometry(1, 1),
};
const _c = new THREE.Color();
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// ------------------------------------------------------------------ the scene

export class StoreScene {
  constructor(canvas, world, quality = 'medium') {
    this.world = world;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe0ee, 90, 260);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 600);
    this.yawObj = new THREE.Object3D();
    this.pitchObj = new THREE.Object3D();
    this.yawObj.add(this.pitchObj);
    this.pitchObj.add(this.camera);
    this.scene.add(this.yawObj);

    this.time = 0;
    this.matCache = new Map();
    this.pools = { players: new Map(), customers: new Map(), staff: new Map(), boxes: new Map(), spills: new Map() };
    this.fixParts = [];
    this.checkoutParts = [];
    this.lockedCovers = [];
    this.partitionWalls = [];
    this.nightGlow = [];
    this.bob = 0;

    this.maxRatio = Math.min(devicePixelRatio, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1);
    this.resScale = 1;
  }

  // Builds the world in steps, yielding between them so the loading bar can paint.
  async build(onProgress = () => {}) {
    const steps = [
      ['Lighting the store', () => { this.buildMaterials(); this.buildSky(); this.buildLights(); this.B = new Batcher(); this.P = new Props(this); }],
      ['Paving the car park', () => this.buildGround()],
      ['Raising the walls', () => this.buildBuilding()],
      ['Stacking the storage room', () => this.buildStorage()],
      ['Bolting down shelves', () => this.buildFixtures()],
      ['Wiring the tills', () => { this.buildCheckouts(); this.buildTerminal(); }],
      ['Hanging the signs', () => this.buildDecor()],
      ['Parking the cars', () => this.buildOutside()],
      ['Merging geometry', () => this.B.build(this.scene)],
      ['Printing product labels', () => this.buildProducts()],
      ['Hiring shoppers', () => { this.buildHeld(); this.buildRain(); this.crowd = new Crowd(this); this.blobs = new Blobs(this); }],
    ];
    for (let i = 0; i < steps.length; i++) {
      onProgress(i / (steps.length + 1), steps[i][0]);
      await new Promise(r => setTimeout(r, 0));
      steps[i][1]();
    }
    onProgress(steps.length / (steps.length + 1), 'Compiling shaders');
    await new Promise(r => setTimeout(r, 0));
    this.resize();
    try { if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera); else this.renderer.compile(this.scene, this.camera); } catch { /* compile lazily */ }
    addEventListener('resize', () => this.resize());
    onProgress(1, 'Open for business');
    return this;
  }

  // dynamic resolution: the client lowers this when the frame rate drops
  setResScale(f) {
    f = Math.max(0.5, Math.min(1, f));
    if (Math.abs(f - this.resScale) < 0.02) return;
    this.resScale = f;
    this.resize();
  }

  // ---------------------------------------------------------------- materials

  lam(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, ...extra }); }

  colorMat(hex) {
    const k = 'c' + hex;
    if (!this.matCache.has(k)) this.matCache.set(k, this.lam(new THREE.Color(hex)));
    return this.matCache.get(k);
  }

  buildMaterials() {
    const M = this.M = {};
    // a painted "room" for reflections: bright ceiling light strips above, darker floor below
    const env = canvasTex(512, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#dfe6ee'); gr.addColorStop(0.48, '#f4f4f0'); gr.addColorStop(0.52, '#9a9a94'); gr.addColorStop(1, '#5d5f62');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      for (let y = 18; y < h * 0.42; y += 26) for (let x = 0; x < w; x += 64) g.fillRect(x + (y % 52 ? 16 : 0), y, 34, 7);
    });
    env.mapping = THREE.EquirectangularReflectionMapping;
    this.envTex = env;
    M.wallIn = this.lam(0xeef0ec);
    M.wallStripe = this.lam(0x1f7a4d);
    M.skirting = this.lam(0x4b5560);
    M.exterior = this.lam(0xd8d2c8);
    M.exteriorDark = this.lam(0x3a4a44);
    M.fascia = this.lam(0x15553a);
    M.roof = this.lam(0x8a9096);
    M.metal = this.lam(0xdfe3e8);
    M.metalDark = this.lam(0x59626d);
    M.green = this.lam(0x1f7a4d);
    M.yellow = this.lam(0xf2c230);
    M.orange = this.lam(0xe07a1f);
    M.blue = this.lam(0x2f5f9e);
    M.wood = this.lam(0xa87444);
    M.woodDark = this.lam(0x7a522d);
    M.black = this.lam(0x1d2126);
    M.rubber = this.lam(0x2a2d31);
    M.white = this.lam(0xf7f7f5);
    M.cardboard = this.lam(0xb5844b);
    M.pallet = this.lam(0xc39a62);
    M.trunk = this.lam(0x6b4a2f);
    M.leaf = this.lam(0x4f8a3a);
    M.leaf2 = this.lam(0x3d7530);
    M.hedge = this.lam(0x3f7a34);
    M.concrete = this.lam(0xb9b6ae);
    M.tire = this.lam(0x1b1c1e);
    M.chrome = new THREE.MeshPhongMaterial({ color: 0xd6dbe0, shininess: 80, specular: 0x666666, envMap: env, reflectivity: 0.55 });
    M.carGlass = new THREE.MeshPhongMaterial({ color: 0x1d2a36, shininess: 90, specular: 0x8899aa, envMap: env, reflectivity: 0.35 });
    M.glass = new THREE.MeshPhongMaterial({ color: 0xbfe1f2, transparent: true, opacity: 0.24, shininess: 100, specular: 0xffffff, depthWrite: false, envMap: env, reflectivity: 0.3 });
    M.contact = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    M.contact.userData.cast = false;
    M.glass.userData.cast = false;
    M.fridgeGlass = new THREE.MeshPhongMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.16, shininess: 100, specular: 0xffffff, depthWrite: false });
    M.fridgeGlass.userData.cast = false;
    M.fridgeIn = this.lam(0x9fb0c0, { emissive: 0x2e3c4a });
    M.coolLight = new THREE.MeshBasicMaterial({ color: 0xe8f6ff });
    M.lampOn = new THREE.MeshBasicMaterial({ color: 0xfff4d6 });
    M.cover = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.82 });
    for (const k of ['skirting', 'wallStripe']) M[k].userData.cast = false;
  }

  // ---------------------------------------------------------------- sky + lights

  buildSky() {
    const geo = new THREE.SphereGeometry(450, 32, 16);
    this.skyUni = { top: { value: new THREE.Color(0x4f95dc) }, bottom: { value: new THREE.Color(0xd5e8f6) },
      sunDir: { value: new THREE.Vector3(0.3, 0.6, 0.7).normalize() }, cloud: { value: 0.45 }, night: { value: 0 }, time: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float cloud; uniform float night; uniform float time;
        varying vec3 vP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
        void main(){
          vec3 d = normalize(vP);
          float h = clamp(d.y*1.6+0.08,0.0,1.0);
          vec3 col = mix(bottom, top, pow(h,0.8));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          col += vec3(1.0,0.85,0.6) * (pow(sd, 400.0) * 2.5 + pow(sd, 12.0) * 0.25) * (1.0 - night) * step(0.0, sunDir.y);
          if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.25) * 1.6 + vec2(time * 0.006, time * 0.002);
            float c = smoothstep(1.0 - cloud, 1.15 - cloud * 0.6, fbm(uv));
            vec3 cc = mix(vec3(1.0), vec3(0.62,0.66,0.72), cloud) * mix(1.0, 0.18, night);
            col = mix(col, cc, c * smoothstep(0.0, 0.25, d.y) * 0.9);
            // stars at night
            float st = step(0.997, hash(floor(d.xz / (d.y + 0.3) * 220.0))) * night * (1.0 - c);
            col += vec3(st);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xdfeeff, 0x8a8577, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    this.sun.position.set(60, 90, 140);
    this.sun.target.position.set(60, 0, 60);
    this.scene.add(this.sun, this.sun.target);
    if (this.renderer.shadowMap.enabled) {
      this.sun.castShadow = true;
      const s = this.sun.shadow;
      s.mapSize.set(2048, 2048);
      s.camera.left = -90; s.camera.right = 90; s.camera.top = 70; s.camera.bottom = -70;
      s.camera.near = 10; s.camera.far = 400;
      s.bias = -0.0006; s.normalBias = 0.04;
    }
    // interior: a grid of warm-white ceiling lights. Wing lights stay dark until it opens.
    this.interior = new THREE.AmbientLight(0xfff8ee, 0.24);   // fill light so faces away from the lamps aren't grey
    this.scene.add(this.interior);
    this.roomLights = [];
    // Every lit material evaluates every point light per pixel, so keep the count small. Lights of a
    // locked zone are dimmed (intensity 0), never hidden: changing the visible-light count would force
    // three.js to recompile every shader on the first frame and again at each level-up.
    const zoneLvl = (x, z) => { const tx = x / TILE, ty = z / TILE; for (const zn of this.world.zones) if (tx >= zn.x0 && tx < zn.x1 + 1 && ty >= zn.y0 && ty < zn.y1 + 1) return zn.lvl; return 1; };
    const add = (x, z, power = 380) => {
      const l = new THREE.PointLight(0xfff3e2, power, 62, 1.5);
      l.position.set(x, WALL_H - 0.4, z);
      l.userData.lvl = zoneLvl(x, z);
      l.userData.base = power;
      this.scene.add(l);
      this.roomLights.push(l);
    };
    add(wx(21), wz(20.5)); add(wx(21), wz(29.5), 300);   // zone 1: corner shop (aisles + tills)
    add(wx(34), wz(23.5));                         // zone 2: mini market
    add(wx(21), wz(8.5)); add(wx(34), wz(8.5));    // zone 3: back hall
    add(wx(49), wz(10)); add(wx(49), wz(25));      // zone 4: east wing
    add(17, 33, 300);                              // storage
  }

  // ---------------------------------------------------------------- helpers

  box(w, h, d, x, y, z, mat, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _m4.compose(_v.set(x, y, z), _q, _s.set(w, h, d));
    this.B.add(G.box, mat, _m4);
  }
  cyl(r, h, x, y, z, mat, seg = 16, rx = 0, rz = 0, ry = 0) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _m4.compose(_v.set(x, y, z), _q, _s.set(r * 2, h, r * 2));
    this.B.add(seg > 8 ? G.cyl : G.cyl8, mat, _m4);
  }
  blob(r, x, y, z, mat, sy = 1) {
    _q.identity();
    _m4.compose(_v.set(x, y, z), _q, _s.set(r * 2, r * 2 * sy, r * 2));
    this.B.add(G.ico, mat, _m4);
  }
  // soft dark ellipse on the floor under a static object (cheap ambient occlusion)
  contact(x, z, w, d) {
    _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0));
    _m4.compose(_v.set(x, 0.02, z), _q, _s.set(w, d, 1));
    this.B.add(G.plane, this.M.contact, _m4);
  }
  // a real (non-batched) mesh, for anything that moves or changes
  mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = this.scene) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  dbox(w, h, d, x, y, z, mat, parent) { return this.mesh(G.box, mat, x, y, z, w, h, d, parent); }

  // A flat sign: canvas texture on a plane. Returns the mesh; draw() repaints it.
  sign(w, h, px, draw, { basic = true } = {}) {
    const c = document.createElement('canvas');
    c.width = px; c.height = Math.round(px * h / w);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = basic
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      : new THREE.MeshLambertMaterial({ map: tex, transparent: true });
    const m = new THREE.Mesh(G.plane, mat);
    m.scale.set(w, h, 1);
    m.userData.redraw = (...args) => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height, ...args); tex.needsUpdate = true; };
    m.userData.redraw();
    this.scene.add(m);
    return m;
  }

  textSign(text, w, h, { fg = '#ffffff', bg = '#1f7a4d', font = 0.62, px = 512, basic = true } = {}) {
    return this.sign(w, h, px, (g, W, H) => {
      if (bg) { g.fillStyle = bg; roundRect(g, 0, 0, W, H, H * 0.14); g.fill(); }
      g.fillStyle = fg;
      g.font = `700 ${Math.round(H * font)}px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, W / 2, H / 2 + H * 0.04, W * 0.92);
    }, { basic });
  }

  // billboard text sprite (names, chat bubbles, alerts)
  sprite(w, h, px = 256) {
    const c = document.createElement('canvas');
    c.width = px; c.height = Math.round(px * h / w);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    s.scale.set(w, h, 1);
    s.userData = { c, tex, key: null };
    s.renderOrder = 10;
    return s;
  }
  setSprite(s, key, draw) {
    if (s.userData.key === key) return;
    s.userData.key = key;
    const { c, tex } = s.userData;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (key) draw(g, c.width, c.height);
    tex.needsUpdate = true;
    s.visible = !!key;
  }

  // ---------------------------------------------------------------- ground

  buildGround() {
    const W = this.world.w * TILE, H = this.world.h * TILE;

    // grass everywhere, then paving on top
    const grassTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6f9a4a'; g.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,80,25,.18)' : 'rgba(170,200,110,.16)'; g.fillRect(r() * w, r() * h, 2, 3); }
    }, { repeat: [80, 80] });
    const grass = this.mesh(G.plane, this.lam(0xffffff, { map: grassTex }), W / 2, -0.02, H / 2, 640, 640, 1);
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;

    // car park asphalt with painted bays
    const lotTex = canvasTex(2048, 512, (g, w, h) => {
      g.fillStyle = '#4a4d52'; g.fillRect(0, 0, w, h);
      const r = rng(3);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
      // the lot spans tile x 0..60 and y 36..45 (9 tiles): 2048px / 60 tiles
      const tx = w / 60, ty = h / 9;
      g.strokeStyle = 'rgba(240,240,232,.85)'; g.lineWidth = 4;
      for (const [y0, y1] of [[1, 3], [5, 7]]) {
        for (let x = 1; x <= 58; x += 1) {
          g.beginPath(); g.moveTo(x * tx, y0 * ty); g.lineTo(x * tx, y1 * ty); g.stroke();
        }
        g.beginPath(); g.moveTo(tx, y0 * ty); g.lineTo(58 * tx, y0 * ty); g.stroke();
      }
      g.setLineDash([30, 26]); g.strokeStyle = 'rgba(242,194,48,.8)';
      g.beginPath(); g.moveTo(0, 4 * ty); g.lineTo(w, 4 * ty); g.stroke();
    });
    const lot = this.mesh(G.plane, this.lam(0xffffff, { map: lotTex }), W / 2, 0.0, wz(36) + 9, W, 18, 1);
    lot.rotation.x = -Math.PI / 2; lot.receiveShadow = true;

    // sidewalk in front of the store and along the street
    const paveTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c9c4b8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(90,85,75,.35)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
    }, { repeat: [60, 3] });
    const walk = this.mesh(G.plane, this.lam(0xffffff, { map: paveTex }), W / 2, 0.03, wz(34) + 2, W + 40, 4.0, 1);
    walk.rotation.x = -Math.PI / 2; walk.receiveShadow = true;
    const walk2 = this.mesh(G.plane, this.lam(0xffffff, { map: paveTex }), W / 2, 0.03, wz(45) + 1.5, W + 120, 3.0, 1);
    walk2.rotation.x = -Math.PI / 2; walk2.receiveShadow = true;
    this.box(W + 120, 0.16, 0.25, W / 2, 0.08, wz(45) + 3.05, M_CURB(this));

    // road
    const roadTex = canvasTex(1024, 128, (g, w, h) => {
      g.fillStyle = '#3b3e43'; g.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
      g.fillStyle = '#e9e6dc';
      for (let x = 0; x < w; x += 64) g.fillRect(x, h / 2 - 2, 34, 4);
    }, { repeat: [8, 1] });
    const road = this.mesh(G.plane, this.lam(0xffffff, { map: roadTex }), W / 2, 0.01, wz(47) + 6, W + 360, 12, 1);
    road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
    const walk3 = this.mesh(G.plane, this.lam(0xffffff, { map: paveTex }), W / 2, 0.03, wz(47) + 13.5, W + 360, 3.0, 1);
    walk3.rotation.x = -Math.PI / 2;
  }

  // ---------------------------------------------------------------- building

  buildBuilding() {
    const rows = this.world.rows, W = this.world.w, H = this.world.h;
    const M = this.M;

    // ---- floors
    const tileTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#e9e8e3'; g.fillRect(0, 0, w, h);
      const r = rng(5), n = 4, s = w / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = 228 + Math.floor(r() * 14);
        g.fillStyle = `rgb(${v},${v - 1},${v - 5})`; g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(120,115,100,${r() * 0.12})`; g.fillRect(x * s + r() * s, y * s + r() * s, 2, 2); }
      }
      g.strokeStyle = '#b9b6ad'; g.lineWidth = 3;
      for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    }, { repeat: [42 / 1, 30 / 1] });
    const floorMat = new THREE.MeshPhongMaterial({ map: tileTex, shininess: 70, specular: 0x3a3a3a, envMap: this.envTex, reflectivity: 0.1, combine: THREE.MixOperation });
    const shop = this.mesh(G.plane, floorMat, (wx(15) + wx(57)) / 2, 0.005, (wz(3) + wz(33)) / 2, wx(42), wz(30), 1);
    shop.rotation.x = -Math.PI / 2; shop.receiveShadow = true;

    const concTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#a9a69d'; g.fillRect(0, 0, w, h);
      const r = rng(9);
      for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '40,40,40'},${r() * 0.07})`; g.fillRect(r() * w, r() * h, 3, 3); }
      g.strokeStyle = 'rgba(70,70,70,.3)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    }, { repeat: [6, 15] });
    const store = this.mesh(G.plane, this.lam(0xffffff, { map: concTex }), (wx(3) + wx(15)) / 2, 0.006, (wz(3) + wz(33)) / 2, wx(12), wz(30), 1);
    store.rotation.x = -Math.PI / 2; store.receiveShadow = true;

    const pad = this.world.pad;
    const padTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#8f8c84'; g.fillRect(0, 0, w, h);
      g.save(); g.beginPath(); g.rect(0, 0, w, h); g.rect(26, 26, w - 52, h - 52); g.clip('evenodd');
      for (let i = -h; i < w; i += 36) { g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 18, 0); g.lineTo(i + 18 + h, h); g.lineTo(i + h, h); g.fill(); }
      g.fillStyle = '#22252a';
      for (let i = -h + 18; i < w; i += 36) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 18, 0); g.lineTo(i + 18 + h, h); g.lineTo(i + h, h); g.fill(); }
      g.restore();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 54px ${FONT}`; g.textAlign = 'center';
      g.fillText('DELIVERIES', w / 2, h / 2 + 18);
    });
    const pw = (pad.x1 - pad.x0 + 1) * TILE, ph = (pad.y1 - pad.y0 + 1) * TILE;
    const padM = this.mesh(G.plane, this.lam(0xffffff, { map: padTex }), wx(pad.x0) + pw / 2, 0.012, wz(pad.y0) + ph / 2, pw, ph, 1);
    padM.rotation.x = -Math.PI / 2; padM.receiveShadow = true;

    // ---- ceiling + light panels
    const ceilTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#f1f2f0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9ccd0'; g.lineWidth = 5;
      g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    }, { repeat: [54, 30] });
    const ceil = this.mesh(G.plane, this.lam(0xffffff, { map: ceilTex, emissive: 0x6a6a68 }), wx(30), WALL_H, wz(18), wx(54), wz(30), 1);
    ceil.rotation.x = Math.PI / 2;

    const panels = [];
    for (let x = 17; x < 57; x += 2) for (let y = 4; y < 33; y += 3) panels.push([x, y]);
    for (let x = 4; x < 14; x += 3) for (let y = 4; y < 33; y += 4) panels.push([x, y]);
    const pm = new THREE.InstancedMesh(G.box, M.lampOn, panels.length);
    panels.forEach(([x, y], i) => { _m4.compose(_v.set(wx(x), WALL_H - 0.03, wz(y)), _q.identity(), _s.set(0.6, 0.05, 1.8)); pm.setMatrixAt(i, _m4); });
    this.scene.add(pm);

    // roof slab (casts the shadow that keeps the sun out of the store)
    this.box(wx(56), 0.5, wz(32), wx(30), WALL_H + 0.3, wz(18), M.roof);
    // roof plant boxes
    for (const [x, z] of [[30, 20], [50, 30], [86, 14], [96, 44]]) { this.box(5, 1.6, 3, x, WALL_H + 1.3, z, M.metal); this.cyl(0.9, 0.3, x, WALL_H + 2.2, z, M.metalDark); }

    // ---- walls: horizontal runs first, then vertical runs of what's left
    const used = new Set();
    const isWall = (x, y, set) => x >= 0 && y >= 0 && x < W && y < H && set.includes(rows[y][x]);
    const runs = (set, cb) => {
      for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < W) {
          if (isWall(x, y, set) && !used.has(y * W + x)) {
            let n = 0;
            while (x + n < W && isWall(x + n, y, set) && !used.has(y * W + x + n)) n++;
            if (n >= 2) { for (let k = 0; k < n; k++) used.add(y * W + x + k); cb(x, y, n, 1); }
            x += n;
          } else x++;
        }
      }
      for (let x = 0; x < W; x++) {
        let y = 0;
        while (y < H) {
          if (isWall(x, y, set) && !used.has(y * W + x)) {
            let n = 0;
            while (y + n < H && isWall(x, y + n, set) && !used.has((y + n) * W + x)) n++;
            for (let k = 0; k < n; k++) used.add((y + k) * W + x);
            cb(x, y, 1, n);
            y += n;
          } else y++;
        }
      }
    };

    runs(['#'], (x, y, nx, ny) => {
      const cx = wx(x + nx / 2), cz = wz(y + ny / 2), w = nx * TILE, d = ny * TILE;
      this.box(w, WALL_H, d, cx, WALL_H / 2, cz, M.wallIn);
      this.box(w + 0.02, 0.18, d + 0.02, cx, 0.09, cz, M.skirting);
      this.box(w + 0.02, 0.22, d + 0.02, cx, 2.55, cz, M.wallStripe);
    });

    // glass shopfront: kick plate, glass, transom, mullions
    runs(['G'], (x, y, nx, ny) => {
      const cx = wx(x + nx / 2), cz = wz(y + ny / 2), w = nx * TILE, d = ny * TILE;
      this.box(w, 0.35, d * 0.3, cx, 0.175, cz, M.metalDark);
      this.box(w, 3.2, 0.06, cx, 0.35 + 1.6, cz, M.glass);
      this.box(w, WALL_H - 3.55, d, cx, 3.55 + (WALL_H - 3.55) / 2, cz, M.exteriorDark);
      for (let k = 0; k <= nx; k++) this.box(0.12, 3.2, 0.2, wx(x + k), 1.95, cz, M.metalDark);
    });

    // hoarding walls between the store zones - each comes down when its store level is bought
    const hoardFor = (L) => {
      const tex = canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = '#20553c'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < w; i += 64) g.fillRect(i, 0, 3, h);
        g.fillStyle = '#f2c230'; g.fillRect(0, h - 26, w, 10);
        g.fillStyle = '#f2c230'; g.font = `700 30px ${FONT}`; g.textAlign = 'center';
        g.fillText('COMING SOON', w / 2, 62);
        g.fillStyle = '#ffffff'; g.font = `700 56px ${FONT}`;
        g.fillText(L ? L.name.toUpperCase() : 'EXPANSION', w / 2, 128);
        g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `500 24px ${FONT}`;
        g.fillText('Grow the store (U) to open this area', w / 2, 178);
      });
      return this.lam(0xffffff, { map: tex });
    };
    const wallMat = this.lam(0x2a5a43);
    for (const pt of this.world.partitions) {
      const grp = new THREE.Group();
      this.scene.add(grp);
      const L = this.world.levels[pt.lvl];
      const mat = hoardFor(L);
      const vertical = pt.x0 === pt.x1;
      const len = vertical ? pt.y1 - pt.y0 + 1 : pt.x1 - pt.x0 + 1;
      const cx = wx((pt.x0 + pt.x1 + 1) / 2), cz = wz((pt.y0 + pt.y1 + 1) / 2);
      const hw = vertical ? this.dbox(TILE * 0.5, WALL_H, len * TILE, cx, WALL_H / 2, cz, wallMat, grp)
        : this.dbox(len * TILE, WALL_H, TILE * 0.5, cx, WALL_H / 2, cz, wallMat, grp);
      hw.castShadow = true;
      // printed panels on both faces, every ~12 m
      for (let k = 6; k < len * TILE; k += 12) {
        for (const side of [-1, 1]) {
          const off = TILE * 0.25 + 0.02;
          const px = vertical ? cx + side * off : wx(pt.x0) + k, pz = vertical ? wz(pt.y0) + k : cz + side * off;
          const pl = this.mesh(G.plane, mat, px, 2.2, pz, 7, 3.5, 1, grp);
          pl.rotation.y = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
        }
      }
      // a locked zone with shop windows gets whitewashed glass and an "opening soon" print
      const zn = this.world.zones.find(z => z.lvl === pt.lvl);
      if (zn && zn.y1 >= 32) {
        const ww = (zn.x1 - zn.x0 + 1) * TILE - 0.4;
        const cover = this.sign(ww, 3.0, 1024, (g, w, h) => {
          g.fillStyle = 'rgba(236,240,236,.93)'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#1f7a4d'; g.fillRect(0, h * 0.78, w, h * 0.22);
          g.fillStyle = '#1f7a4d'; g.font = `700 ${h * 0.24}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('OPENING SOON', w / 2, h * 0.32);
          g.fillStyle = '#1d2430'; g.font = `600 ${h * 0.14}px ${FONT}`;
          g.fillText(`${L ? L.name : 'Expansion'} · more aisles, more choice`, w / 2, h * 0.58, w * 0.9);
          g.fillStyle = '#f2c230'; g.font = `700 ${h * 0.11}px ${FONT}`;
          g.fillText('MiniMart is growing', w / 2, h * 0.89);
        });
        this.scene.remove(cover); grp.add(cover);
        cover.position.set(wx((zn.x0 + zn.x1 + 1) / 2), 1.95, wz(33) + 0.08);
      }
      this.partitionWalls.push({ g: grp, lvl: pt.lvl });
    }

    // ---- exterior skin + fascia
    const bx0 = wx(2), bx1 = wx(58), bz0 = wz(2), bz1 = wz(34);
    this.box(bx1 - bx0, 0.5, 0.25, (bx0 + bx1) / 2, 0.25, bz1 + 0.12, M.concrete);
    this.box(0.08, WALL_H + 1.2, bz1 - bz0, bx0 - 0.04, (WALL_H + 1.2) / 2, (bz0 + bz1) / 2, M.exterior);
    this.box(0.08, WALL_H + 1.2, bz1 - bz0, bx1 + 0.04, (WALL_H + 1.2) / 2, (bz0 + bz1) / 2, M.exterior);
    this.box(bx1 - bx0, WALL_H + 1.2, 0.08, (bx0 + bx1) / 2, (WALL_H + 1.2) / 2, bz0 - 0.04, M.exterior);
    this.box(wx(13) + 0.1, WALL_H + 1.2, 0.08, wx(2) + wx(13) / 2, (WALL_H + 1.2) / 2, bz1 + 0.04, M.exterior);
    // parapet around the roof edge
    this.box(bx1 - bx0 + 0.3, 1.4, 0.3, (bx0 + bx1) / 2, WALL_H + 0.7, bz0, M.exterior);
    this.box(0.3, 1.4, bz1 - bz0, bx0, WALL_H + 0.7, (bz0 + bz1) / 2, M.exterior);
    this.box(0.3, 1.4, bz1 - bz0, bx1, WALL_H + 0.7, (bz0 + bz1) / 2, M.exterior);
    // green fascia across the glass front
    this.box(bx1 - wx(15) + 0.3, 2.5, 0.5, (wx(15) + bx1) / 2, WALL_H + 0.75, bz1 + 0.1, M.fascia);
    this.box(wx(15) - bx0, 1.4, 0.3, (bx0 + wx(15)) / 2, WALL_H + 0.7, bz1, M.exterior);

    // the store sign: lit letters on the fascia
    // entrance canopy
    const door = this.world.door;
    const dcx = wx((door.x0 + door.x1 + 1) / 2);

    // the store sign: lit letters on the fascia, with the current store level underneath
    const sign = this.sign(26, 2.0, 1024, (g, w, h, lvName) => {
      g.fillStyle = '#ffffff'; g.font = `700 ${h * 0.7}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,240,180,.6)'; g.shadowBlur = 18;
      g.fillText('MiniMart', w * 0.4, h * 0.42);
      g.fillStyle = '#f2c230'; g.font = `600 ${h * 0.26}px ${FONT}`;
      g.fillText((lvName || 'Corner Shop').toUpperCase(), w * 0.4, h * 0.86);
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `600 ${h * 0.24}px ${FONT}`;
      g.fillText('open 8 till 10', w * 0.84, h / 2 + 4);
    });
    sign.position.set(dcx, WALL_H + 0.85, bz1 + 0.37);
    this.storeSign = sign; this.signLevel = null;
    this.nightGlow.push({ m: sign, kind: 'sign' });
    this.box(wx(door.x1 - door.x0 + 3), 0.28, 3.6, dcx, 3.42, bz1 + 1.8, M.fascia);
    this.box(wx(door.x1 - door.x0 + 3) + 0.05, 0.06, 3.65, dcx, 3.26, bz1 + 1.8, M.metal);

    // automatic sliding doors (two pairs)
    this.doors = [];
    const glassDoor = this.M.glass;
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      const home = dcx + s * 2.0;
      leaf.position.set(home, 0, bz1 - 1.15);
      this.dbox(3.98, 3.1, 0.05, 0, 1.6, 0, glassDoor, leaf);
      this.dbox(3.98, 0.08, 0.1, 0, 3.15, 0, M.metalDark, leaf);
      this.dbox(3.98, 0.08, 0.1, 0, 0.05, 0, M.metalDark, leaf);
      this.dbox(0.06, 3.1, 0.1, s * -1.96, 1.6, 0, M.metalDark, leaf);
      this.dbox(0.04, 0.5, 0.12, s * -1.7, 1.2, 0, M.metal, leaf);
      this.scene.add(leaf);
      this.doors.push({ g: leaf, home, dir: s });
    }
    this.doorOpen = 0;
    // door header + sensors
    this.box(wx(door.x1 - door.x0 + 1), WALL_H - 3.2, 0.5, dcx, 3.2 + (WALL_H - 3.2) / 2, bz1 - 1.0, M.exteriorDark);
    const dmat = new THREE.MeshPhongMaterial({ color: 0x5a6068, shininess: 30 });
    const mat = this.mesh(G.box, dmat, dcx, 0.015, bz1 - 3.2, wx(door.x1 - door.x0 + 1) - 0.4, 0.02, 3.4);
    mat.receiveShadow = true;
    const welcome = this.textSign('WELCOME', 4, 0.7, { bg: null, fg: '#e8e2d0', font: 0.7 });
    welcome.position.set(dcx, 0.03, bz1 - 3.2); welcome.rotation.x = -Math.PI / 2;

    // OPEN/CLOSED neon in the window
    this.openSign = this.sign(2.2, 0.8, 256, (g, w, h, open) => {
      g.fillStyle = 'rgba(10,10,10,.7)'; roundRect(g, 0, 0, w, h, 14); g.fill();
      g.strokeStyle = open ? '#ff5a5a' : '#555'; g.lineWidth = 6; roundRect(g, 8, 8, w - 16, h - 16, 10); g.stroke();
      g.fillStyle = open ? '#ff8080' : '#777'; g.font = `700 ${h * 0.5}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = open ? '#ff3030' : 'transparent'; g.shadowBlur = 16;
      g.fillText(open ? 'OPEN' : 'CLOSED', w / 2, h / 2 + 3);
    });
    this.openSign.position.set(wx(door.x0) - 3.2, 2.4, bz1 - 0.95);
    this.openSign.rotation.y = Math.PI;
    this.openSign2 = this.openSign.clone();
    this.openSign2.rotation.y = 0;
    this.openSign2.position.z = bz1 - 0.9;
    this.scene.add(this.openSign2);
    this.openState = null;

    // night-time glow of the shop windows from outside
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0, depthWrite: false });
    const glow = this.mesh(G.plane, glowMat, (wx(15) + bx1) / 2, 1.9, bz1 + 0.05, bx1 - wx(15), 3.2, 1);
    this.windowGlow = glowMat;
    glow.renderOrder = 2;
  }

  buildStorage() {
    const M = this.M;
    const r = rng(42);
    const boxMats = [this.P.cardboard(0), this.P.cardboard(1), this.P.cardboard(2)];
    const rackRun = (x0, z0, x1, z1) => {          // world coords of a racking run
      const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const len = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = along ? len : 1.1, d = along ? 1.1 : len;
      for (let k = 0; k <= Math.round(len / 2.6); k++) {
        const t = -len / 2 + k * len / Math.round(len / 2.6);
        for (const o of [-0.5, 0.5]) {
          const px = along ? cx + t : cx + o, pz = along ? cz + o : cz + t;
          this.box(0.1, 3.6, 0.1, px, 1.8, pz, M.orange);
        }
      }
      for (const y of [0.15, 1.35, 2.55]) {
        for (const o of [-0.5, 0.5]) this.box(along ? len : 0.08, 0.12, along ? 0.08 : len, along ? cx : cx + o, y, along ? cz + o : cz, M.blue);
        this.box(w * 0.98, 0.05, d * 0.98, cx, y + 0.08, cz, M.pallet);
        for (let i = 0; i < len / 1.0; i++) {
          if (r() < 0.25) continue;
          const t = -len / 2 + 0.5 + i;
          const h = 0.4 + r() * 0.5;
          const bx = along ? cx + t : cx + (r() - 0.5) * 0.2, bz = along ? cz + (r() - 0.5) * 0.2 : cz + t;
          this.box(0.8, h, 0.8, bx, y + 0.1 + h / 2, bz, pickR(r, boxMats), r() * 0.2);
        }
      }
    };
    rackRun(wx(3.5), wz(12), wx(3.5), wz(31));
    rackRun(wx(6), wz(24.5), wx(12), wz(24.5));
    rackRun(wx(6), wz(29.5), wx(12), wz(29.5));

    // pallets + a pallet jack by the pad
    this.P.pallet(22, 24); this.P.pallet(24.5, 24, 0.1);
    for (let k = 0; k < 3; k++) this.box(0.6, 0.45, 0.5, 22 + (k % 2) * 0.5 - 0.25, 0.38 + Math.floor(k / 2) * 0.45, 24 + (k === 1 ? 0.25 : -0.2), this.P.cardboard(k), k * 0.1);
    this.P.palletJack(25, 21, Math.PI);
    // yellow safety lines: around the delivery pad and along the walkway to the shop door
    const pd = this.world.pad, px0 = wx(pd.x0) - 0.15, px1 = wx(pd.x1 + 1) + 0.15, pz0 = wz(pd.y0) - 0.15, pz1 = wz(pd.y1 + 1) + 0.15;
    this.P.floorLine(px0, pz0, px1, pz0); this.P.floorLine(px0, pz1, px1, pz1); this.P.floorLine(px0, pz0, px0, pz1); this.P.floorLine(px1, pz0, px1, pz1);
    for (const z of [wz(15) + 0.2, wz(18) - 0.2]) this.P.floorLine(wx(9), z, wx(14), z, 0.12);

    // roller door on the west wall + loading lights
    const doorTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#9aa3ab'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,45,50,.45)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
    const rdMat = this.lam(0xffffff, { map: doorTex });
    for (const x of [wx(3) + 0.02, wx(2) - 0.06]) {
      const d = this.mesh(G.plane, rdMat, x, 1.9, 14, 8, 3.8, 1);
      d.rotation.y = x > wx(2.5) ? Math.PI / 2 : -Math.PI / 2;
    }
    this.box(0.15, 0.15, 9, wx(3) + 0.1, 3.9, 14, M.yellow);

    this.box(TILE, WALL_H - 3.2, 3 * TILE, wx(14.5), 3.2 + (WALL_H - 3.2) / 2, wz(16.5), this.M.wallIn);
    this.box(TILE + 0.02, 0.22, 3 * TILE, wx(14.5), 2.55 + 0.9, wz(16.5), this.M.wallStripe);
    const s1 = this.textSign('STORAGE  ·  STAFF ONLY', 4.4, 0.6, { bg: '#2b3340' });
    s1.position.set(wx(15) + 0.04, 3.75, wz(16.5));
    s1.rotation.y = Math.PI / 2;
    const s2 = this.textSign('TO SHOP FLOOR', 3.4, 0.55, { bg: '#1f7a4d' });
    s2.position.set(wx(14) - 0.04, 3.75, wz(16.5));
    s2.rotation.y = -Math.PI / 2;

    // staff notice board
    const nb = this.sign(2.2, 1.4, 512, (g, w, h) => {
      g.fillStyle = '#c9a675'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a5a33'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
      const notes = [['#fff59d', 'Order at the terminal →'], ['#ffffff', 'Frozen → freezers only'], ['#c8e6c9', 'Mop spills fast!'], ['#ffccbc', 'Chilled → fridges']];
      notes.forEach(([c, t], i) => {
        const x = 26 + (i % 2) * 240, y = 30 + Math.floor(i / 2) * 150;
        g.fillStyle = c; g.fillRect(x, y, 210, 120);
        g.fillStyle = '#333'; g.font = `600 24px ${FONT}`; g.fillText(t, x + 10, y + 64, 190);
      });
    });
    nb.position.set(wx(14) - 0.03, 1.8, wz(10));
    nb.rotation.y = -Math.PI / 2;
  }

  // ---------------------------------------------------------------- fixtures

  buildFixtures() {
    const M = this.M;
    const pegTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#e3e6ea'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(80,90,100,.35)';
      for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    }, { repeat: [4, 2] });
    const pegMat = this.lam(0xffffff, { map: pegTex });
    const crateTex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#b07a45'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(60,35,15,.35)';
      for (let y = 0; y < h; y += 32) g.fillRect(0, y + 26, w, 6);
      g.fillStyle = 'rgba(255,230,190,.15)'; for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 3, h);
    });
    const crateMat = this.lam(0xffffff, { map: crateTex });

    for (const f of this.world.fixtures) {
      const cx = wx(f.cx), cz = wz(f.cy);
      this.contact(cx, cz, 4.6, 2.0);
      const parts = { f, label: null, cover: null };
      if (f.kind === 'shelf') {
        // single-sided gondola facing south (+z)
        this.box(4.0, 0.16, 1.2, cx, 0.08, cz, M.metalDark);
        this.box(4.0, 2.3, 0.08, cx, 1.3, cz - 0.56, pegMat);
        this.P.shelfTrim(cx, cz);
        for (const ly of [0.55, 1.15, 1.75]) {
          this.box(3.96, 0.04, 1.05, cx, ly, cz - 0.02, M.metal);
          this.box(3.96, 0.08, 0.03, cx, ly + 0.02, cz + 0.52, M.green);
        }
        this.box(3.96, 0.3, 1.05, cx, 0.32, cz - 0.02, M.metal);
        for (const s of [-1, 1]) this.box(0.06, 2.3, 1.2, cx + s * 1.98, 1.15, cz, M.metal);
        parts.label = this.fixtureLabel(cx, 2.62, cz - 0.5);
        parts.strip = this.shelfStrip(cx, cz + 0.545, [0.58, 1.18, 1.78]);
        parts.wobbler = this.wobbler(cx + 1.45, 1.42, cz + 0.62);
      } else if (f.kind === 'fridge') {
        // open-fronted cabinet: back, sides, top and plinth (the glass doors close it)
        this.box(4.0, 2.4, 0.08, cx, 1.2, cz - 0.71, M.white);
        for (const sd of [-1, 1]) this.box(0.1, 2.4, 1.3, cx + sd * 1.95, 1.2, cz - 0.1, M.white);
        this.box(4.0, 0.3, 1.3, cx, 2.25, cz - 0.1, M.white);
        this.box(4.0, 0.28, 1.3, cx, 0.14, cz - 0.1, M.metalDark);
        this.box(3.8, 2.0, 0.05, cx, 1.2, cz - 0.65, M.fridgeIn);
        this.box(3.8, 0.04, 1.0, cx, 0.3, cz, M.fridgeIn);
        for (const ly of [0.7, 1.25, 1.8]) this.box(3.76, 0.03, 0.95, cx, ly - 0.06, cz, M.metal);
        this.box(3.8, 0.08, 0.1, cx, 2.25, cz + 0.2, M.coolLight);
        this.box(3.9, 1.95, 0.04, cx, 1.25, cz + 0.56, M.fridgeGlass);
        this.box(4.0, 0.42, 0.12, cx, 2.62, cz + 0.42, M.blue);
        this.P.fridgeTrim(cx, cz);
        parts.label = this.fixtureLabel(cx, 2.62, cz + 0.49);
        parts.strip = this.shelfStrip(cx, cz + 0.5, [0.62, 1.17, 1.72]);
        parts.wobbler = this.wobbler(cx + 1.5, 1.6, cz + 0.62);
      } else if (f.kind === 'freezer') {
        this.box(4.0, 0.5, 1.5, cx, 0.25, cz, M.white);
        for (const sd of [-1, 1]) this.box(4.0, 0.42, 0.08, cx, 0.7, cz + sd * 0.71, M.white);
        for (const sd of [-1, 1]) this.box(0.08, 0.42, 1.5, cx + sd * 1.96, 0.7, cz, M.white);
        this.box(3.8, 0.04, 1.3, cx, 0.53, cz, M.fridgeIn);
        this.box(3.9, 0.04, 1.4, cx, 0.93, cz, M.fridgeGlass);
        for (const sd of [-1, 1]) this.box(4.02, 0.08, 0.1, cx, 0.92, cz + sd * 0.71, M.blue);
        for (const sd of [-1, 1]) this.box(0.1, 0.08, 1.52, cx + sd * 1.96, 0.92, cz, M.blue);
        this.box(4.0, 0.14, 0.04, cx, 0.6, cz + 0.76, M.coolLight);
        this.P.freezerTrim(cx, cz);
        parts.label = this.fixtureLabel(cx, 1.55, cz - 0.6);
        parts.wobbler = this.wobbler(cx + 1.6, 1.25, cz + 0.8);
      } else if (f.kind === 'produce') {
        this.P.produceStand(cx, cz, f.id);
        for (const s of [-1, 1]) {
          // two tilted crates
          this.box(1.9, 0.35, 1.3, cx + s * 1.0, 0.88, cz, crateMat, 0, 0.18);
        }
        this.box(4.0, 1.25, 0.1, cx, 1.32, cz - 0.72, M.woodDark);
        parts.label = this.fixtureLabel(cx, 2.3, cz - 0.62);
        parts.wobbler = this.wobbler(cx + 1.7, 1.55, cz + 0.75);
      }
      this.fixParts[f.id] = parts;
    }
  }

  // a strip of shelf-edge price tickets along the front lip of each shelf level
  shelfStrip(cx, z, levels) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 40;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    mat.userData.cast = false;
    const b = new Batcher();
    for (const y of levels) { _m4.compose(_v.set(cx, y, z), _q.identity(), _s.set(3.9, 0.075, 1)); b.add(G.plane, mat, _m4); }
    b.build(this.scene);
    const redraw = info => {
      const g = c.getContext('2d');
      g.fillStyle = '#f4f6f5'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#1f7a4d'; g.fillRect(0, c.height - 4, c.width, 4);
      if (info) for (let i = 0; i < 4; i++) {
        const x = 30 + i * 256;
        g.fillStyle = info.expired ? '#8a8f96' : info.promo ? '#e5483b' : '#f2c230'; g.fillRect(x, 3, 112, 32);
        g.fillStyle = info.expired || info.promo ? '#fff' : '#1d2430'; g.font = `700 24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(info.expired ? 'EXPIRED' : '₹' + info.price, x + 56, 20);
        g.fillStyle = '#1d2430'; g.font = `500 13px ${FONT}`; g.textAlign = 'left';
        g.fillText(info.short, x + 120, 14, 120); g.fillText(info.size, x + 120, 29, 120);
        for (let k = 0; k < 18; k++) if ((k * 7 + i) % 3) g.fillRect(x + 200 + k * 2.2, 22, 1.4, 12);
      }
      tex.needsUpdate = true;
    };
    redraw(null);
    return { redraw };
  }

  // red "OFFER" sign on a stalk, shown when the fixture's product is on promotion
  wobbler(x, y, z) {
    // every OFFER sign shares the first one's texture and material
    if (this.wobblerMat) {
      const m = this.mesh(G.plane, this.wobblerMat, x, y, z, 0.42, 0.42, 1);
      m.visible = false;
      return m;
    }
    const m = this.sign(0.42, 0.42, 128, (g, w, h) => {
      g.fillStyle = '#e5483b';
      g.beginPath();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = (i % 2 ? 0.43 : 0.5) * w; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); }
      g.fill();
      g.fillStyle = '#fff'; g.font = `700 ${h * 0.24}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('OFFER', w / 2, h / 2 + 2);
    });
    m.position.set(x, y, z);
    m.visible = false;
    this.wobblerMat = m.material;
    return m;
  }

  fixtureLabel(x, y, z) {
    const m = this.sign(3.0, 0.46, 512, (g, w, h, info) => {
      if (!info) {
        g.fillStyle = 'rgba(255,255,255,.85)'; roundRect(g, 0, 0, w, h, 8); g.fill();
        g.fillStyle = '#8a929c'; g.font = `600 ${h * 0.45}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('empty', w / 2, h / 2 + 2);
        return;
      }
      g.fillStyle = '#ffffff'; roundRect(g, 0, 0, w, h, 8); g.fill();
      g.fillStyle = info.color; g.fillRect(0, 0, 14, h);
      g.fillStyle = '#1d2430'; g.font = `600 ${h * 0.46}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(info.name, 28, h / 2 + 2, w * 0.58);
      g.fillStyle = info.expired ? '#5a5f66' : info.promo ? '#e5483b' : '#f2c230';
      roundRect(g, w * 0.66, 6, w * 0.34 - 6, h - 12, 8); g.fill();
      g.fillStyle = info.expired || info.promo ? '#ffffff' : '#1d2430'; g.font = `700 ${h * 0.58}px ${FONT}`; g.textAlign = 'center';
      g.fillText(info.expired ? 'EXPIRED' : '₹' + info.price, w * 0.83, h / 2 + 3, w * 0.3);
      if (info.promo && !info.expired) {
        g.fillStyle = '#e5483b'; roundRect(g, w * 0.44, 4, w * 0.2, h * 0.42, 6); g.fill();
        g.fillStyle = '#fff'; g.font = `700 ${h * 0.3}px ${FONT}`; g.fillText('PROMO', w * 0.54, h * 0.26);
      }
    }, { basic: true });
    m.position.set(x, y, z);
    m.userData.key = null;
    return m;
  }

  // ---------------------------------------------------------------- checkouts

  buildCheckouts() {
    const M = this.M;
    const beltTex = canvasTex(128, 32, (g, w, h) => {
      g.fillStyle = '#26292d'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h);
    }, { repeat: [3, 1] });
    const beltMat = this.lam(0xffffff, { map: beltTex });
    for (const c of this.world.checkouts) {
      const cx = wx(c.cx), cz = wz(c.cy);
      this.contact(cx, cz, 4.6, 1.7);
      this.P.checkout(cx, cz);
      this.box(2.6, 0.04, 0.6, cx - 0.6, 1.0, cz, beltMat);
      this.box(0.06, 1.85, 0.06, cx - 1.9, 1.9, cz, this.P.mat.steel);   // lane light pole
      this.box(1.6, 0.03, 1.2, cx, 0.015, cz + 2.2, M.rubber);           // clerk floor mat
      const parts = {};
      parts.lamp = this.mesh(G.box, new THREE.MeshBasicMaterial({ color: 0x444a52 }), cx - 1.9, 2.85, cz, 0.42, 0.42, 0.42);
      parts.num = this.textSign(String(c.id + 1), 0.36, 0.36, { bg: null, fg: '#1d2430', font: 0.8, px: 128 });
      parts.num.position.set(cx - 1.9, 2.85, cz + 0.22);
      parts.num2 = this.textSign(String(c.id + 1), 0.36, 0.36, { bg: null, fg: '#1d2430', font: 0.8, px: 128 });
      parts.num2.position.set(cx - 1.9, 2.85, cz - 0.22); parts.num2.rotation.y = Math.PI;
      // POS screen (faces the clerk) + customer display (faces the queue)
      parts.screen = this.sign(0.62, 0.42, 256, (g, w, h, d) => this.drawPos(g, w, h, d));
      parts.screen.position.set(cx + 1.0, 1.55, cz + 0.12); parts.screen.rotation.x = -0.25;
      this.box(0.66, 0.46, 0.05, cx + 1.0, 1.55, cz + 0.09, M.black, 0, -0.25);
      this.box(0.06, 0.4, 0.06, cx + 1.0, 1.2, cz + 0.05, M.black);
      parts.cust = this.sign(0.55, 0.3, 256, (g, w, h, d) => this.drawPos(g, w, h, d, true));
      parts.cust.position.set(cx + 1.7, 1.38, cz - 0.42); parts.cust.rotation.y = Math.PI;
      this.box(0.58, 0.33, 0.04, cx + 1.7, 1.38, cz - 0.39, M.black);
      this.box(0.05, 0.3, 0.05, cx + 1.7, 1.15, cz - 0.37, M.black);
      parts.closed = this.textSign('LANE CLOSED', 1.4, 0.35, { bg: '#e45b5b', px: 256 });
      parts.closed.position.set(cx - 0.6, 1.25, cz - 0.56); parts.closed.rotation.y = Math.PI;
      parts.items = [];   // little product blobs on the belt
      for (let i = 0; i < 6; i++) {
        const it = this.mesh(G.box, M.white, cx - 1.6 + i * 0.4, 1.12, cz, 0.22, 0.18, 0.16);
        it.visible = false;
        parts.items.push(it);
      }
      parts.key = null;
      this.checkoutParts[c.id] = parts;
    }
    const s = this.textSign('CHECKOUTS', 6, 0.9, { bg: '#1f7a4d' });
    s.position.set(wx(18.5), 3.7, wz(25.2)); s.rotation.y = Math.PI;
    const s2 = s.clone(); s2.rotation.y = 0; s2.position.z += 0.02; this.scene.add(s2);
  }

  // POS screen (clerk side) and customer display: item count, running total, payment step
  drawPos(g, w, h, d, cust) {
    g.fillStyle = cust ? '#0e2a1e' : '#10161f'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (!d) {
      g.fillStyle = '#5a6a7a'; g.font = `600 ${h * 0.2}px ${FONT}`;
      g.fillText(cust ? 'Next customer please' : 'READY', w / 2, h / 2 + 6);
      return;
    }
    if (d.done) {
      g.fillStyle = '#6cf08a'; g.font = `700 ${h * 0.24}px ${FONT}`;
      g.fillText(cust ? 'Thank you!' : 'PAID ✓', w / 2, h * 0.45);
      g.fillStyle = '#cfe0d7'; g.font = `600 ${h * 0.15}px ${FONT}`;
      g.fillText(d.m === 'cash' && d.ch ? `Change ₹${d.ch}` : `₹${d.sum} by ${d.m === 'upi' ? 'UPI' : d.m === 'card' ? 'card' : 'cash'}`, w / 2, h * 0.75);
      return;
    }
    g.textAlign = 'left'; g.fillStyle = '#8fd19e'; g.font = `600 ${h * 0.15}px ${FONT}`;
    g.fillText(`Items ${d.sc}/${d.tot}`, 12, h * 0.24);
    g.fillStyle = '#ffffff'; g.font = `700 ${h * 0.32}px ${FONT}`;
    g.fillText('₹' + d.sum, 12, h * 0.62);
    let msg = 'scanning…', col = '#5a6a7a';
    if (d.st === 'total') { msg = cust ? 'Please pay' : 'ASK FOR PAYMENT'; col = '#f2c230'; }
    else if (d.st === 'card') { msg = cust ? 'Tap card · enter PIN' : 'CARD · awaiting PIN'; col = '#7fb2ff'; }
    else if (d.st === 'upi') { msg = cust ? 'Scan QR to pay' : 'UPI · awaiting payment'; col = '#c6a8ff'; }
    else if (d.st === 'cash') { msg = d.due > d.g ? `Cash ₹${d.td} · change ₹${d.due - d.g}` : `Cash ₹${d.td} · exact`; col = '#f2c230'; }
    g.fillStyle = col; g.font = `600 ${h * 0.13}px ${FONT}`;
    g.fillText(msg, 12, h * 0.88, w - 24);
    if (cust && d.st === 'upi') {
      // a little QR code for the shopper
      const q = h * 0.62, x0 = w - q - 10, y0 = 8, n = 9, c = q / n;
      g.fillStyle = '#ffffff'; g.fillRect(x0 - 3, y0 - 3, q + 6, q + 6);
      g.fillStyle = '#111';
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (((i * 7 + j * 13 + i * j) % 5 < 2) || ((i < 3 || i > 5) && (j < 3 || j > 5) && (i % 6 === 0 || j % 6 === 0 || i === 1 || j === 1 || i === 7 || j === 7))) g.fillRect(x0 + i * c, y0 + j * c, c, c);
    }
  }

  buildTerminal() {
    const t = this.world.terminal;
    const x = wx(t.x + 0.5), z = wz(t.y + 0.5);
    this.box(1.2, 1.0, 0.9, x, 0.5, z, this.M.metalDark);
    this.box(1.3, 0.05, 1.0, x, 1.02, z, this.M.metal);
    this.box(0.12, 0.5, 0.12, x, 1.3, z, this.M.black);
    const scr = this.sign(1.1, 0.7, 512, (g, w, h) => {
      g.fillStyle = '#0d2b45'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#4ea3e0'; g.fillRect(0, 0, w, h * 0.2);
      g.fillStyle = '#ffffff'; g.font = `700 ${h * 0.12}px ${FONT}`; g.fillText('SUPPLIER', 14, h * 0.14);
      g.font = `500 ${h * 0.1}px ${FONT}`;
      ['Dry goods', 'Chilled', 'Frozen', 'Produce'].forEach((s, i) => { g.fillStyle = i % 2 ? '#9fd8ff' : '#ffffff'; g.fillText('▸ ' + s, 20, h * (0.36 + i * 0.16)); });
    });
    scr.position.set(x, 1.65, z); scr.rotation.y = -Math.PI / 2;
    this.box(0.05, 0.76, 1.16, x + 0.03, 1.65, z, this.M.black);
    const s = this.textSign('ORDER STOCK', 2.2, 0.45, { bg: '#2b3340' });
    s.position.set(x - 0.02, 2.45, z); s.rotation.y = -Math.PI / 2;
  }

  // ---------------------------------------------------------------- interior dressing

  buildDecor() {
    const M = this.M;
    // hanging aisle signs over each shelf run
    const runs = [];
    const fx = this.world.fixtures.filter(f => f.kind === 'shelf');
    const byRow = new Map();
    for (const f of fx) { const k = f.ty + ':' + f.lvl; if (!byRow.has(k)) byRow.set(k, []); byRow.get(k).push(f); }
    let aisle = 1;
    for (const list of byRow.values()) {
      list.sort((a, b) => a.tx - b.tx);
      let cur = [list[0]];
      for (let i = 1; i <= list.length; i++) {
        if (i < list.length && list[i].tx === cur[cur.length - 1].tx + 2) { cur.push(list[i]); continue; }
        runs.push(cur);
        if (i < list.length) cur = [list[i]];
      }
    }
    // aisles are numbered in the order the store grows, nearest the tills first
    runs.sort((a, b) => (a[0].lvl - b[0].lvl) || (b[0].ty - a[0].ty) || (a[0].tx - b[0].tx));
    for (const r of runs) {
      const x = wx((r[0].tx + r[r.length - 1].tx + 2) / 2), z = wz(r[0].ty + 1.4);
      const s = this.textSign(`AISLE ${aisle++}`, 2.4, 0.6, { bg: '#1f7a4d' });
      s.position.set(x, 3.5, z);
      const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z -= 0.02; this.scene.add(s2);
      this.box(0.02, 0.85, 0.02, x - 1.0, WALL_H - 0.43, z, M.metalDark);
      this.box(0.02, 0.85, 0.02, x + 1.0, WALL_H - 0.43, z, M.metalDark);
    }
    const sec = (text, x, z, bg, ry = 0) => {
      const s = this.textSign(text, 4.2, 0.75, { bg });
      s.position.set(x, 3.75, z); s.rotation.y = ry;
      return s;
    };
    // zone 1: corner shop
    sec('MILK & EGGS', wx(18), wz(16.6), '#2f5f9e').position.y = 3.4;
    sec('FRUIT & VEG', wx(24), wz(16.6), '#4f8a3a').position.y = 3.4;
    // zone 2: mini market
    sec('DAIRY', wx(32), wz(16.6), '#2f5f9e').position.y = 3.4;
    sec('FRESH PRODUCE', wx(38), wz(16.6), '#4f8a3a').position.y = 3.4;
    // zone 3: back hall
    sec('CHILLED', wx(20), wz(4.4), '#2f5f9e');
    sec('FROZEN', wx(29), wz(4.4), '#3a8fd0');
    sec('DRINKS & DAIRY', wx(37), wz(4.4), '#2f5f9e');
    // zone 4: east wing
    sec('EAST WING', wx(49), wz(4.4), '#1f7a4d');
    sec('FRESH PRODUCE', wx(47), wz(20.6), '#4f8a3a').position.y = 3.3;

    // wall clock above the checkouts (shows the store clock)
    this.clockFace = this.sign(1.1, 1.1, 256, (g, w, h, mins) => {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fill();
      g.strokeStyle = '#1d2430'; g.lineWidth = 8; g.stroke();
      g.fillStyle = '#1d2430';
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(w / 2 + Math.sin(a) * w * 0.4 - 3, h / 2 - Math.cos(a) * h * 0.4 - 3, 6, 6); }
      const m = mins || 0, hr = (m / 60) % 12, mn = m % 60;
      const hand = (a, l, wd) => { g.lineWidth = wd; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(a) * l, h / 2 - Math.cos(a) * l); g.stroke(); };
      hand(hr / 12 * Math.PI * 2, w * 0.24, 10); hand(mn / 60 * Math.PI * 2, w * 0.36, 6);
    });
    this.clockFace.position.set(wx(15) + 0.05, 3.2, wz(27));
    this.clockFace.rotation.y = Math.PI / 2;

    // waste bin (dumpster) in storage
    const bin = this.world.bin;
    if (bin) {
      const bx = wx(bin.x + 0.5), bz = wz(bin.y + 0.5);
      this.contact(bx, bz, 2.4, 1.8);
      this.box(1.8, 1.1, 1.3, bx, 0.6, bz, this.lam(0x2f6d4a));
      this.box(1.86, 0.08, 1.36, bx, 1.18, bz - 0.05, M.black, 0, -0.12);
      for (const s2 of [-0.8, 0.8]) this.cyl(0.09, 0.08, bx + s2, 0.06, bz + 0.5, M.black, 8, 0, Math.PI / 2);
      const t = this.textSign('WASTE', 1.2, 0.36, { bg: '#e5483b', px: 256 });
      t.position.set(bx, 0.75, bz + 0.66);
    }

    // fabric banners across the main hall
    const banner = (text, sub, color, x, z) => {
      const b2 = this.sign(5.5, 1.3, 512, (g, w, h) => {
        g.fillStyle = color; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, h * 0.78, w, h * 0.22);
        g.fillStyle = '#ffffff'; g.font = `700 ${h * 0.36}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, w / 2, h * 0.38, w * 0.92);
        g.fillStyle = '#f2c230'; g.font = `600 ${h * 0.17}px ${FONT}`; g.fillText(sub, w / 2, h * 0.88, w * 0.92);
      }, { basic: false });
      b2.position.set(x, 3.35, z);
      const back = b2.clone(); back.rotation.y = Math.PI; back.position.z -= 0.01; this.scene.add(back);
      this.box(5.7, 0.06, 0.06, x, 4.02, z, M.metalDark);
    };
    banner('Fresh deals every day', 'Look for the red promo tags', '#c62d2d', wx(21), wz(24.6));
    banner('Join our loyalty club', 'Happy shoppers come back', '#1f7a4d', wx(34.5), wz(24.6));
    banner('Cold drinks at the back', 'Chilled and frozen aisles', '#2f5f9e', wx(28), wz(9.4));
    banner('Superstore savings', 'More aisles, more choice', '#c62d2d', wx(49), wz(23.4));

    // promo posters on the side walls
    const poster = (title, sub, color, x, z, ry) => {
      const p = this.sign(2.4, 1.6, 512, (g, w, h) => {
        g.fillStyle = color; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(w * 0.85, h * 0.2, h * 0.5, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; g.font = `700 ${h * 0.2}px ${FONT}`; g.fillText(title, 24, h * 0.42, w - 40);
        g.fillStyle = '#f2c230'; g.font = `600 ${h * 0.11}px ${FONT}`; g.fillText(sub, 24, h * 0.62, w - 40);
      }, { basic: false });
      p.position.set(x, 1.9, z); p.rotation.y = ry;
    };
    poster('Fresh every day', 'Fruit & veg by the window', '#4f8a3a', wx(57) - 0.03, wz(12), -Math.PI / 2);
    poster('Weekly deals', 'Watch the price tags', '#c62d2d', wx(15) + 0.05, wz(29.4), Math.PI / 2);
    poster('Ice cold', 'Chilled drinks at the back wall', '#2f5f9e', wx(15) + 0.05, wz(8), Math.PI / 2);

    // potted plants + bins by the door, trolley bay
    const door = this.world.door;
    const P = this.P;
    // plants, baskets, bench and bin come from the server's prop list (players collide with them)
    for (const p of this.world.props || []) {
      const x = wx(p.x), z = wz(p.y);
      if (p.k === 'palm') P.palm(x, z, p.s, p.seed);
      else if (p.k === 'ficus') P.ficus(x, z, p.s, p.seed);
      else if (p.k === 'snake') P.snake(x, z, p.s, p.seed);
      else if (p.k === 'bin') P.bin(x, z);
      else if (p.k === 'bench') P.bench(x, z, 0);
      else if (p.k === 'basket') P.basketStack(x, z, p.n, p.ry);
    }

    // ceiling fittings: CCTV domes over each zone, speakers, exit signs over the doors
    for (const [x, y] of [[20, 24], [33, 24], [24, 9], [34, 9], [48, 10], [48, 25], [16, 28]]) P.cctvDome(wx(x), WALL_H, wz(y));
    for (let x = 18; x < 57; x += 8) for (const y of [12, 23]) P.speaker(wx(x), WALL_H, wz(y));
    P.exitSign(wx((door.x0 + door.x1 + 1) / 2), 3.6, wz(33) - 0.55, Math.PI);
    P.exitSign(wx(14) + 0.5, 3.2, wz(16.5), Math.PI / 2);
    P.extinguisher(wx(15), wz(19.6), Math.PI / 2);
    P.extinguisher(wx(57), wz(28), -Math.PI / 2);
    const tb = this.world.trolleys[0];
    this.cartRow(wx(tb[0] + 0.1), wz(tb[1] + 0.5), 5);
    this.cartRow(wx(44.1), wz(35.5), 4);
    this.box(4.2, 0.08, 0.08, wx(45), 0.9, wz(35.1), M.metal);
    this.box(4.2, 0.08, 0.08, wx(45), 0.9, wz(35.9), M.metal);

    // security gates either side of the door
    for (const x of [wx(door.x0) - 0.15, wx(door.x1 + 1) + 0.15]) {
      this.box(0.12, 1.6, 0.6, x, 0.8, wz(32.6), this.gateMat || (this.gateMat = new THREE.MeshPhongMaterial({ color: 0xc8d6e0, transparent: true, opacity: 0.6 })));
    }
  }

  cartRow(x, z, n) {
    // trolleys nest into each other, so a row is mostly overlapping wire baskets
    for (let i = 0; i < n; i++) this.P.cart(x + i * 0.34, z, Math.PI / 2);
  }
  // ---------------------------------------------------------------- outdoors

  buildOutside() {
    const M = this.M;
    const r = rng(1234);
    const carColors = [0xc0392b, 0x2c3e50, 0xecf0f1, 0x7f8c8d, 0x2980b9, 0x16a085, 0x8e6c3a, 0x1d1f22, 0xd35400, 0x95a5a6];
    const carMats = carColors.map(c => new THREE.MeshPhongMaterial({ color: c, shininess: 70, specular: 0x444444, envMap: this.envTex, reflectivity: 0.18 }));

    const car = (x, z, ry, mat) => this.P.parkedCar(x, z, ry, mat);
    for (const x of this.world.cars.a) car(wx(x + 0.5), wz(38), Math.PI, pickR(r, carMats));
    for (const x of this.world.cars.b) car(wx(x + 0.5), wz(42), 0, pickR(r, carMats));

    // trees in round planters
    for (const [tx, ty] of this.world.trees) {
      const x = wx(tx + 0.5), z = wz(ty + 0.5);
      this.P.tree(x, z, 0.9, tx * 7 + ty);
    }
    // more trees beyond the car park and around the back
    for (let i = 0; i < 26; i++) {
      const x = -30 + i * 7.5 + r() * 3, z = 112 + r() * 4;
      if (r() < 0.3) continue;
      this.P.tree(x, z, 1.1 + r() * 0.3, i + 40, false);
    }
    for (let i = 0; i < 18; i++) {
      const x = -20 + i * 9 + r() * 4, z = -10 - r() * 14;
      this.P.tree(x, z, 1.2 + r() * 0.4, i + 80, false);
    }

    // hedge along the street edge of the car park, with gaps for the paths
    for (const [x0, x1] of [[2, 18], [22, 37], [43, 58]]) this.box(wx(x1 - x0), 0.9, 0.9, wx((x0 + x1) / 2), 0.45, wz(45) + 0.6, this.P.mat.hedge);

    // lamp posts (bulbs glow at night)
    this.lampBulbs = [];
    const lamp = (x, z) => {
      this.cyl(0.09, 6, x, 3, z, M.metalDark, 8);
      this.box(1.4, 0.12, 0.3, x + 0.6, 6, z, M.metalDark);
      this.lampBulbs.push([x + 1.1, 5.9, z]);
    };
    for (const x of [10, 30, 56, 96, 112]) lamp(x, wz(45) + 0.6);
    for (const x of [6, 34, 60, 90, 116]) lamp(x, wz(47) + 13.2);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0x777066 });
    const bm = new THREE.InstancedMesh(G.box, this.bulbMat, this.lampBulbs.length);
    this.lampBulbs.forEach(([x, y, z], i) => { _m4.compose(_v.set(x, y, z), _q.identity(), _s.set(0.5, 0.08, 0.25)); bm.setMatrixAt(i, _m4); });
    this.scene.add(bm);
    // a pair of real lights for the car park at night
    // real car-park lights at night only on High: on lower settings they'd cost every pixel in the store
    this.lotLights = [];
    if (this.quality === 'high') {
      this.lotLights = [new THREE.PointLight(0xffe2b0, 0, 40, 1.4), new THREE.PointLight(0xffe2b0, 0, 40, 1.4)];
      this.lotLights[0].position.set(40, 5.5, 80); this.lotLights[1].position.set(90, 5.5, 80);
      this.scene.add(...this.lotLights);
    }

    // delivery truck at the west loading door
    const tx = -4.5, tz = 15;
    this.box(3.2, 3.6, 9, tx, 2.3, tz - 1, M.white);
    this.box(3.22, 0.5, 9.02, tx, 3.9, tz - 1, M.green);
    this.box(2.8, 2.4, 2.6, tx, 1.9, tz + 4.6, this.lam(0x1f7a4d));
    this.box(2.6, 0.9, 0.06, tx, 2.6, tz + 5.92, M.carGlass);
    for (const z of [tz - 4, tz - 2.6, tz + 4.6]) for (const s of [-1, 1]) this.cyl(0.5, 0.35, tx + s * 1.45, 0.5, z, M.tire, 12, 0, Math.PI / 2);
    const truckSign = this.textSign('MINIMART SUPPLY CO.', 7, 0.9, { bg: null, fg: '#1f7a4d' });
    truckSign.position.set(tx - 1.62, 2.4, tz - 1); truckSign.rotation.y = -Math.PI / 2;

    // neighbourhood across the road
    const winTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3b4652';
      for (let y = 16; y < h; y += 64) for (let x = 16; x < w; x += 64) g.fillRect(x, y, 34, 40);
    });
    this.townWindows = [];
    const town = (x, z, w, d, h, color) => {
      const wt = winTex.clone(); wt.needsUpdate = true; wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
      const m = this.lam(color, { map: wt, emissive: 0x000000, emissiveMap: wt });
      this.townWindows.push(m);
      const b = this.mesh(G.box, m, x, h / 2, z, w, h, d);
      b.castShadow = false; b.receiveShadow = true;
      this.box(w + 0.4, 0.5, d + 0.4, x, h + 0.25, z, M.exteriorDark);
    };
    const tc = [0xc9b8a0, 0xb0b8c0, 0xd8c8b0, 0xa8b4a0, 0xc0a8a0, 0xd0d0c8];
    let x = -60;
    while (x < 200) {
      const w = 10 + r() * 12, h = 6 + r() * 16;
      town(x + w / 2, 128 + r() * 6, w, 12, h, pickR(r, tc));
      x += w + 2 + r() * 6;
    }
    for (let i = 0; i < 6; i++) town(-28 - i * 2, 6 + i * 16, 14, 12, 7 + r() * 9, pickR(r, tc));
    for (let i = 0; i < 6; i++) town(150 + i * 2, 6 + i * 16, 14, 12, 7 + r() * 9, pickR(r, tc));

    // traffic: a few cars driving past (client-side scenery only)
    this.traffic = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      // build the car, then merge it into one mesh per material (a handful of draws, not ~35)
      const body = this.P.carGroup(carMats[(i * 3) % carMats.length]);
      body.rotation.y = Math.PI / 2;            // the model faces +z; traffic drives along x
      body.updateMatrixWorld(true);
      const bt = new Batcher();
      for (const m of body.children) bt.add(m.geometry, m.material, m.matrixWorld);
      bt.build(g);
      const dir = i % 2 ? 1 : -1;
      g.position.set(-80 + i * 55, 0, wz(47) + (dir > 0 ? 3 : 8.5));
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      this.scene.add(g);
      this.traffic.push({ g, dir, speed: 9 + (i % 3) * 2.5 });
    }
  }

  buildRain() {
    const N = 1600;
    const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = -20 + Math.random() * 160, y = Math.random() * 24, z = 68 + Math.random() * 50;
      pos.set([x, y, z, x + 0.05, y + 0.6, z], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.55 }));
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  // ---------------------------------------------------------------- products

  productTex(p) {
    return canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = p.color; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w, h * 0.16);
      g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(0, h * 0.38, w, h * 0.3);
      g.fillStyle = '#1d2430'; g.font = `700 ${h * 0.2}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(p.name.split(' ')[0].toUpperCase(), w / 2, h * 0.53, w * 0.92);
    });
  }

  productGeo(shape) {
    let g;
    switch (shape) {
      case 'can': g = new THREE.CylinderGeometry(0.065, 0.065, 0.17, 12); break;
      case 'bottle': g = new THREE.CylinderGeometry(0.045, 0.075, 0.32, 10); break;
      case 'jar': g = new THREE.CylinderGeometry(0.085, 0.085, 0.19, 12); break;
      case 'cup': g = new THREE.CylinderGeometry(0.08, 0.06, 0.13, 12); break;
      case 'tub': g = new THREE.CylinderGeometry(0.12, 0.1, 0.15, 14); break;
      case 'tallbox': g = new THREE.BoxGeometry(0.24, 0.36, 0.09); break;
      case 'bag': g = new THREE.BoxGeometry(0.24, 0.3, 0.11); break;
      case 'loaf': g = new THREE.BoxGeometry(0.3, 0.15, 0.16); break;
      case 'carton': g = new THREE.BoxGeometry(0.11, 0.25, 0.11); break;
      case 'tray': g = new THREE.BoxGeometry(0.3, 0.08, 0.22); break;
      case 'bar': g = new THREE.BoxGeometry(0.2, 0.05, 0.1); break;
      case 'flat': g = new THREE.BoxGeometry(0.32, 0.05, 0.32); break;
      case 'fruit': g = new THREE.SphereGeometry(0.09, 10, 8); break;
      case 'banana': g = new THREE.TorusGeometry(0.1, 0.03, 6, 10, Math.PI * 0.9); g.rotateZ(Math.PI * 0.55); break;
      default: g = new THREE.BoxGeometry(0.2, 0.26, 0.12);
    }
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);     // sit on y = 0
    return g;
  }

  buildProducts() {
    const P = this.world.products;
    this.boxMats = P.map(p => cartonMaterials(p));
    this.prodMeshes = P.map(p => productMesh(p));
    this.prodMats = this.prodMeshes.map(m => m.material);
    // flat colour stand-ins for items on the checkout belt (produce has vertex colours only)
    this.beltMats = P.map((p, i) => this.prodMeshes[i].produce ? new THREE.MeshPhongMaterial({ color: p.color, shininess: 40 }) : this.prodMats[i]);
    this.expiredBoxMat = this.lam(0xffffff, { map: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7d6a55'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3b3b3b'; g.fillRect(0, h * 0.38, w, h * 0.24);
      g.fillStyle = '#ff6b5e'; g.font = `700 ${h * 0.16}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('EXPIRED', w / 2, h / 2 + 2);
    }) });
    // one instanced mesh per product; capacity = every slot it could ever occupy
    const kindOf = { dry: 'shelf', chilled: 'fridge', frozen: 'freezer', produce: 'produce' };
    const fixCount = {};
    for (const f of this.world.fixtures) fixCount[f.kind] = (fixCount[f.kind] || 0) + 1;
    this.prodInst = P.map((p, i) => {
      const fk = kindOf[p.kind];
      const max = Math.ceil(fixCount[fk] * this.world.baseCap[fk] * 1.5) * (fk === 'freezer' ? 1 : 2);
      const im = new THREE.InstancedMesh(this.prodMeshes[i].geometry, this.prodMeshes[i].material, max);
      im.count = 0;
      im.frustumCulled = false;
      im.userData.produce = !!this.prodMeshes[i].produce;
      if (im.userData.produce) im.setColorAt(0, new THREE.Color(1, 1, 1));
      this.scene.add(im);
      return im;
    });
    this.prodSig = '';
  }

  // slot positions (local to fixture centre) for a given capacity
  slotLayout(kind, cap) {
    const out = [];
    if (kind === 'shelf') {
      const per = cap / 3;
      for (const ly of [0.57, 1.17, 1.77]) for (let i = 0; i < per; i++) {
        const x = -1.82 + (i + 0.5) * 3.64 / per;
        out.push([[x, ly, 0.3], [x, ly, 0.02]]);   // two facings deep so shelves look full
      }
    } else if (kind === 'fridge') {
      const per = cap / 3;
      for (const ly of [0.66, 1.21, 1.76]) for (let i = 0; i < per; i++) { const x = -1.75 + (i + 0.5) * 3.5 / per; out.push([[x, ly, 0.28], [x, ly, -0.02]]); }
    } else if (kind === 'freezer') {
      const per = cap / 2;
      for (const z of [-0.3, 0.3]) for (let i = 0; i < per; i++) out.push([[-1.75 + (i + 0.5) * 3.5 / per, 0.57, z]]);
    } else if (kind === 'produce') {
      const half = cap / 2, cols = 5, rowsN = Math.ceil(half / cols);
      for (const s of [-1, 1]) for (let i = 0; i < half; i++) {
        const c = i % cols, rI = Math.floor(i / cols);
        const z = (0.45 - rI * (1.0 / Math.max(1, rowsN - 1))) * 0.9;
        out.push([[s * 1.0 - 0.72 + c * 0.36, 1.07 - z * 0.18, z], [s * 1.0 - 0.54 + c * 0.36, 1.13 - z * 0.18, z - 0.12]]);
      }
    }
    return out;
  }

  updateProducts(state) {
    const sig = state.deep + '|' + state.sh.map(s => s[0] + ':' + s[1]).join(',');
    if (sig === this.prodSig) return;
    this.prodSig = sig;
    const counts = new Array(this.prodInst.length).fill(0);
    const cache = {};
    for (const f of this.world.fixtures) {
      const [pid, qty] = state.sh[f.id] || [-1, 0];
      if (pid < 0 || qty <= 0) continue;
      const cap = Math.round(this.world.baseCap[f.kind] * (state.deep ? 1.5 : 1));
      const key = f.kind + cap;
      const slots = cache[key] || (cache[key] = this.slotLayout(f.kind, cap));
      const im = this.prodInst[pid];
      const cx = wx(f.cx), cz = wz(f.cy);
      const jit = rng(f.id * 31 + pid);
      for (let i = 0; i < Math.min(qty, slots.length); i++) {
        for (const [lx, ly, lz] of slots[i]) {
          if (counts[pid] >= im.instanceMatrix.count) break;
          const prod = im.userData.produce;
          _e.set(prod ? (jit() - 0.5) * 0.6 : 0, (jit() - 0.5) * (prod ? 6 : 0.25), prod ? (jit() - 0.5) * 0.6 : 0); _q.setFromEuler(_e);
          const sc = prod ? 1.55 + jit() * 0.25 : f.kind === 'freezer' ? 1.3 : 1.45;
          _m4.compose(_v.set(cx + lx, ly, cz + lz), _q, _s.set(sc, sc, sc));
          if (prod) { const t = 0.82 + jit() * 0.3; _c.setRGB(t, t * (0.92 + jit() * 0.12), t * (0.9 + jit() * 0.1)); im.setColorAt(counts[pid], _c); }
          im.setMatrixAt(counts[pid]++, _m4);
        }
      }
    }
    this.prodInst.forEach((im, i) => { im.count = counts[i]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });
  }

  // ---------------------------------------------------------------- first-person hands

  buildHeld() {
    const g = new THREE.Group();
    const boxMesh = this.mesh(G.box, this.M.cardboard, 0, 0, 0, 0.62, 0.48, 0.5, g);
    const skin = this.lam(0xe0b08a);
    this.mesh(G.box, skin, -0.33, -0.08, 0.12, 0.1, 0.1, 0.32, g);
    this.mesh(G.box, skin, 0.33, -0.08, 0.12, 0.1, 0.1, 0.32, g);
    g.position.set(0.28, -0.44, -0.72);
    g.rotation.set(0.1, -0.2, 0.04);
    g.visible = false;
    this.camera.add(g);
    this.held = { group: g, boxMesh, pid: -2 };
  }

  // ---------------------------------------------------------------- avatars

  // one record per visible person; the body itself lives in the instanced crowd
  people(pool, list, lookFn, apply, k, dt) {
    const seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      let av = pool.get(e.id);
      if (!av) {
        const holder = new THREE.Group();
        const tag = this.sprite(1.3, 0.32, 256); tag.position.y = 2.25;
        const bubble = this.sprite(2.6, 0.5, 512); bubble.position.y = 2.65; bubble.visible = false;
        const carried = this.mesh(G.box, this.M.cardboard, 0, 1.1, 0.42, 0.55, 0.42, 0.42, holder);
        carried.visible = false; carried.castShadow = true;
        holder.add(tag, bubble);
        this.scene.add(holder);
        av = { holder, tag, bubble, carried, look: lookFn(e), x: wx(e.x), z: wz(e.y), yaw: (e.yaw || 0) * Math.PI / 180,
          phase: Math.random() * 6, swing: 0, lean: 0, spawnT: 0, flags: {}, moving: false, speed: 1 };
        pool.set(e.id, av);
      }
      apply(av, e);
      // smooth towards the server position
      av.x += (wx(e.x) - av.x) * k; av.z += (wz(e.y) - av.z) * k;
      let diff = (e.yaw || 0) * Math.PI / 180 - av.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      av.yaw += diff * Math.min(1, k * 1.4);
      if (av.moving) av.phase += dt * 8.5 * av.speed;
      av.swing += ((av.moving ? 0.55 : 0) - av.swing) * Math.min(1, dt * 10);
      if (av.spawnT < 1) av.spawnT = Math.min(1, av.spawnT + dt * 3);
      const carry = av.flags.carry !== undefined && av.flags.carry >= 0;
      av.carried.visible = carry;
      if (carry) av.carried.material = this.boxMats[av.flags.carry];
      av.holder.position.set(av.x, 0, av.z);
      av.holder.rotation.y = av.yaw;
      av.holder.scale.setScalar(0.3 + 0.7 * av.spawnT);
      this.crowd.add(av);
      this.blobs.push(av.x, av.z, av.flags.cart ? 1.5 : 0.75);
    }
    for (const [id, av] of pool) {
      if (seen.has(id)) continue;
      this.scene.remove(av.holder);
      for (const sp of [av.tag, av.bubble]) { sp.material.map.dispose(); sp.material.dispose(); }
      pool.delete(id);
    }
  }

  customerLook(seed, staff) {
    const r = rng(seed);
    const skins = ['#f1d0b0', '#e0b08a', '#c68e62', '#a8714a', '#8a5a3a', '#6b4430'];
    const hairs = ['#1c1410', '#3b2516', '#6b4b2a', '#a0773f', '#d8c08a', '#8a8a8a', '#2a1a14'];
    const shirts = ['#5b7fc0', '#c05b6c', '#6aa86a', '#d9a441', '#8b6bb5', '#e07a4f', '#4fa3a3', '#e8e8e8', '#3a3f4d', '#b5d36a', '#d46ab4'];
    const pants = ['#2c3e50', '#3b3b3b', '#5a4632', '#24364f', '#6b6b6b', '#4a5a3a'];
    return {
      skin: pickR(r, skins), hair: pickR(r, hairs),
      shirt: staff ? '#1f7a4d' : pickR(r, shirts), pants: pickR(r, pants),
      hairStyle: r() < 0.12 ? 'bald' : r() < 0.4 ? 'long' : 'short',
      scale: 0.92 + r() * 0.16,
      apron: staff ? '#14553a' : null,
    };
  }


  drawTag(g, w, h, text, bg, fg = '#ffffff') {
    g.font = `700 ${h * 0.62}px ${FONT}`;
    const tw = Math.min(w - 8, g.measureText(text).width + h * 0.7);
    g.fillStyle = bg; roundRect(g, (w - tw) / 2, 2, tw, h - 4, (h - 4) / 2); g.fill();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 20);
  }

  // ---------------------------------------------------------------- environment

  setEnvironment(clk, weather) {
    const h = clk / 60;
    const day = Math.max(0, Math.sin(Math.PI * (h - 6) / 14));     // 0 at 6:00 and 20:00
    const dusk = Math.max(0, 1 - Math.abs(h - 19) / 1.6) * (h > 16 ? 1 : 0);
    const night = h >= 20 || h < 6 ? 1 : Math.max(0, (h - 19) / 1.2) * (h > 19 ? 1 : 0);
    const rain = weather === 'rain';
    const key = `${Math.round(h * 20)}|${weather}`;
    if (key === this.envKey) return;
    this.envKey = key;

    const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
    let top = lerpC(0x0a1022, 0x4f95dc, day);
    let bot = lerpC(0x1b2238, 0xd5e8f6, day);
    if (dusk > 0) { top.lerp(new THREE.Color(0x40508a), dusk * 0.7); bot.lerp(new THREE.Color(0xf4a261), dusk * 0.8); }
    if (rain) { top.lerp(new THREE.Color(0x6b7480), 0.65 * day + 0.1); bot.lerp(new THREE.Color(0x9aa3ac), 0.6 * day + 0.1); }
    this.skyUni.top.value.copy(top); this.skyUni.bottom.value.copy(bot);
    this.scene.fog.color.copy(bot);
    this.scene.fog.near = rain ? 40 : 90; this.scene.fog.far = rain ? 170 : 300;

    this.sun.intensity = (rain ? 0.6 : 2.4) * day + 0.05;
    this.sun.color.copy(lerpC(0xffffff, 0xffa060, Math.max(dusk, 1 - day) * 0.8));
    this.hemi.intensity = 0.35 + 0.85 * day * (rain ? 0.75 : 1);
    this.hemi.color.copy(lerpC(0x6077a8, 0xdfeeff, day));

    const n = Math.min(1, night + (1 - day) * 0.6);
    this.bulbMat.color.set(n > 0.3 ? 0xfff0c8 : 0x777066);
    for (const l of this.lotLights) l.intensity = n > 0.3 ? 220 : 0;
    this.windowGlow.opacity = n * 0.35;
    for (const m of this.townWindows) m.emissive.setRGB(0.9 * n, 0.75 * n, 0.45 * n);
    this.rain.visible = rain;
    this.skyUni.cloud.value = rain ? 0.85 : weather === 'festival' ? 0.3 : 0.45;
    this.skyUni.night.value = Math.min(1, n);
    this.skyUni.sunDir.value.copy(this.sunDir()).normalize();
  }

  // ---------------------------------------------------------------- frame

  update(state, myId, selfPos, dt, moving, sprint) {
    if (!state) return;
    this.time += dt;
    const k = 1 - Math.pow(0.0001, dt);
    const up = state.up || {};
    const P = this.world.products;

    this.setEnvironment(state.clk || 600, state.wx);
    this.skyUni.time.value = this.time;

    // building state driven by upgrades
    const lvl = state.lvl || 1;
    for (const p of this.partitionWalls) p.g.visible = p.lvl > lvl;
    if (this.lightLevel !== lvl) {
      this.lightLevel = lvl;
      for (const l of this.roomLights) l.intensity = l.userData.lvl <= lvl ? l.userData.base : 0;
    }
    if (this.signLevel !== lvl) { this.signLevel = lvl; this.storeSign.userData.redraw(this.world.levels[lvl].name); }
    const open = state.ph === 'open';
    if (this.openState !== open) {
      this.openState = open;
      this.openSign.userData.redraw(open);
      this.openSign2.material = this.openSign.material;
    }
    if (this.clockKey !== state.clk) { this.clockKey = state.clk; this.clockFace.userData.redraw(state.clk); }

    // ---- people: every player, shopper and staff member drawn through one instanced crowd
    this.crowd.begin();
    this.blobs.begin();
    const others = state.pl.filter(p => p.id !== myId);
    this.people(this.pools.players, others, p => ({ skin: '#e0b08a', hair: '#2a1a14', shirt: p.c, pants: '#2c3e50', apron: '#14553a', cap: p.c, hairStyle: 'short', scale: 1 }),
      (av, p) => {
        av.flags.carry = p.b >= 0 ? p.b : -1;
        av.moving = p.m > 0; av.speed = p.m === 2 ? 1.4 : 1;
        this.setSprite(av.tag, p.n + p.c, (g, w, h) => this.drawTag(g, w, h, p.n, p.c));
        this.setSprite(av.bubble, p.say || '', (g, w, h) => this.drawTag(g, w, h, p.say, 'rgba(255,255,255,.95)', '#1d2430'));
      }, k, dt);
    this.people(this.pools.customers, state.cu, c => this.customerLook(c.lk),
      (av, c) => {
        av.flags.cart = !!c.cart; av.flags.goods = c.n > 0; av.flags.basket = !c.cart && c.n > 0;
        av.moving = !!c.m && !c.sl; av.speed = c.th ? 1.5 : 1;
        av.lean += ((c.sl ? 1.2 : 0) - av.lean) * Math.min(1, dt * 6);
        let tag = '', bg = '#e0a33c';
        if (c.th) { tag = '!  THIEF'; bg = '#e45b5b'; }
        else if (c.an) { tag = '>:('; bg = '#e45b5b'; }
        else if ((c.s === 'queue' || c.s === 'wait') && c.p < 18) { tag = c.p < 9 ? '!!' : '!'; bg = c.p < 9 ? '#e45b5b' : '#e0a33c'; }
        else if (c.mb && c.s === 'queue') { tag = '★ member'; bg = 'rgba(31,122,77,.85)'; }
        this.setSprite(av.tag, tag ? tag + bg : '', (g, w, h) => this.drawTag(g, w, h, tag, bg));
      }, k, dt);
    this.people(this.pools.staff, state.sf || [], s => this.customerLook(s.lk, true),
      (av, s) => {
        av.flags.carry = s.b >= 0 ? s.b : -1;
        av.moving = !!s.m; av.speed = 1;
        const label = `${s.n} · ${s.k === 'cashier' ? 'cashier' : 'stock'}`;
        this.setSprite(av.tag, label, (g, w, h) => this.drawTag(g, w, h, label, 'rgba(20,85,58,.9)'));
      }, k, dt);
    // ---- loose boxes
    const seen = new Set();
    for (const b of state.bx) {
      seen.add(b.id);
      let m = this.pools.boxes.get(b.id);
      if (!m) {
        m = this.mesh(G.box, this.boxMats[b.p], 0, 0.3, 0, 0.75, 0.6, 0.6);
        m.castShadow = true;
        m.rotation.y = ((b.id * 37) % 20 - 10) / 60;
        this.pools.boxes.set(b.id, m);
      }
      m.material = b.l === 0 ? this.expiredBoxMat : this.boxMats[b.p];
      m.position.x = wx(b.x); m.position.z = wz(b.y);
      this.blobs.push(m.position.x, m.position.z, 0.9);
    }
    for (const [id, m] of this.pools.boxes) if (!seen.has(id)) { this.scene.remove(m); this.pools.boxes.delete(id); }

    // ---- spills
    const sseen = new Set();
    for (const s of state.sp || []) {
      sseen.add(s.id);
      let v = this.pools.spills.get(s.id);
      if (!v) {
        // every spill shares one puddle geometry/material and one printed sign, so nothing leaks
        if (!this.spillKit) {
          const sign = this.textSign('WET FLOOR', 0.4, 0.14, { bg: null, fg: '#1d2430', px: 128 });
          this.scene.remove(sign);
          this.spillKit = {
            geo: new THREE.CircleGeometry(0.75, 20),
            mat: new THREE.MeshPhongMaterial({ color: 0x8fb7c9, transparent: true, opacity: 0.55, shininess: 120, specular: 0xffffff, depthWrite: false }),
            signMat: sign.material,
          };
        }
        const K = this.spillKit;
        const g = new THREE.Group();
        const puddle = this.mesh(K.geo, K.mat, 0, 0.02, 0, 1, 1, 1, g);
        puddle.rotation.x = -Math.PI / 2;
        for (const s2 of [-1, 1]) {
          const leaf = this.mesh(G.box, this.M.yellow, 0.9, 0.35, s2 * 0.12, 0.42, 0.7, 0.02, g);
          leaf.rotation.x = s2 * 0.3;
        }
        const t = this.mesh(G.plane, K.signMat, 0.9, 0.42, 0.24, 0.4, 0.14, 1, g);
        t.rotation.x = -0.3;
        g.position.set(wx(s.x), 0, wz(s.y));
        this.scene.add(g);
        v = { g, puddle };
        this.pools.spills.set(s.id, v);
      }
      v.puddle.scale.setScalar(0.5 + s.hp / 6);
    }
    for (const [id, v] of this.pools.spills) if (!sseen.has(id)) { this.scene.remove(v.g); this.pools.spills.delete(id); }

    // everything below up to the doors depends only on the snapshot: do it once per snapshot, not per frame
    if (state !== this.lastSnap) { this.lastSnap = state; this.snapshotWork(state, up); }

    // ---- doors: open when anyone is close
    // ---- doors: open when anyone is close
    const door = this.world.door;
    const dx = (door.x0 + door.x1 + 1) / 2, dy = door.y + 0.5;
    let near = Math.hypot(selfPos.x - dx, selfPos.y - dy) < 3.4;
    if (!near) for (const list of [state.cu, state.pl, state.sf || []]) {
      for (const e of list) if (Math.abs(e.x - dx) < 3.2 && Math.abs(e.y - dy) < 3.0) { near = true; break; }
      if (near) break;
    }
    this.doorOpen += ((near ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 5);
    for (const d of this.doors) d.g.position.x = d.home + d.dir * this.doorOpen * 3.8;

    // ---- scenery motion
    for (const t of this.traffic) {
      t.g.position.x += t.dir * t.speed * dt;
      if (t.g.position.x > 220) t.g.position.x = -100;
      if (t.g.position.x < -100) t.g.position.x = 220;
    }
    if (this.rain.visible) {
      const a = this.rain.geometry.attributes.position.array;
      const fall = 22 * dt;
      for (let i = 0; i < a.length; i += 6) {
        a[i + 1] -= fall; a[i + 4] -= fall;
        if (a[i + 1] < 0) { a[i + 1] += 24; a[i + 4] += 24; }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // ---- our camera + hands
    const self = state.pl.find(p => p.id === myId);
    this.bob += dt * (moving ? (sprint ? 13 : 10) : 0);
    const bobY = moving && this.viewBob !== false ? Math.sin(this.bob) * (sprint ? 0.045 : 0.03) : 0;
    this.yawObj.position.set(selfPos.x * TILE, EYE + bobY, selfPos.y * TILE);
    const fov = (this.baseFov || 72) + (sprint ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 8); this.camera.updateProjectionMatrix(); }
    if (self) {
      this.held.group.visible = self.b >= 0;
      if (self.b >= 0 && this.held.pid !== self.b) { this.held.pid = self.b; this.held.boxMesh.material = this.boxMats[self.b]; }
      this.held.group.position.y = -0.44 + (moving ? Math.sin(this.bob * 2) * 0.01 : 0);
    }

    // keep the sun (and its shadow camera) centred on us
    const scx = selfPos.x * TILE, scz = selfPos.y * TILE;
    this.sun.target.position.set(scx, 0, scz);
    this.sun.position.set(scx, 0, scz).add(this.sunDir());
    this.sky.position.copy(this.yawObj.position);
    this.crowd.end();
    this.blobs.end();

    this.renderer.render(this.scene, this.camera);
  }

  // per-snapshot updates: products on fixtures, shelf labels and price strips, till screens and belts
  snapshotWork(state, up) {
    const P = this.world.products;
    this.updateProducts(state);
    for (const f of this.world.fixtures) {
      const parts = this.fixParts[f.id];
      if (!parts || !parts.label) continue;
      const [pid, , life] = state.sh[f.id] || [-1, 0, -1];
      const promo = pid >= 0 && (state.pr || []).includes(pid);
      const expired = pid >= 0 && life === 0;
      const key = pid >= 0 ? `${pid}:${state.prices[pid]}:${promo}:${expired}` : 'e';
      if (parts.label.userData.key !== key) {
        parts.label.userData.key = key;
        const info = pid >= 0 ? { name: `${P[pid].brand === 'Fresh' ? '' : P[pid].brand + ' '}${P[pid].name}`, short: P[pid].name, size: P[pid].size, price: state.prices[pid], color: P[pid].color, promo, expired } : null;
        parts.label.userData.redraw(info);
        if (parts.strip) parts.strip.redraw(info);
        if (parts.wobbler) parts.wobbler.visible = promo && !expired;
      }
    }

    // ---- checkouts
    for (const ck of state.ck) {
      const parts = this.checkoutParts[ck.i];
      if (!parts) continue;
      const c = this.world.checkouts[ck.i];
      const locked = c.lvl > (state.lvl || 1);
      const staffed = !!ck.m || !!ck.npc;
      parts.lamp.material.color.set(locked ? 0x5a2020 : staffed ? 0x6cf08a : 0xf2c230);
      parts.closed.visible = locked;
      const pay = ck.pay || {};
      const key = ck.tot ? `${ck.sc}/${ck.tot}/${ck.sum}/${ck.st}/${pay.td}/${pay.g}` : ck.last ? `done/${ck.last.total}` : 'idle';
      if (parts.key !== key) {
        parts.key = key;
        // while scanning, the screens show the running subtotal of what has been scanned so far
        let shown = ck.sum;
        if (ck.st === 'scan' && ck.items) { shown = 0; let left = ck.sc; for (const it of ck.items) { shown += Math.max(0, Math.min(it.qty, left)) * it.p; left -= it.qty; } }
        const d = ck.tot ? { sc: ck.sc, tot: ck.tot, sum: shown, st: ck.st, td: pay.td, due: pay.due, g: pay.g || 0 }
          : ck.last ? { done: true, m: ck.last.m, sum: ck.last.total, ch: ck.last.ch } : null;
        parts.screen.userData.redraw(d);
        parts.cust.userData.redraw(d);
        // the next unscanned units wait on the belt, the next one nearest the scanner (highest slot)
        const n = parts.items.length;
        let i = 0, unit = 0;
        if (ck.items) for (const it of ck.items) for (let q = 0; q < it.qty; q++, unit++) {
          if (unit < ck.sc || i >= n) continue;
          parts.items[n - 1 - i].visible = true;
          parts.items[n - 1 - i].material = this.beltMats[it.pid];
          i++;
        }
        for (; i < n; i++) parts.items[n - 1 - i].visible = false;
      }
    }

  }

  sunDir() {
    const v = this.sun.userData.dir || (this.sun.userData.dir = new THREE.Vector3());
    const h = (this.clockKey || 600) / 60;
    const a = Math.PI * (h - 6) / 14;
    v.set(-Math.cos(a) * 80, 30 + Math.sin(Math.max(0.1, a)) * 90, 60);
    return v;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.maxRatio * this.resScale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setLook(yaw, pitch) {
    this.yawObj.rotation.y = yaw;
    this.pitchObj.rotation.x = pitch;
  }
}

function M_CURB(sc) { return sc.M.concrete; }

function blobTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(0.55, 'rgba(0,0,0,0.25)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

// soft contact shadows under everything that moves: one draw call
class Blobs {
  constructor(sc) {
    this.max = 400;
    this.im = new THREE.InstancedMesh(G.plane, sc.M.contact, this.max);
    this.im.frustumCulled = false;
    this.im.renderOrder = 1;
    sc.scene.add(this.im);
    this.n = 0;
    this.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  }
  begin() { this.n = 0; }
  push(x, z, r) {
    if (this.n >= this.max) return;
    _m4.compose(_v.set(x, 0.025, z), this.q, _s.set(r * 1.4, r * 1.4, 1));
    this.im.setMatrixAt(this.n++, _m4);
  }
  end() { this.im.count = this.n; this.im.instanceMatrix.needsUpdate = true; }
}

// Every person in the world is drawn by ~22 instanced meshes (one per body part),
// so 40 shoppers cost the same draw calls as one. Limbs are posed on the CPU.
class Crowd {
  constructor(sc) {
    this.sc = sc;
    const MAX = 64;
    const face = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      const cx = w * 0.25;
      g.fillStyle = '#1b1b1b';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 13, h * 0.47, 4.5, 6, 0, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(60,40,30,.75)'; g.lineWidth = 3;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 7, h * 0.38); g.lineTo(cx + s * 19, h * 0.37); g.stroke(); }
      g.strokeStyle = '#8a3b33'; g.lineWidth = 3.5; g.beginPath(); g.arc(cx, h * 0.56, 9, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(200,90,80,.18)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 20, h * 0.56, 6, 0, 7); g.fill(); }
    });
    const lam = (opts = {}) => new THREE.MeshLambertMaterial({ color: 0xffffff, ...opts });
    const merge = list => { const b = new Batcher(); const mat = new THREE.MeshBasicMaterial(); const grp = new THREE.Group();
      for (const [geo, m] of list) b.add(geo, mat, m); b.build(grp); return grp.children[0].geometry; };
    const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 3, 8);
    const hairCap = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const wheels = merge([[-0.22, 0.6], [0.22, 0.6], [-0.22, 1.3], [0.22, 1.3]].map(([x, z]) => [G.cyl8, M4(x, 0.06, z, 0.12, 0.05, 0.12, 0, 0, Math.PI / 2)]));
    const basket = merge([[G.box, M4(0, -0.68, 0.08, 0.38, 0.24, 0.26)], [G.box, M4(0, -0.52, 0.08, 0.04, 0.14, 0.04)]]);
    const shoe = 0x22252a;
    // [key, geometry, colour source, pivot, local matrix, when to show]
    this.defs = [
      ['legL', cap(0.085, 0.6), 'pants', 'hipL', M4(0, -0.4, 0)],
      ['legR', cap(0.085, 0.6), 'pants', 'hipR', M4(0, -0.4, 0)],
      ['shoeL', G.sph, shoe, 'hipL', M4(0, -0.83, 0.05, 0.17, 0.11, 0.3)],
      ['shoeR', G.sph, shoe, 'hipR', M4(0, -0.83, 0.05, 0.17, 0.11, 0.3)],
      ['soleL', G.box, 0xe8e4dc, 'hipL', M4(0, -0.875, 0.05, 0.16, 0.025, 0.28)],
      ['soleR', G.box, 0xe8e4dc, 'hipR', M4(0, -0.875, 0.05, 0.16, 0.025, 0.28)],
      ['belt', G.cyl, 0x2a2622, 'root', M4(0, 0.99, 0, 0.415, 0.05, 0.262)],
      ['buckle', G.box, 0xc9b26a, 'root', M4(0, 0.99, 0.13, 0.06, 0.04, 0.01)],
      ['hips', G.cyl, 'pants', 'root', M4(0, 0.92, 0, 0.4, 0.16, 0.25)],
      ['torso', new THREE.CylinderGeometry(0.235, 0.2, 0.6, 14), 'shirt', 'root', M4(0, 1.2, 0, 1, 1, 0.62)],
      ['shoulders', G.sph, 'shirt', 'root', M4(0, 1.45, 0, 0.56, 0.2, 0.3)],
      ['apron', G.box, 'apron', 'root', M4(0, 1.08, 0.13, 0.36, 0.58, 0.02), l => !!l.apron],
      ['neck', G.cyl8, 'skin', 'root', M4(0, 1.55, 0, 0.12, 0.1, 0.12)],
      ['head', G.sph, 'skin', 'root', M4(0, 1.7, 0, 0.3, 0.33, 0.3), null, lam({ map: face })],
      ['nose', G.sph, 'skin', 'root', M4(0, 1.68, 0.15, 0.06, 0.08, 0.07)],
      ['earL', G.sph, 'skin', 'root', M4(-0.15, 1.7, 0, 0.05, 0.09, 0.06)],
      ['earR', G.sph, 'skin', 'root', M4(0.15, 1.7, 0, 0.05, 0.09, 0.06)],
      ['collar', G.cyl, 'shirt', 'root', M4(0, 1.52, 0, 0.2, 0.06, 0.17)],
      ['hairS', hairCap, 'hair', 'root', M4(0, 1.7, -0.02, 0.32, 0.36, 0.32), l => l.hairStyle !== 'bald' && !l.cap],
      ['hairL', G.box, 'hair', 'root', M4(0, 1.6, -0.11, 0.3, 0.38, 0.1), l => l.hairStyle === 'long'],
      ['cap', hairCap, 'cap', 'root', M4(0, 1.72, -0.01, 0.33, 0.3, 0.33), l => !!l.cap],
      ['brim', G.box, 'cap', 'root', M4(0, 1.79, 0.18, 0.24, 0.025, 0.16), l => !!l.cap],
      ['armL', cap(0.07, 0.24), 'shirt', 'shL', M4(0, -0.15, 0)],
      ['armR', cap(0.07, 0.24), 'shirt', 'shR', M4(0, -0.15, 0)],
      ['foreL', cap(0.055, 0.26), 'skin', 'shL', M4(0, -0.44, 0)],
      ['foreR', cap(0.055, 0.26), 'skin', 'shR', M4(0, -0.44, 0)],
      ['handL', G.sph, 'skin', 'shL', M4(0, -0.64, 0.01, 0.1, 0.13, 0.09)],
      ['handR', G.sph, 'skin', 'shR', M4(0, -0.64, 0.01, 0.1, 0.13, 0.09)],
      ['sleeveL', G.cyl, 'shirt', 'shL', M4(0, -0.27, 0, 0.17, 0.08, 0.17)],
      ['sleeveR', G.cyl, 'shirt', 'shR', M4(0, -0.27, 0, 0.17, 0.08, 0.17)],
      ['basket', basket, 0xd23b3b, 'shR', M4(0, 0, 0), (l, f) => !!f.basket],
      ['cartBody', G.box, 0xd6dbe0, 'root', M4(0, 0.72, 0.95, 0.55, 0.42, 0.8), (l, f) => !!f.cart],
      ['cartBase', G.box, 0x59626d, 'root', M4(0, 0.25, 0.95, 0.5, 0.04, 0.75), (l, f) => !!f.cart],
      ['cartBar', G.box, 0x1f7a4d, 'root', M4(0, 1.0, 0.5, 0.55, 0.05, 0.05), (l, f) => !!f.cart],
      ['cartWheels', wheels, 0x1d2126, 'root', M4(0, 0, 0), (l, f) => !!f.cart],
      ['cartGoods', G.box, 0xe9a23b, 'root', M4(0, 0.85, 0.95, 0.42, 0.2, 0.6), (l, f) => !!f.cart && !!f.goods],
    ];
    this.parts = this.defs.map(([key, geo, col, pivot, local, show, mat]) => {
      const im = new THREE.InstancedMesh(geo, mat || lam(), MAX);
      im.castShadow = true; im.frustumCulled = false; im.count = 0;
      im.setColorAt(0, new THREE.Color(1, 1, 1));
      sc.scene.add(im);
      return { key, im, col, pivot, local, show, n: 0 };
    });
    this.max = MAX;
    this.colors = new Map();
    this.piv = { root: new THREE.Matrix4(), hipL: new THREE.Matrix4(), hipR: new THREE.Matrix4(), shL: new THREE.Matrix4(), shR: new THREE.Matrix4() };
    this.tmp = new THREE.Matrix4(); this.t2 = new THREE.Matrix4();
  }
  color(c) {
    let v = this.colors.get(c);
    if (!v) { v = new THREE.Color(c); this.colors.set(c, v); }
    return v;
  }
  begin() { for (const p of this.parts) p.n = 0; }
  add(av) {
    const l = av.look, f = av.flags, P = this.piv, sc = av.spawnT < 1 ? 0.3 + 0.7 * av.spawnT : 1;
    const s = Math.sin(av.phase) * av.swing, bob = av.moving ? Math.abs(Math.cos(av.phase)) * 0.04 : 0;
    P.root.compose(_v.set(av.x, 0, av.z), _q.setFromAxisAngle(_Y, av.yaw), _s.setScalar((l.scale || 1) * sc));
    if (bob || av.lean) { this.tmp.makeTranslation(0, bob, 0); P.root.multiply(this.tmp); this.tmp.makeRotationX(av.lean || 0); P.root.multiply(this.tmp); }
    const carrying = f.carry !== undefined && f.carry >= 0;
    const armL = carrying ? -1.25 : f.cart ? -1.1 : -s * 0.8, armR = carrying ? -1.25 : f.cart ? -1.1 : s * 0.8;
    const limb = (m, x, y, rx) => { m.copy(P.root); this.tmp.makeTranslation(x, y, 0); m.multiply(this.tmp); this.tmp.makeRotationX(rx); m.multiply(this.tmp); };
    limb(P.hipL, -0.11, 0.86, s); limb(P.hipR, 0.11, 0.86, -s);
    limb(P.shL, -0.3, 1.45, armL); limb(P.shR, 0.3, 1.45, armR);
    for (const p of this.parts) {
      if (p.show && !p.show(l, f)) continue;
      if (p.n >= this.max) continue;
      this.t2.multiplyMatrices(P[p.pivot], p.local);
      p.im.setMatrixAt(p.n, this.t2);
      p.im.setColorAt(p.n, typeof p.col === 'string' ? this.color(l[p.col] || '#888888') : this.color(p.col));
      p.n++;
    }
  }
  end() {
    for (const p of this.parts) {
      p.im.count = p.n;
      p.im.instanceMatrix.needsUpdate = true;
      if (p.im.instanceColor) p.im.instanceColor.needsUpdate = true;
    }
  }
}
const _Y = new THREE.Vector3(0, 1, 0);
