import * as THREE from 'three';
import { STATIONS } from './sim.js';

// ---------------------------------------------------------------------------
// Palette — a GMP radiopharmacy rendered for a darkened conference stage.
// ---------------------------------------------------------------------------
export const PAL = {
  epoxy: 0x1a2029,
  wallPanel: 0xd7dee8,
  glass: 0x9fd8ff,
  steel: 0xb6c2d1,
  steelDark: 0x5a6674,
  lead: 0x767f8c,
  concrete: 0x8d8f8c,
  hazard: 0xffd233,
  accent: 0x3ee0c4,
  gownA: 0xf2f5fa,
  gownB: 0x7fb3ff,
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({
  color,
  metalness: o.m ?? 0.35,
  roughness: o.r ?? 0.5,
  transparent: o.o !== undefined,
  opacity: o.o ?? 1,
  emissive: new THREE.Color(o.e ?? 0x000000),
  emissiveIntensity: o.ei ?? 1,
  envMapIntensity: o.env ?? 1,
});

const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color,
  metalness: 0,
  roughness: o.r ?? 0.08,
  transmission: 0.9,
  thickness: 0.35,
  ior: 1.5,
  transparent: true,
  opacity: o.o ?? 1,
  envMapIntensity: 1.4,
});

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const tint = (m) => { m.userData.tint = true; return m; };
const basic = (color, opacity) => new THREE.MeshBasicMaterial({
  color, toneMapped: false, transparent: opacity !== undefined, opacity: opacity ?? 1,
});

// ---------------------------------------------------------------------------
// Signage & screen textures
// ---------------------------------------------------------------------------
function makeLabel(text, sub, accent = '#3ee0c4') {
  const cv = document.createElement('canvas');
  cv.width = 768; cv.height = 200;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(8,14,24,0.86)';
  g.beginPath(); g.roundRect(6, 6, 756, 188, 24); g.fill();
  g.strokeStyle = accent; g.lineWidth = 4; g.stroke();
  g.fillStyle = accent;
  g.beginPath(); g.roundRect(8, 8, 14, 184, 7); g.fill();
  g.fillStyle = '#eef6ff';
  g.font = '600 60px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 396, 90, 690);
  g.fillStyle = '#8fb6d6';
  g.font = '400 38px "Segoe UI", Arial, sans-serif';
  g.fillText(sub, 396, 148, 690);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(9.6, 2.5, 1);
  sp.renderOrder = 999;
  return sp;
}

let TREFOIL = null;
function trefoilTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffd233'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#161616';
  g.beginPath(); g.arc(128, 128, 25, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 3; i++) {
    const a = (i * 120 - 90) * Math.PI / 180;
    g.beginPath();
    g.arc(128, 128, 102, a - 0.52, a + 0.52);
    g.arc(128, 128, 40, a + 0.52, a - 0.52, true);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function trefoil(size = 1.1) {
  TREFOIL = TREFOIL || trefoilTexture();
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: TREFOIL, transparent: true }));
}

function screenTexture(kind) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 320;
  const g = cv.getContext('2d');
  g.fillStyle = '#07131f'; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = 'rgba(80,160,220,0.22)'; g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * 40); g.lineTo(512, i * 40); g.stroke(); }
  for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(i * 42, 0); g.lineTo(i * 42, 320); g.stroke(); }
  if (kind === 'hplc') {
    g.strokeStyle = '#41f0c0'; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x < 512; x++) {
      const y = 292
        - 210 * Math.exp(-((x - 196) ** 2) / 260)
        - 46 * Math.exp(-((x - 306) ** 2) / 90)
        - 16 * Math.exp(-((x - 98) ** 2) / 60);
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#8fd6ff'; g.font = '17px monospace';
    g.fillText('RADIO-HPLC   RCP 98.4 %   Rt 6.2 min', 12, 26);
  } else {
    g.strokeStyle = '#4ea8ff'; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x < 512; x++) {
      const y = 176 + Math.sin(x / 27) * 44 + Math.sin(x / 7) * 7;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#8fd6ff'; g.font = '17px monospace';
    g.fillText('SYNTHESIS  T 95 C  p 1.1 bar  OK', 12, 26);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function screen(w, h, kind) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: screenTexture(kind), toneMapped: false }));
}

// ---------------------------------------------------------------------------
// Reusable props
// ---------------------------------------------------------------------------
function operator(gown = PAL.gownA) {
  const g = new THREE.Group();
  const mat = std(gown, { m: 0.05, r: 0.85 });
  const body = cyl(0.3, 0.42, 1.25, mat, 14); body.position.y = 0.72; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), std(0xe8eef6, { m: 0.05, r: 0.8 }));
  head.position.y = 1.55; g.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.246, 16, 12, 0, Math.PI * 1.15, 0.75, 0.8),
    std(0x2c3a4d, { m: 0.45, r: 0.25 }));
  visor.position.y = 1.55; visor.rotation.y = -0.4; g.add(visor);
  for (const s of [-1, 1]) {
    const arm = cyl(0.09, 0.09, 0.9, mat, 10);
    arm.position.set(s * 0.36, 0.95, 0.06); arm.rotation.z = s * 0.16; g.add(arm);
  }
  return g;
}

function bench(w, d) {
  const g = new THREE.Group();
  const mat = std(PAL.steel, { m: 0.85, r: 0.28 });
  const top = box(w, 0.12, d, mat); top.position.y = 0.92; g.add(top);
  const lip = box(w, 0.1, 0.08, mat); lip.position.set(0, 1.0, -d / 2 + 0.04); g.add(lip);
  const carc = box(w - 0.4, 0.78, d - 0.2, std(PAL.steelDark, { m: 0.7, r: 0.45 }));
  carc.position.y = 0.46; g.add(carc);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = cyl(0.05, 0.05, 0.9, mat, 8);
    leg.position.set(sx * (w / 2 - 0.2), 0.45, sz * (d / 2 - 0.15)); g.add(leg);
  }
  return g;
}

function pipeRun(pts, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 14, radius, 10, false), mat);
}

function ductRun(x1, z1, x2, z2, y, size, mat) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = box(len, size, size, mat || std(0x8e9aa8, { m: 0.85, r: 0.42 }));
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  return m;
}

function hepaCeiling(x, z, w, d, y = 5.6) {
  const g = new THREE.Group();
  const nx = Math.max(1, Math.round(w / 2.4)), nz = Math.max(1, Math.round(d / 2.4));
  const cw = w / nx, cd = d / nz;
  const hepaMat = std(0xe9f1fa, { m: 0.2, r: 0.7, o: 0.5, e: 0x9fd0ff, ei: 0.3 });
  const panMat = std(0x5c6878, { m: 0.2, r: 0.75, o: 0.3 });
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const isHepa = (i + j) % 3 === 0;
    const p = box(cw * 0.94, 0.12, cd * 0.94, isHepa ? hepaMat : panMat);
    p.position.set(x - w / 2 + cw * (i + 0.5), y, z - d / 2 + cd * (j + 0.5));
    g.add(p);
  }
  return g;
}

// Cleanroom partition: solid dado + vision glass + header, with optional doors.
const WALLS = [];
function partition(group, a, b, opts = {}) {
  const [x1, z1] = a, [x2, z2] = b;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  const th = opts.thick ?? 0.3;
  const H = opts.height ?? 4.5;
  const doorW = opts.doorW ?? 3;
  const doors = opts.doors || [];

  const segs = [];
  let cursor = 0;
  for (const d of [...doors].sort((p, q) => p - q)) {
    const s = d - doorW / 2 / len, e = d + doorW / 2 / len;
    if (s > cursor) segs.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < 1) segs.push([cursor, 1]);

  const panelMat = std(opts.color ?? PAL.wallPanel, { m: 0.12, r: 0.62, env: 0.55 });
  const glassMat = std(PAL.glass, { m: 0.05, r: 0.06, o: 0.16, env: 2.2 });
  const faded = m => {
    const f = m.clone();
    f.transparent = true; f.opacity = 0.06; f.depthWrite = false;
    return f;
  };
  const panelFade = faded(panelMat), glassFade = faded(glassMat);

  const place = (mat, fade, t0, t1, y, h, d) => {
    const l = (t1 - t0) * len;
    if (l <= 0.05) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, d), mat);
    const mid = (t0 + t1) / 2;
    m.position.set(x1 + (x2 - x1) * mid, y, z1 + (z2 - z1) * mid);
    m.rotation.y = ang;
    m.castShadow = true; m.receiveShadow = true;
    // Walls that come between the camera and the point of interest are swapped
    // to a pre-built faded material — no per-frame material mutation, so the
    // shader programs are compiled once and reused.
    m.userData.wall = { solid: mat, fade };
    WALLS.push(m);
    group.add(m);
  };

  for (const [t0, t1] of segs) {
    if (opts.solid) {
      place(panelMat, panelFade, t0, t1, H / 2, H, th);
    } else {
      place(panelMat, panelFade, t0, t1, 0.55, 1.1, th);
      place(glassMat, glassFade, t0, t1, 2.3, 2.3, th * 0.4);
      place(panelMat, panelFade, t0, t1, 4.05, 0.9, th);
    }
  }

  for (const d of doors) {
    const fx = x1 + (x2 - x1) * d, fz = z1 + (z2 - z1) * d;
    const frame = box(doorW + 0.3, 0.22, th * 1.2, std(PAL.steelDark, { m: 0.7, r: 0.4 }));
    frame.position.set(fx, 3.0, fz); frame.rotation.y = ang; group.add(frame);
    const leaf = box(doorW, 2.8, 0.07, std(PAL.glass, { m: 0.05, r: 0.05, o: 0.2, env: 2.4 }));
    leaf.position.set(fx, 1.42, fz); leaf.rotation.y = ang; group.add(leaf);
    const strip = box(doorW, 0.06, 0.1, basic(PAL.accent, 0.9));
    strip.position.set(fx, 2.86, fz); strip.rotation.y = ang; group.add(strip);
  }
}

// ---------------------------------------------------------------------------
// Machine builders — one per station
// ---------------------------------------------------------------------------
const builders = {
  supply(g) {
    const conc = std(PAL.concrete, { m: 0.05, r: 0.95, env: 0.3 });
    const plinth = box(13, 0.5, 12, std(0x3a4149, { m: 0.2, r: 0.9 }));
    plinth.position.y = 0.25; g.add(plinth);
    const door = tint(box(1.6, 4.6, 7, conc));
    door.position.set(6.6, 2.55, 1.2); g.add(door);
    const dsign = trefoil(1.5); dsign.position.set(7.42, 2.9, 1.2); dsign.rotation.y = Math.PI / 2; g.add(dsign);

    const yoke = tint(cyl(3.5, 3.5, 1.5, std(0x59636f, { m: 0.9, r: 0.35 }), 40));
    yoke.position.y = 2.0; g.add(yoke);
    for (const dy of [-1.15, 1.15]) {
      const half = tint(cyl(3.9, 3.9, 0.95, std(0x6d7784, { m: 0.92, r: 0.3 }), 40));
      half.position.y = 2.0 + dy; g.add(half);
    }
    const coil = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.42, 14, 46),
      std(0xd08a4a, { m: 0.95, r: 0.28, e: 0x4a2a10, ei: 0.5 }));
    coil.rotation.x = Math.PI / 2; coil.position.y = 2.0; g.add(coil);
    const beamRing = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.13, 10, 60), basic(0x6fe9ff));
    beamRing.rotation.x = Math.PI / 2; beamRing.position.y = 2.0; g.add(beamRing);
    g.userData.beam = beamRing;
    g.userData.spin = coil;

    for (const a of [-0.5, 0.35]) {
      const bl = cyl(0.22, 0.22, 5.5, std(PAL.steel, { m: 0.95, r: 0.2 }), 12);
      bl.rotation.z = Math.PI / 2; bl.rotation.y = a;
      bl.position.set(Math.cos(a) * 5.2, 2.0, -Math.sin(a) * 5.2); g.add(bl);
      const tgt = tint(box(1.5, 1.5, 1.5, std(PAL.lead, { m: 0.8, r: 0.4 })));
      tgt.position.set(Math.cos(a) * 8.0, 2.0, -Math.sin(a) * 8.0); g.add(tgt);
    }
    const skid = tint(box(3, 2, 2, std(0x4a5560, { m: 0.7, r: 0.45 })));
    skid.position.set(-5.5, 1.25, 4); g.add(skid);
    for (let i = 0; i < 4; i++) {
      const b = cyl(0.32, 0.32, 2.2, std(0x2f6f5a, { m: 0.85, r: 0.3 }), 14);
      b.position.set(-7.8 + i * 0.78, 1.35, 4.6); g.add(b);
    }
    const con = box(2.2, 1.5, 0.2, std(0x121a24, { m: 0.5, r: 0.3 }));
    con.position.set(-2.5, 2.2, 5.6); g.add(con);
    const sc = screen(2.0, 1.3, 'sig'); sc.position.set(-2.5, 2.2, 5.72); g.add(sc);
    g.add(at(operator(PAL.gownB), -2.4, 0.5, 7.2));
  },

  prep(g) {
    g.add(at(bench(7.5, 2.2), 0, 0, -1.2));
    g.add(at(bench(4.2, 2.0), 3.6, 0, 2.6));
    const steel = std(PAL.steel, { m: 0.9, r: 0.25 });
    const cab = tint(box(5, 0.35, 2.6, steel));
    cab.position.set(-1, 3.3, -1.2); g.add(cab);
    for (const sx of [-1, 1]) {
      const post = box(0.16, 2.3, 2.6, steel);
      post.position.set(-1 + sx * 2.42, 2.0, -1.2); g.add(post);
    }
    const sash = box(4.7, 1.5, 0.07, std(PAL.glass, { m: 0.05, r: 0.04, o: 0.2, env: 2.5 }));
    sash.position.set(-1, 2.45, -0.02); g.add(sash);
    const lafGlow = box(4.6, 0.08, 2.4, basic(0xdff2ff, 0.45));
    lafGlow.position.set(-1, 3.08, -1.2); g.add(lafGlow);
    g.userData.laf = lafGlow;

    const slab = box(1.3, 0.16, 1.1, std(0x2b2f36, { m: 0.2, r: 0.5 }));
    slab.position.set(-2.6, 1.06, -1.2); g.add(slab);
    const bal = box(0.8, 0.45, 0.7, std(0xeceff3, { m: 0.15, r: 0.5 }));
    bal.position.set(-2.6, 1.36, -1.2); g.add(bal);

    const glassM = phys(0xdff0ff, { o: 0.55 });
    for (let i = 0; i < 5; i++) {
      const v = cyl(0.28, 0.28, 0.85, glassM, 18);
      v.position.set(0.4 + i * 0.62, 1.4, -1.5); g.add(v);
      const l = cyl(0.25, 0.25, 0.42, std(i % 2 ? 0x8fe3ff : 0xffd98a, { m: 0, r: 0.2, o: 0.9 }), 16);
      l.position.set(0.4 + i * 0.62, 1.24, -1.5); g.add(l);
      const cap = cyl(0.3, 0.3, 0.1, std(i % 2 ? 0x2f7fff : 0xff8a3d, { m: 0.4, r: 0.4 }), 16);
      cap.position.set(0.4 + i * 0.62, 1.87, -1.5); g.add(cap);
    }
    const vessel = tint(cyl(0.75, 0.75, 1.5, std(PAL.steel, { m: 0.92, r: 0.2 }), 24));
    vessel.position.set(3.6, 1.75, 2.6); g.add(vessel);
    const lid = cyl(0.8, 0.8, 0.14, std(PAL.steelDark, { m: 0.9, r: 0.3 }), 24);
    lid.position.set(3.6, 2.56, 2.6); g.add(lid);
    const stir = cyl(0.09, 0.09, 0.9, std(PAL.steel, { m: 0.95, r: 0.15 }), 10);
    stir.position.set(3.6, 3.0, 2.6); g.add(stir);
    g.userData.spinY = stir;
    const hatch = box(0.4, 1.1, 1.1, std(PAL.steelDark, { m: 0.85, r: 0.3 }));
    hatch.position.set(5.6, 1.9, -1.2); g.add(hatch);
    g.add(at(operator(PAL.gownA), -1.1, 0, 0.9));
  },

  hotcell(g) {
    const skin = std(0xbfc9d6, { m: 0.92, r: 0.22 });
    const plinth = box(13.5, 0.55, 4.4, std(0x2f3540, { m: 0.4, r: 0.7 }));
    plinth.position.set(0, 0.27, 0); g.add(plinth);

    for (let i = 0; i < 3; i++) {
      const x = -4.3 + i * 4.3;
      const cell = tint(box(3.9, 4.2, 3.5, skin.clone()));
      cell.position.set(x, 2.65, 0); g.add(cell);
      const leadCore = tint(box(4.0, 1.4, 3.6, std(PAL.lead, { m: 0.55, r: 0.45 })));
      leadCore.position.set(x, 1.3, 0); g.add(leadCore);
      const win = box(2.4, 1.35, 0.5, std(0xa9e6b6, { m: 0.1, r: 0.05, o: 0.32, env: 2.5 }));
      win.position.set(x, 3.15, 1.72); g.add(win);
      const wf = box(2.65, 1.6, 0.12, std(PAL.steelDark, { m: 0.8, r: 0.35 }));
      wf.position.set(x, 3.15, 1.9); g.add(wf);
      for (const s of [-1, 1]) {
        const arm = cyl(0.13, 0.13, 1.5, std(0xdde4ec, { m: 0.9, r: 0.25 }), 12);
        arm.rotation.z = s * 0.75; arm.position.set(x + s * 1.0, 2.62, 2.05); g.add(arm);
        const grip = cyl(0.16, 0.1, 0.4, std(0x30435c, { m: 0.8, r: 0.3 }), 10);
        grip.position.set(x + s * 1.42, 2.1, 2.05); g.add(grip);
      }
      const pan = box(1.5, 0.9, 0.1, std(0x101821, { m: 0.5, r: 0.35 }));
      pan.position.set(x, 1.55, 1.79); g.add(pan);
      const sc = screen(1.35, 0.78, i === 1 ? 'hplc' : 'sig');
      sc.position.set(x, 1.55, 1.86); g.add(sc);
      const duct = cyl(0.34, 0.34, 2.2, std(0x9aa6b4, { m: 0.85, r: 0.4 }), 14);
      duct.position.set(x, 5.7, -1.2); g.add(duct);
      const tf = trefoil(0.85); tf.position.set(x + 1.6, 1.05, 1.79); g.add(tf);
      if (i === 1) {
        const drum = cyl(0.55, 0.55, 1.0, std(PAL.steel, { m: 0.95, r: 0.18 }), 20);
        drum.position.set(x, 3.15, 0.2); g.add(drum);
        g.userData.spin = drum;
      }
    }
    g.add(ductRun(-5.6, -1.2, 5.6, -1.2, 6.9, 0.9));
    const mod = box(2.2, 1.1, 1.1, std(0x27354a, { m: 0.6, r: 0.35, e: 0x0d3b52, ei: 0.7 }));
    mod.position.set(0, 3.1, 0.55); g.add(mod);
    const trolley = box(2.2, 0.1, 1.4, std(PAL.steel, { m: 0.9, r: 0.25 }));
    trolley.position.set(6.0, 1.0, 2.6); g.add(trolley);
    for (let i = 0; i < 3; i++) {
      const c = box(0.55, 0.5, 1.1, std(0xf0f4f8, { m: 0.1, r: 0.7 }));
      c.position.set(5.3 + i * 0.68, 1.3, 2.6); g.add(c);
    }
    const bl = cyl(0.22, 0.28, 0.4, basic(0xff5b3d), 14);
    bl.position.set(-6.6, 4.9, 1.6); g.add(bl);
    g.userData.beacon2 = bl;
    g.add(at(operator(PAL.gownA), 0.2, 0, 3.4));
    g.add(at(operator(PAL.gownB), -4.6, 0, 3.6));
  },

  qc(g) {
    g.add(at(bench(9, 2.2), 0, 0, -1.4));
    g.add(at(bench(5.5, 2.2), -1.6, 0, 3.0));
    const shades = [0xe9eef5, 0xdfe6ef, 0xe9eef5, 0xd6dee8];
    for (let i = 0; i < 4; i++) {
      const m = tint(box(2.4, 0.52, 1.7, std(shades[i], { m: 0.3, r: 0.45 })));
      m.position.set(-3.0, 1.28 + i * 0.56, -1.4); g.add(m);
      const led = box(0.42, 0.09, 0.05, basic(i === 3 ? 0x41f0c0 : 0x4ea8ff));
      led.position.set(-2.1, 1.28 + i * 0.56, -0.53); g.add(led);
    }
    const mon = box(2.3, 1.4, 0.09, std(0x0d151f, { m: 0.5, r: 0.3 }));
    mon.position.set(-0.1, 1.85, -1.9); mon.rotation.y = 0.25; g.add(mon);
    const ms = screen(2.15, 1.28, 'hplc'); ms.position.set(-0.06, 1.85, -1.85); ms.rotation.y = 0.25; g.add(ms);
    const stem = cyl(0.09, 0.16, 0.6, std(0x2b3644, { m: 0.7, r: 0.4 }), 10);
    stem.position.set(-0.1, 1.2, -1.9); g.add(stem);

    const well = tint(cyl(0.85, 0.95, 1.15, std(PAL.lead, { m: 0.6, r: 0.45 }), 26));
    well.position.set(2.6, 1.55, -1.4); g.add(well);
    const bore = cyl(0.42, 0.42, 0.3, std(0x0a0d12, { m: 0.2, r: 0.9 }), 20);
    bore.position.set(2.6, 2.2, -1.4); g.add(bore);
    const elec = box(1.0, 0.42, 0.75, std(0xe6ecf3, { m: 0.3, r: 0.5 }));
    elec.position.set(4.0, 1.2, -1.4); g.add(elec);
    const eled = box(0.6, 0.16, 0.04, basic(0x41f0c0));
    eled.position.set(4.0, 1.24, -1.02); g.add(eled);

    const dew = tint(cyl(0.7, 0.7, 1.4, std(0xcfd8e2, { m: 0.9, r: 0.25 }), 22));
    dew.position.set(-1.6, 1.7, 3.0); g.add(dew);
    const det = cyl(0.28, 0.28, 1.0, std(PAL.steel, { m: 0.95, r: 0.15 }), 14);
    det.position.set(-1.6, 2.75, 3.0); g.add(det);
    const shieldPb = tint(cyl(0.85, 0.85, 0.8, std(PAL.lead, { m: 0.6, r: 0.5 }), 22));
    shieldPb.position.set(-1.6, 3.55, 3.0); g.add(shieldPb);

    const tlc = box(1.6, 0.4, 0.9, std(0xe4eaf2, { m: 0.3, r: 0.45 }));
    tlc.position.set(0.9, 1.18, 3.0); g.add(tlc);
    const lal = box(1.1, 0.55, 0.8, std(0xdfe7f0, { m: 0.3, r: 0.5 }));
    lal.position.set(2.6, 1.26, 3.0); g.add(lal);
    const vialMat = phys(0xdff0ff, { o: 0.6 });
    for (let i = 0; i < 6; i++) {
      const v = cyl(0.11, 0.11, 0.4, vialMat, 12);
      v.position.set(5.0 + (i % 3) * 0.3, 1.18, -1.7 + Math.floor(i / 3) * 0.32); g.add(v);
    }
    g.add(at(operator(PAL.gownB), 1.4, 0, 0.6));
  },

  fill(g) {
    const skin = std(0xc3cddb, { m: 0.9, r: 0.22 });
    const plinth = box(11.5, 0.9, 4.2, std(0x2f3540, { m: 0.5, r: 0.6 }));
    plinth.position.set(0, 0.45, 0); g.add(plinth);
    const body = tint(box(10.6, 1.5, 3.6, skin.clone()));
    body.position.set(0, 1.62, 0); g.add(body);
    const chamber = box(10.2, 2.0, 3.3, std(PAL.glass, { m: 0.03, r: 0.04, o: 0.13, env: 2.6 }));
    chamber.position.set(0, 3.4, 0); g.add(chamber);
    const front = box(10.2, 2.0, 0.08, std(PAL.glass, { m: 0.03, r: 0.03, o: 0.22, env: 3 }));
    front.position.set(0, 3.4, 1.68); g.add(front);
    const plenum = tint(box(10.9, 0.85, 3.9, skin.clone()));
    plenum.position.set(0, 4.75, 0); g.add(plenum);
    const uda = box(9.8, 0.08, 3.1, basic(0xe6f6ff, 0.42));
    uda.position.set(0, 4.28, 0); g.add(uda);
    g.userData.laf = uda;

    for (const gx of [-3.4, -1.15, 1.15, 3.4]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.09, 10, 24), std(0x2f3a49, { m: 0.7, r: 0.4 }));
      ring.position.set(gx, 3.25, 1.7); g.add(ring);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7),
        std(0xf3e6cb, { m: 0.05, r: 0.85, o: 0.92 }));
      glove.rotation.x = -Math.PI / 2; glove.position.set(gx, 3.25, 1.45); g.add(glove);
    }
    const rtp = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 12, 26), std(PAL.steel, { m: 0.95, r: 0.2 }));
    rtp.rotation.y = Math.PI / 2; rtp.position.set(-5.35, 3.1, 0); g.add(rtp);
    const lb1 = tint(box(0.35, 1.3, 1.8, std(PAL.lead, { m: 0.6, r: 0.45 })));
    lb1.position.set(-0.9, 3.05, 0); g.add(lb1);
    const lb2 = box(1.0, 0.2, 1.8, std(PAL.lead, { m: 0.6, r: 0.45 }));
    lb2.position.set(-0.35, 3.75, 0); g.add(lb2);

    const belt = box(9.4, 0.14, 0.85, std(0x1c2431, { m: 0.35, r: 0.85 }));
    belt.position.set(0, 2.45, 0); g.add(belt);
    for (const s of [-1, 1]) {
      const rail = box(9.4, 0.1, 0.06, std(PAL.steel, { m: 0.95, r: 0.2 }));
      rail.position.set(0, 2.58, s * 0.48); g.add(rail);
    }
    const vials = new THREE.Group();
    const vg = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 14);
    const vm = phys(0xe6f4ff, { o: 0.6 });
    const cg = new THREE.CylinderGeometry(0.17, 0.17, 0.09, 14);
    const cm = std(0xd9a441, { m: 0.95, r: 0.25 });
    for (let i = 0; i < 14; i++) {
      const v = new THREE.Mesh(vg, vm); v.position.set(-4.4 + i * 0.66, 2.77, 0); vials.add(v);
      const c = new THREE.Mesh(cg, cm); c.position.set(-4.4 + i * 0.66, 3.06, 0); vials.add(c);
    }
    g.add(vials); g.userData.vials = vials;
    const head = box(0.7, 0.6, 0.7, std(PAL.steel, { m: 0.95, r: 0.18 }));
    head.position.set(1.6, 3.6, 0); g.add(head);
    g.userData.needle = head;
    for (let i = 0; i < 3; i++) {
      const n = cyl(0.035, 0.035, 0.55, std(0xdfe7f0, { m: 0.95, r: 0.15 }), 8);
      n.position.set(1.4 + i * 0.2, 3.15, 0); g.add(n);
    }
    const crimp = cyl(0.32, 0.32, 0.6, std(0x59636f, { m: 0.9, r: 0.3 }), 16);
    crimp.position.set(3.4, 3.4, 0); g.add(crimp);
    g.userData.spinY = crimp;
    const tf = trefoil(0.8); tf.position.set(-4.6, 1.6, 1.83); g.add(tf);
    g.add(at(operator(PAL.gownA), -1.6, 0, 3.3));
    g.add(at(operator(PAL.gownA), 2.4, 0, 3.3));
  },

  inspect(g) {
    const plinth = box(9, 0.7, 3.4, std(0x2f3540, { m: 0.5, r: 0.6 }));
    plinth.position.y = 0.35; g.add(plinth);
    const belt = box(8.4, 0.16, 0.9, std(0x1c2431, { m: 0.35, r: 0.85 }));
    belt.position.set(0, 0.8, 0); g.add(belt);
    const vialMat = phys(0xe6f4ff, { o: 0.6 });
    for (let i = 0; i < 10; i++) {
      const v = cyl(0.16, 0.16, 0.5, vialMat, 12);
      v.position.set(-3.6 + i * 0.8, 1.13, 0); g.add(v);
    }
    const booth = tint(box(3.4, 2.6, 0.3, std(0xe7edf4, { m: 0.2, r: 0.6 })));
    booth.position.set(-1.4, 2.2, -1.35); g.add(booth);
    const blk = box(1.5, 1.7, 0.06, std(0x0b0e13, { m: 0.1, r: 0.9 }));
    blk.position.set(-2.2, 2.2, -1.17); g.add(blk);
    const wht = box(1.5, 1.7, 0.06, std(0xf7fafd, { m: 0.05, r: 0.85 }));
    wht.position.set(-0.6, 2.2, -1.17); g.add(wht);
    const lampbar = box(3.2, 0.14, 0.14, basic(0xffffff));
    lampbar.position.set(-1.4, 3.45, -1.0); g.add(lampbar);
    g.userData.lamp = lampbar;
    const camArm = box(0.22, 1.5, 0.22, std(PAL.steelDark, { m: 0.8, r: 0.35 }));
    camArm.position.set(0.9, 1.9, -1.0); g.add(camArm);
    const cam = cyl(0.24, 0.24, 0.7, std(0x1b2430, { m: 0.7, r: 0.3 }), 16);
    cam.rotation.x = Math.PI / 2.4; cam.position.set(0.9, 2.4, -0.6); g.add(cam);
    const lens = cyl(0.16, 0.16, 0.1, basic(0x4ea8ff), 16);
    lens.rotation.x = Math.PI / 2.4; lens.position.set(0.9, 2.16, -0.35); g.add(lens);
    const lab = tint(box(2.2, 1.7, 1.6, std(0x46536b, { m: 0.6, r: 0.4 })));
    lab.position.set(3.0, 1.6, 0); g.add(lab);
    const reel = cyl(0.62, 0.62, 0.28, std(0xf0e2c0, { m: 0.1, r: 0.75 }), 24);
    reel.rotation.x = Math.PI / 2; reel.position.set(3.0, 2.7, 0.5); g.add(reel);
    g.userData.spin = reel;
    const bin = tint(cyl(0.55, 0.45, 1.0, std(0xd9484d, { m: 0.3, r: 0.6 }), 18));
    bin.position.set(1.9, 0.5, 2.0); g.add(bin);
    const scr = box(1.3, 0.85, 0.07, std(0x0d151f, { m: 0.5, r: 0.3 }));
    scr.position.set(4.6, 2.2, 0.4); scr.rotation.y = -0.5; g.add(scr);
    g.add(at(operator(PAL.gownA), -1.4, 0, 1.6));
  },

  pack(g) {
    g.add(at(bench(5.5, 2.0), -2.0, 0, 0));
    for (let i = 0; i < 4; i++) {
      const pot = tint(cyl(0.42, 0.5, 0.95, std(0x8b939d, { m: 0.95, r: 0.25 }), 20));
      pot.position.set(-3.8 + i * 0.95, 1.44, 0); g.add(pot);
      const lid = cyl(0.46, 0.46, 0.16, std(PAL.hazard, { m: 0.5, r: 0.4 }), 20);
      lid.position.set(-3.8 + i * 0.95, 1.98, 0); g.add(lid);
    }
    const pallet = box(3.2, 0.22, 2.4, std(0x8a6b41, { m: 0.05, r: 0.95 }));
    pallet.position.set(2.4, 0.11, 0.4); g.add(pallet);
    for (let i = 0; i < 4; i++) {
      const bx = tint(box(1.3, 1.25, 1.1, std(0xc9a978, { m: 0.05, r: 0.9 })));
      bx.position.set(1.7 + (i % 2) * 1.4, 0.85, -0.1 + Math.floor(i / 2) * 1.05); g.add(bx);
      const tf = trefoil(0.5);
      tf.position.set(1.7 + (i % 2) * 1.4, 0.9, 0.46 + Math.floor(i / 2) * 1.05); g.add(tf);
    }
    const desk = box(2.2, 0.1, 1.2, std(PAL.steel, { m: 0.9, r: 0.3 }));
    desk.position.set(-2.0, 1.02, 2.6); g.add(desk);
    const prn = box(0.8, 0.5, 0.6, std(0x2b3644, { m: 0.5, r: 0.45 }));
    prn.position.set(-2.4, 1.3, 2.6); g.add(prn);
    for (let i = 0; i < 12; i++) {
      const r = cyl(0.12, 0.12, 1.8, std(PAL.steel, { m: 0.95, r: 0.2 }), 10);
      r.rotation.x = Math.PI / 2; r.position.set(4.6 + i * 0.42, 0.75, 0.4); g.add(r);
    }
    const rail = box(5.2, 0.5, 0.1, std(PAL.steelDark, { m: 0.8, r: 0.35 }));
    rail.position.set(6.9, 0.55, 1.35); g.add(rail);
    const rail2 = rail.clone(); rail2.position.z = -0.55; g.add(rail2);
    const shut = tint(box(0.3, 3.4, 4.4, std(0x5d6673, { m: 0.7, r: 0.5 })));
    shut.position.set(9.6, 1.7, 0.4); g.add(shut);
    const stripe = box(0.34, 0.35, 4.4, std(PAL.hazard, { m: 0.3, r: 0.6, e: 0x3a2c00, ei: 0.4 }));
    stripe.position.set(9.6, 0.35, 0.4); g.add(stripe);
    g.add(at(operator(PAL.gownB), -0.4, 0, 2.2));
  },

  utilities(g) {
    const ahu = tint(box(7.5, 3.6, 3.2, std(0x6b7684, { m: 0.75, r: 0.42 })));
    ahu.position.set(-1, 1.9, 0); g.add(ahu);
    for (let i = 0; i < 3; i++) {
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 10, 26), std(0xd6dee8, { m: 0.9, r: 0.3 }));
      guard.position.set(-3.2 + i * 2.2, 2.2, 1.62); g.add(guard);
      const blade = box(1.15, 0.08, 0.2, std(0xaebbc9, { m: 0.9, r: 0.3 }));
      blade.position.set(-3.2 + i * 2.2, 2.2, 1.55); g.add(blade);
      const blade2 = box(0.2, 0.08, 1.15, std(0xaebbc9, { m: 0.9, r: 0.3 }));
      blade2.position.copy(blade.position); g.add(blade2);
      if (i === 1) g.userData.fans = [blade, blade2];
    }
    const fb = box(1.6, 2.4, 0.14, std(0xeaf0f7, { m: 0.15, r: 0.7 }));
    fb.position.set(2.9, 1.9, 1.62); g.add(fb);
    const duct = box(1.4, 1.4, 6, std(0x9aa6b4, { m: 0.85, r: 0.4 }));
    duct.position.set(-1, 5.0, -1.5); g.add(duct);
    const riser = box(1.4, 1.4, 1.4, std(0x9aa6b4, { m: 0.85, r: 0.4 }));
    riser.position.set(-1, 4.4, 1.4); g.add(riser);
    const skid = box(2.6, 0.3, 2.0, std(PAL.steelDark, { m: 0.7, r: 0.45 }));
    skid.position.set(4.6, 0.15, -1.6); g.add(skid);
    for (const px of [-0.6, 0.6]) {
      const p = cyl(0.35, 0.35, 0.8, std(0x2f6f9e, { m: 0.85, r: 0.3 }), 16);
      p.position.set(4.6 + px, 0.7, -1.6); g.add(p);
    }
    g.add(pipeRun([[3.2, 0.9, -1.6], [6.4, 0.9, -1.6], [6.4, 3.2, -1.6], [6.4, 3.2, 1.6]], 0.14,
      std(0x4a90c2, { m: 0.85, r: 0.3 })));
    const wall = tint(box(0.5, 2.2, 4.6, std(PAL.lead, { m: 0.6, r: 0.5 })));
    wall.position.set(2.8, 1.1, -3.4); g.add(wall);
    for (let i = 0; i < 4; i++) {
      const d = tint(cyl(0.55, 0.55, 1.5, std(PAL.hazard, { m: 0.35, r: 0.6 }), 20));
      d.position.set(4.2 + (i % 2) * 1.3, 0.75, -4.2 + Math.floor(i / 2) * 1.4); g.add(d);
      const band = cyl(0.57, 0.57, 0.12, std(0x30363d, { m: 0.6, r: 0.5 }), 20);
      band.position.set(4.2 + (i % 2) * 1.3, 1.2, -4.2 + Math.floor(i / 2) * 1.4); g.add(band);
      const tf = trefoil(0.55);
      tf.position.set(4.2 + (i % 2) * 1.3, 0.85, -3.6 + Math.floor(i / 2) * 1.4); g.add(tf);
    }
    const pan = box(1.8, 1.3, 0.16, std(0x121a24, { m: 0.5, r: 0.35 }));
    pan.position.set(-5.2, 1.9, 0.6); pan.rotation.y = 0.5; g.add(pan);
    const psc = screen(1.6, 1.1, 'sig'); psc.position.set(-5.13, 1.9, 0.68); psc.rotation.y = 0.5; g.add(psc);
  },
};

// ---------------------------------------------------------------------------
// Facility shell
// ---------------------------------------------------------------------------
function buildFacility(scene) {
  const shell = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 150),
    std(PAL.epoxy, { m: 0.25, r: 0.32, env: 1.1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; shell.add(floor);

  const grid = new THREE.GridHelper(220, 110, 0x1d2a3d, 0x151c28);
  grid.position.y = 0.012;
  grid.material.transparent = true; grid.material.opacity = 0.35;
  shell.add(grid);

  const zones = [
    { x: -32, z: -12, w: 14, d: 16.5, c: 0x8d8f8c },
    { x: -19, z: -12, w: 12, d: 16.5, c: 0x2f9e6b },
    { x: -5, z: -12, w: 14.5, d: 16.5, c: 0xff8a3d },
    { x: 10, z: -12, w: 14.5, d: 16.5, c: 0xff4d8d },
    { x: 24, z: -12, w: 13, d: 16.5, c: 0x4ea8ff },
    { x: -3, z: -1, w: 55, d: 4.6, c: 0x3ee0c4 },
    { x: 4, z: 10, w: 23.5, d: 16, c: 0x4ea8ff },
    { x: 24, z: 10, w: 13, d: 16, c: 0x8b93a0 },
    { x: -17, z: 10, w: 15.5, d: 16, c: 0x8b93a0 },
  ];
  for (const z of zones) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d),
      new THREE.MeshBasicMaterial({ color: z.c, transparent: true, opacity: 0.06 }));
    m.rotation.x = -Math.PI / 2; m.position.set(z.x, 0.03, z.z); shell.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(z.w - 0.3, z.d - 0.3)),
      new THREE.LineBasicMaterial({ color: z.c, transparent: true, opacity: 0.35 }));
    e.rotation.x = -Math.PI / 2; e.position.set(z.x, 0.05, z.z); shell.add(e);
  }

  const P = (a, b, o) => partition(shell, a, b, o || {});
  P([-40, -21], [31, -21]);
  P([-40, 18.5], [31, 18.5]);
  P([-40, -21], [-40, 18.5], { solid: true, thick: 1.4, color: PAL.concrete });
  P([31, -21], [31, 18.5]);
  P([-25, -3.5], [31, -3.5], { doors: [0.09, 0.3, 0.52, 0.74, 0.93] });
  P([-25, 1.5], [31, 1.5], { doors: [0.42, 0.78] });
  P([-25, -21], [-25, -3.5], { solid: true, thick: 1.2, color: PAL.concrete });
  P([-12.5, -21], [-12.5, -3.5], { doors: [0.55] });
  P([2.5, -21], [2.5, -3.5], { doors: [0.55] });
  P([17.5, -21], [17.5, -3.5], { doors: [0.55] });
  P([-8, 1.5], [-8, 18.5], { doors: [0.2] });
  P([16.5, 1.5], [16.5, 18.5], { doors: [0.2] });
  P([-40, 1.5], [-25, 1.5], { solid: true, thick: 1.2, color: PAL.concrete });

  shell.add(hepaCeiling(-19, -12, 12, 16));
  shell.add(hepaCeiling(-5, -12, 14.5, 16));
  shell.add(hepaCeiling(10, -12, 14.5, 16));
  shell.add(hepaCeiling(24, -12, 12.5, 16));
  shell.add(hepaCeiling(-3, -1, 55, 4.4));
  shell.add(hepaCeiling(4, 10, 23, 15));

  const trayMat = std(0x3d4855, { m: 0.7, r: 0.5 });
  for (const [x1, z1, x2, z2] of [[-24, 6.4, 26, 6.4], [-19, -12, -19, 5.8], [-5, -12, -5, 5.8], [10, -12, 10, 5.8]]) {
    shell.add(ductRun(x1, z1, x2, z2, 6.9, 1.15));
  }
  for (const [x1, z1, x2, z2] of [[-30, -4.7, 30, -4.7], [-30, 2.7, 30, 2.7]]) {
    const t = ductRun(x1, z1, x2, z2, 6.2, 0.4, trayMat);
    t.scale.y = 0.35; shell.add(t);
  }

  for (const [x, z] of [[-12.5, -3.0], [2.5, -3.0], [17.5, -3.0], [-8, 2.0], [16.5, 2.0]]) {
    const l = box(1.1, 0.14, 0.14, basic(0x41f0c0, 0.9));
    l.position.set(x, 3.1, z); shell.add(l);
  }

  const markMat = new THREE.MeshBasicMaterial({ color: 0x3ee0c4, transparent: true, opacity: 0.2 });
  for (const zz of [-2.9, 0.9]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(55, 0.16), markMat);
    s.rotation.x = -Math.PI / 2; s.position.set(-3, 0.06, zz); shell.add(s);
  }
  const hazMat = new THREE.MeshBasicMaterial({ color: PAL.hazard, transparent: true, opacity: 0.28 });
  for (const [x, z, w, d] of [[-32, -12, 13.5, 16], [-5, -12, 14, 16]]) {
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.2), hazMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.07, z + s * d / 2); shell.add(m);
    }
  }

  scene.add(shell);
  return shell;
}

// ---------------------------------------------------------------------------
// Unidirectional airflow particles
// ---------------------------------------------------------------------------
function airflow(scene, boxes) {
  const PER = 220;
  const N = boxes.length * PER;
  const pos = new Float32Array(N * 3);
  const meta = [];
  let i = 0;
  for (const b of boxes) {
    for (let k = 0; k < PER; k++) {
      pos[i * 3] = b.x + (Math.random() - 0.5) * b.w;
      pos[i * 3 + 1] = b.y0 + Math.random() * (b.y1 - b.y0);
      pos[i * 3 + 2] = b.z + (Math.random() - 0.5) * b.d;
      meta.push({ y0: b.y0, y1: b.y1, v: 0.45 + Math.random() * 0.85 });
      i++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const g2 = cv.getContext('2d');
  const gr = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.15, map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.45,
    depthWrite: false, blending: THREE.AdditiveBlending, color: 0xbfe6ff, toneMapped: false,
  }));
  scene.add(pts);
  return { pts, meta, attr: geo.attributes.position };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------
export function buildScene(scene) {
  scene.background = new THREE.Color(0x05080f);
  scene.fog = new THREE.Fog(0x05080f, 110, 260);

  scene.add(new THREE.HemisphereLight(0xbdd8ff, 0x0a0f18, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(34, 54, 30); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -80; key.shadow.camera.right = 80;
  key.shadow.camera.top = 75; key.shadow.camera.bottom = -75;
  key.shadow.camera.far = 220; key.shadow.bias = -0.0009;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fb6ff, 0.75);
  rim.position.set(-42, 26, -34); scene.add(rim);
  const fill = new THREE.PointLight(0x3ee0c4, 0.5, 130);
  fill.position.set(-6, 14, 8); scene.add(fill);

  buildFacility(scene);

  const stations = {};
  for (const st of STATIONS) {
    const g = new THREE.Group();
    g.position.set(...st.pos);
    builders[st.id](g);

    const tintMats = [];
    g.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.userData.stationId = st.id;
      if (o.userData.tint) { o.material = o.material.clone(); tintMats.push(o.material); }
    });

    const halo = new THREE.Mesh(new THREE.RingGeometry(5.4, 6.9, 64),
      new THREE.MeshBasicMaterial({ color: 0x3ee0c4, transparent: true, opacity: 0.3, side: THREE.DoubleSide, toneMapped: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.1; g.add(halo);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(5.4, 48),
      new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false }));
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.085; g.add(inner);

    const mast = cyl(0.09, 0.09, 2.2, std(PAL.steelDark, { m: 0.8, r: 0.4 }), 8);
    mast.position.set(0, 6.7, 0); g.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 22, 16), basic(0x3ee0c4));
    beacon.position.set(0, 8.0, 0); g.add(beacon);
    const glow = new THREE.PointLight(0x3ee0c4, 2, 28); glow.position.set(0, 8.0, 0); g.add(glow);

    const lbl = makeLabel(st.short, st.zone);
    lbl.position.set(0, 9.9, 0); g.add(lbl);

    scene.add(g);
    stations[st.id] = { group: g, halo, inner, beacon, glow, label: lbl, def: st, tintMats, targetH: 0 };
  }

  const flow = [
    [-32, 1.6, -4.6], [-25, 1.6, -6.5], [-19, 1.6, -6.5], [-12.5, 1.6, -6.5],
    [-5, 1.6, -6.5], [2.5, 1.6, -6.5], [10, 1.6, -6.5], [17.5, 1.6, -6.5],
    [24, 1.6, -6.5], [28.7, 1.6, -2], [28.7, 1.6, 5], [24, 1.6, 9],
  ].map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(flow, false, 'catmullrom', 0.25);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 420, 0.22, 12, false),
    std(0x2c3b52, { m: 0.9, r: 0.3, e: 0x0b2230, ei: 0.6 }));
  scene.add(tube);
  const supMat = std(PAL.steelDark, { m: 0.8, r: 0.4 });
  for (let i = 0; i <= 26; i++) {
    const p = curve.getPointAt(i / 26);
    const s = cyl(0.06, 0.06, 1.6, supMat, 6);
    s.position.set(p.x, 0.8, p.z); scene.add(s);
  }

  const qcBranch = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5, 1.6, -6.5), new THREE.Vector3(-2.5, 1.4, -1),
    new THREE.Vector3(1.5, 1.3, 4), new THREE.Vector3(4, 1.2, 7.5),
  ]);
  const qcTube = new THREE.Mesh(new THREE.TubeGeometry(qcBranch, 140, 0.12, 10, false),
    std(0x2a4a5e, { m: 0.9, r: 0.3, e: 0x0d3346, ei: 0.8 }));
  scene.add(qcTube);

  const puckGeo = new THREE.SphereGeometry(0.34, 18, 14);
  const pucks = [];
  for (let i = 0; i < 20; i++) {
    const p = new THREE.Mesh(puckGeo, basic(0x5ff0d0));
    scene.add(p); pucks.push(p);
  }
  const qcGeo = new THREE.SphereGeometry(0.2, 14, 10);
  const qcPucks = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(qcGeo, basic(0x7fd0ff));
    scene.add(p); qcPucks.push(p);
  }

  const air = airflow(scene, [
    { x: -5, z: -12, w: 12, d: 3, y0: 1.6, y1: 5.4 },
    { x: 10, z: -12, w: 9.6, d: 3, y0: 2.6, y1: 4.25 },
    { x: -19, z: -13.2, w: 4.5, d: 2.3, y0: 1.3, y1: 3.05 },
  ]);

  return { stations, curve, pucks, qcBranch, qcPucks, air, key, walls: WALLS };
}

export { THREE };
