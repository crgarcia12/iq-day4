import * as THREE from 'three';
import { STATIONS } from './line.js';

// ---------------------------------------------------------------------------
// Palette — a personal-care plant: painted floor, stainless, guarded conveyors.
// ---------------------------------------------------------------------------
export const PAL = {
  floor: 0x1b2029,
  wallPanel: 0xcfd6de,
  glass: 0x9fd8ff,
  steel: 0xaab6c4,
  steelDark: 0x59636f,
  guard: 0xd8a637,
  amber: 0xd8a637,
  bottle: 0xe8f2f7,
  lotion: 0xf6efe2,
  carton: 0xc2a071,
  accent: 0x3ee0c4,
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({
  color,
  metalness: o.m ?? 0.35,
  roughness: Math.max(0.3, o.r ?? 0.5),
  transparent: o.o !== undefined,
  opacity: o.o ?? 1,
  emissive: new THREE.Color(o.e ?? 0x000000),
  emissiveIntensity: o.ei ?? 1,
  envMapIntensity: Math.min(0.85, o.env ?? 1),
});

const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color,
  metalness: 0,
  roughness: Math.max(0.2, o.r ?? 0.15),
  transmission: 0.82,
  thickness: 0.3,
  ior: 1.46,
  transparent: true,
  opacity: o.o ?? 1,
  envMapIntensity: 0.4,
});

const basic = (color, opacity) => new THREE.MeshBasicMaterial({
  color, transparent: opacity !== undefined, opacity: opacity ?? 1,
});

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const tint = m => { m.userData.tint = true; return m; };

// ---------------------------------------------------------------------------
// Signage
// ---------------------------------------------------------------------------
function makeLabel(text, sub, tag) {
  const cv = document.createElement('canvas');
  cv.width = 820; cv.height = 210;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(7,12,20,0.9)';
  g.beginPath(); g.roundRect(6, 6, 808, 198, 24); g.fill();
  g.strokeStyle = 'rgba(122,150,172,0.34)'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#3f7d74';
  g.beginPath(); g.roundRect(8, 8, 12, 194, 6); g.fill();
  g.fillStyle = '#c9d8e6';
  g.font = '600 60px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 420, 88, 730);
  g.fillStyle = '#6f8698';
  g.font = '400 36px "Segoe UI", Arial, sans-serif';
  g.fillText(`${tag} · ${sub}`, 420, 148, 730);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(7.2, 1.84, 1);
  sp.renderOrder = 999;
  return sp;
}

function screenTexture(kind) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 320;
  const g = cv.getContext('2d');
  g.fillStyle = '#08131d'; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = 'rgba(80,150,200,0.2)'; g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * 40); g.lineTo(512, i * 40); g.stroke(); }
  for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(i * 42, 0); g.lineTo(i * 42, 320); g.stroke(); }
  g.lineWidth = 3;
  if (kind === 'vib') {
    g.strokeStyle = '#e0a24a'; g.beginPath();
    for (let x = 0; x < 512; x++) {
      const y = 170 + Math.sin(x / 5) * 34 * (0.5 + 0.5 * Math.sin(x / 60)) + Math.sin(x / 1.7) * 9;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#9fc4dd'; g.font = '17px monospace';
    g.fillText('FL-02  VIBRATION  mm/s RMS', 12, 26);
  } else if (kind === 'batch') {
    g.strokeStyle = '#5fbf9f'; g.beginPath();
    for (let x = 0; x < 512; x++) {
      const y = 280 - 200 * (1 - Math.exp(-x / 120));
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#9fc4dd'; g.font = '17px monospace';
    g.fillText('EM-01  BATCH  78 C  vac 80%', 12, 26);
  } else {
    g.strokeStyle = '#5a9ec4'; g.beginPath();
    for (let x = 0; x < 512; x++) {
      const y = 176 + Math.sin(x / 28) * 40;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#9fc4dd'; g.font = '17px monospace';
    g.fillText('LINE 3  OEE  RUNNING', 12, 26);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const screen = (w, h, kind) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({ map: screenTexture(kind), color: 0x8f9aa6 }));

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------
function operator(coat = 0xeef2f6) {
  const g = new THREE.Group();
  const mat = std(coat, { m: 0.05, r: 0.85 });
  const body = cyl(0.28, 0.4, 1.2, mat, 12); body.position.y = 0.7; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), std(0xd8b48c, { m: 0.05, r: 0.8 }));
  head.position.y = 1.5; g.add(head);
  const hat = cyl(0.24, 0.24, 0.12, std(0x3f6fa8, { m: 0.1, r: 0.7 }), 12);
  hat.position.y = 1.66; g.add(hat);
  for (const s of [-1, 1]) {
    const arm = cyl(0.08, 0.08, 0.85, mat, 8);
    arm.position.set(s * 0.34, 0.92, 0.05); arm.rotation.z = s * 0.15; g.add(arm);
  }
  return g;
}

function bench(w, d) {
  const g = new THREE.Group();
  const mat = std(PAL.steel, { m: 0.8, r: 0.32 });
  const top = box(w, 0.1, d, mat); top.position.y = 0.92; g.add(top);
  const carc = box(w - 0.4, 0.8, d - 0.2, std(PAL.steelDark, { m: 0.6, r: 0.5 }));
  carc.position.y = 0.46; g.add(carc);
  return g;
}

// A guarded conveyor section with bottles that stream along it.
function conveyor(len, opts = {}) {
  const g = new THREE.Group();
  const frame = std(PAL.steelDark, { m: 0.75, r: 0.4 });
  const belt = box(len, 0.1, 0.66, std(0x252c36, { m: 0.2, r: 0.85 }));
  belt.position.y = 1.0; g.add(belt);
  for (const s of [-1, 1]) {
    const rail = box(len, 0.06, 0.05, std(PAL.steel, { m: 0.9, r: 0.3 }));
    rail.position.set(0, 1.14, s * 0.4); g.add(rail);
    const guard = box(len, 0.05, 0.05, std(PAL.guard, { m: 0.4, r: 0.5 }));
    guard.position.set(0, 1.42, s * 0.52); g.add(guard);
  }
  const legs = Math.max(2, Math.round(len / 2.5));
  for (let i = 0; i < legs; i++) {
    const l = box(0.1, 1.0, 0.1, frame);
    l.position.set(-len / 2 + (i + 0.5) * (len / legs), 0.5, 0); g.add(l);
  }
  // bottle stream
  const bottles = new THREE.Group();
  const bg = new THREE.CylinderGeometry(0.11, 0.12, 0.42, 12);
  const bm = phys(PAL.bottle, { o: 0.75 });
  const cg = new THREE.CylinderGeometry(0.07, 0.09, 0.1, 12);
  const cm = std(0xe2762f, { m: 0.25, r: 0.5 });
  const n = Math.max(4, Math.floor(len / (opts.pitch ?? 0.55)));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + i * (opts.pitch ?? 0.55);
    const b = new THREE.Mesh(bg, bm); b.position.set(x, 1.26, 0); bottles.add(b);
    const c = new THREE.Mesh(cg, cm); c.position.set(x, 1.52, 0); bottles.add(c);
  }
  g.add(bottles);
  g.userData.bottles = bottles;
  g.userData.pitch = opts.pitch ?? 0.55;
  g.userData.span = len;
  return g;
}

function tank(r, h, opts = {}) {
  const g = new THREE.Group();
  const shell = tint(cyl(r, r, h, std(PAL.steel, { m: 0.88, r: 0.28 }), 28));
  shell.position.y = h / 2 + 0.6; g.add(shell);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    std(PAL.steel, { m: 0.88, r: 0.28 }));
  dome.position.y = h + 0.6; g.add(dome);
  const cone = cyl(r, r * 0.22, 0.7, std(PAL.steel, { m: 0.88, r: 0.3 }), 28);
  cone.position.y = 0.35; g.add(cone);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.07, 0.07, 0.75, std(PAL.steelDark, { m: 0.8, r: 0.4 }), 8);
    leg.position.set(Math.cos(a) * r * 0.8, 0.37, Math.sin(a) * r * 0.8); g.add(leg);
  }
  if (opts.motor) {
    const mtr = box(r * 0.8, 0.85, r * 0.8, std(0x4a6272, { m: 0.7, r: 0.4 }));
    mtr.position.y = h + r * 0.6 + 1.05; g.add(mtr);
    const shaft = cyl(0.08, 0.08, 0.5, std(PAL.steel, { m: 0.95, r: 0.2 }), 8);
    shaft.position.y = h + r * 0.6 + 0.45; g.add(shaft);
    const fan = cyl(r * 0.5, r * 0.5, 0.08, std(0x6f7f8c, { m: 0.8, r: 0.35 }), 16);
    fan.position.y = h + r * 0.6 + 1.55; g.add(fan);
    g.userData.spinY = fan;
  }
  if (opts.jacket) {
    const band = cyl(r * 1.04, r * 1.04, 0.16, std(0x8a94a0, { m: 0.6, r: 0.5 }), 28);
    band.position.y = h * 0.55; g.add(band);
    const band2 = band.clone(); band2.position.y = h * 0.85; g.add(band2);
  }
  return g;
}

function pipeRun(pts, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 12, radius, 8, false), mat);
}

function racking(bays, levels, w = 2.6) {
  const g = new THREE.Group();
  const steelM = std(0x3f6fa8, { m: 0.55, r: 0.5 });
  for (let b = 0; b <= bays; b++) {
    for (const z of [-0.55, 0.55]) {
      const post = box(0.16, levels * 1.5, 0.16, steelM);
      post.position.set(b * w, levels * 0.75, z); g.add(post);
    }
  }
  for (let l = 1; l <= levels; l++) {
    const beam = box(bays * w, 0.12, 0.12, steelM);
    for (const z of [-0.55, 0.55]) {
      const bm = beam.clone();
      bm.position.set((bays * w) / 2, l * 1.5, z); g.add(bm);
    }
    for (let b = 0; b < bays; b++) {
      if ((b + l) % 4 === 3) continue;
      const pal = box(w * 0.82, 0.14, 1.05, std(0x9a7748, { m: 0.05, r: 0.9 }));
      pal.position.set(b * w + w / 2, l * 1.5 + 0.13, 0); g.add(pal);
      const load = tint(box(w * 0.76, 0.95, 1.0, std(0xb9a184, { m: 0.05, r: 0.85 })));
      load.position.set(b * w + w / 2, l * 1.5 + 0.68, 0); g.add(load);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Station builders
// ---------------------------------------------------------------------------
const builders = {
  dispensing(g) {
    g.add(at(racking(4, 3), -5.5, 0, -3.4));
    g.add(at(racking(3, 3), -4.2, 0, 3.6));
    // weighing platform + IBC totes
    const plat = box(3.2, 0.18, 2.6, std(0x5b6673, { m: 0.6, r: 0.5 }));
    plat.position.set(3.4, 0.09, 0); g.add(plat);
    for (let i = 0; i < 2; i++) {
      const cage = tint(box(1.15, 1.15, 1.15, std(0x8f9aa6, { m: 0.5, r: 0.5 })));
      cage.position.set(2.7 + i * 1.4, 0.76, 0); g.add(cage);
      const liq = box(1.0, 0.85, 1.0, std(0xf0e2c4, { m: 0, r: 0.6 }));
      liq.position.set(2.7 + i * 1.4, 0.68, 0); g.add(liq);
      const frame = box(1.2, 0.1, 1.2, std(0x3f6fa8, { m: 0.5, r: 0.5 }));
      frame.position.set(2.7 + i * 1.4, 1.36, 0); g.add(frame);
    }
    // drums
    for (let i = 0; i < 4; i++) {
      const d = cyl(0.42, 0.42, 1.1, std(i % 2 ? 0x3f6fa8 : 0xc9573f, { m: 0.4, r: 0.5 }), 16);
      d.position.set(6.2 + (i % 2) * 1.0, 0.55, -1.4 + Math.floor(i / 2) * 1.0); g.add(d);
    }
    const scaleScr = box(0.7, 0.5, 0.06, std(0x101820, { m: 0.4, r: 0.4 }));
    scaleScr.position.set(4.9, 1.5, 0.8); g.add(scaleScr);
    g.add(at(operator(), 4.4, 0, 1.9));
  },

  phases(g) {
    g.add(at(tank(1.5, 3.4, { motor: true, jacket: true }), -2.6, 0, 0));
    g.add(at(tank(1.5, 3.4, { motor: true, jacket: true }), 2.6, 0, 0));
    // mezzanine access platform
    const deck = box(9, 0.14, 3.4, std(0x5b6673, { m: 0.55, r: 0.55 }));
    deck.position.set(0, 3.3, 2.9); g.add(deck);
    for (const x of [-4, 0, 4]) {
      const leg = box(0.14, 3.3, 0.14, std(PAL.steelDark, { m: 0.7, r: 0.45 }));
      leg.position.set(x, 1.65, 4.4); g.add(leg);
    }
    for (let i = 0; i < 10; i++) {
      const rail = box(0.06, 0.9, 0.06, std(PAL.steel, { m: 0.85, r: 0.35 }));
      rail.position.set(-4.3 + i * 0.95, 3.8, 1.3); g.add(rail);
    }
    const top = box(9, 0.06, 0.06, std(PAL.steel, { m: 0.85, r: 0.35 }));
    top.position.set(0, 4.25, 1.3); g.add(top);
    // steam / water headers
    const pm = std(0x7d8996, { m: 0.8, r: 0.35 });
    g.add(pipeRun([[-4.4, 4.7, 0], [4.4, 4.7, 0]], 0.13, pm));
    g.add(pipeRun([[-2.6, 4.7, 0], [-2.6, 4.0, 0]], 0.1, pm));
    g.add(pipeRun([[2.6, 4.7, 0], [2.6, 4.0, 0]], 0.1, pm));
    const scr = screen(1.5, 0.95, 'batch'); scr.position.set(0, 1.9, 1.9); g.add(scr);
    const panel = box(1.7, 1.15, 0.14, std(0x121a24, { m: 0.4, r: 0.4 }));
    panel.position.set(0, 1.9, 1.82); g.add(panel);
    g.add(at(operator(), -0.9, 0, 2.6));
  },

  emulsifier(g) {
    // main vacuum emulsifier vessel
    g.add(at(tank(2.2, 4.0, { jacket: true }), 0, 0, 0));
    // homogeniser drive on top
    const drive = tint(box(1.7, 1.5, 1.7, std(0x44586a, { m: 0.7, r: 0.4 })));
    drive.position.set(0, 6.4, 0); g.add(drive);
    const cool = cyl(0.9, 0.9, 0.5, std(0x8f9aa6, { m: 0.85, r: 0.3 }), 20);
    cool.position.set(0, 7.35, 0); g.add(cool);
    const fan = cyl(0.85, 0.85, 0.08, std(0x6f7f8c, { m: 0.8, r: 0.35 }), 18);
    fan.position.set(0, 7.66, 0); g.add(fan);
    g.userData.spinY = fan;
    // sight glass + charge port
    const sight = cyl(0.3, 0.3, 0.5, phys(0xbfe0f0, { o: 0.5 }), 14);
    sight.position.set(1.9, 3.4, 1.1); sight.rotation.x = Math.PI / 2; g.add(sight);
    // vacuum pump skid
    const skid = box(2.4, 0.25, 1.6, std(PAL.steelDark, { m: 0.7, r: 0.45 }));
    skid.position.set(4.2, 0.12, 1.6); g.add(skid);
    const pump = cyl(0.45, 0.45, 1.3, std(0x4a6272, { m: 0.75, r: 0.35 }), 16);
    pump.rotation.z = Math.PI / 2; pump.position.set(4.2, 0.75, 1.6); g.add(pump);
    const mtr = cyl(0.38, 0.38, 0.8, std(0x3f6fa8, { m: 0.6, r: 0.45 }), 16);
    mtr.rotation.z = Math.PI / 2; mtr.position.set(5.4, 0.75, 1.6); g.add(mtr);
    g.add(pipeRun([[3.4, 0.9, 1.6], [2.2, 2.0, 1.0], [1.6, 3.6, 0.4]], 0.12,
      std(0x7d8996, { m: 0.8, r: 0.35 })));
    // transfer line down to the filler
    g.add(pipeRun([[0, 1.0, 2.2], [0, 0.9, 6], [3, 0.9, 8]], 0.16,
      std(PAL.steel, { m: 0.9, r: 0.3 })));
    const hmi = box(1.3, 0.95, 0.12, std(0x121a24, { m: 0.4, r: 0.4 }));
    hmi.position.set(-2.6, 1.9, 1.9); hmi.rotation.y = 0.4; g.add(hmi);
    const scr = screen(1.15, 0.82, 'batch'); scr.position.set(-2.55, 1.9, 1.97); scr.rotation.y = 0.4; g.add(scr);
    g.add(at(operator(), -2.8, 0, 3.0));
  },

  qc(g) {
    g.add(at(bench(7.5, 2.0), 0, 0, -1.2));
    g.add(at(bench(5.0, 2.0), -1.2, 0, 2.8));
    // viscometer
    const visc = box(0.75, 0.9, 0.6, std(0xe6ecf3, { m: 0.25, r: 0.5 }));
    visc.position.set(-2.6, 1.42, -1.2); g.add(visc);
    const stand = cyl(0.05, 0.05, 1.0, std(PAL.steel, { m: 0.9, r: 0.3 }), 8);
    stand.position.set(-2.0, 1.47, -1.2); g.add(stand);
    // SPF plate reader
    const spf = tint(box(1.5, 0.75, 1.0, std(0xdfe6ef, { m: 0.3, r: 0.45 })));
    spf.position.set(-0.4, 1.35, -1.2); g.add(spf);
    const lid = box(1.3, 0.08, 0.85, std(0x3f6fa8, { m: 0.4, r: 0.5 }));
    lid.position.set(-0.4, 1.76, -1.2); g.add(lid);
    // microscope + pH meter
    const scope = cyl(0.16, 0.24, 0.85, std(0x2b3644, { m: 0.6, r: 0.4 }), 12);
    scope.position.set(1.2, 1.4, -1.2); g.add(scope);
    const ph = box(0.5, 0.35, 0.4, std(0xe6ecf3, { m: 0.25, r: 0.5 }));
    ph.position.set(2.2, 1.15, -1.2); g.add(ph);
    // retained sample rack
    for (let i = 0; i < 10; i++) {
      const s = cyl(0.09, 0.09, 0.3, phys(PAL.bottle, { o: 0.6 }), 10);
      s.position.set(-2.8 + (i % 5) * 0.26, 1.12, 2.8 + Math.floor(i / 5) * 0.3); g.add(s);
    }
    const fume = tint(box(2.2, 2.2, 1.2, std(0xe7edf4, { m: 0.2, r: 0.6 })));
    fume.position.set(3.4, 1.6, 2.6); g.add(fume);
    const sash = box(2.0, 1.0, 0.05, std(PAL.glass, { m: 0.05, r: 0.15, o: 0.2, env: 0.5 }));
    sash.position.set(3.4, 1.75, 2.02); g.add(sash);
    g.add(at(operator(0xf6f8fa), 0.6, 0, 0.6));
  },

  // ---- the hero asset ----
  filler(g) {
    const plinth = box(7.5, 0.35, 4.2, std(0x38414d, { m: 0.5, r: 0.6 }));
    plinth.position.set(0, 0.17, 0); g.add(plinth);
    // machine body
    const body = tint(box(5.4, 1.5, 3.2, std(PAL.steel, { m: 0.85, r: 0.3 })));
    body.position.set(0, 1.1, 0); g.add(body);
    // guarded enclosure
    const gm = std(PAL.glass, { m: 0.05, r: 0.15, o: 0.12, env: 0.5 });
    const encl = box(5.6, 2.6, 3.4, gm);
    encl.position.set(0, 3.1, 0); g.add(encl);
    for (const [x, z] of [[-2.8, -1.7], [2.8, -1.7], [-2.8, 1.7], [2.8, 1.7]]) {
      const post = box(0.12, 2.6, 0.12, std(PAL.guard, { m: 0.4, r: 0.5 }));
      post.position.set(x, 3.1, z); g.add(post);
    }
    const top = box(5.7, 0.16, 3.5, std(PAL.steelDark, { m: 0.7, r: 0.4 }));
    top.position.set(0, 4.45, 0); g.add(top);
    // filling head carousel — 12 nozzles on a rotating plate
    const carousel = new THREE.Group();
    const plate = cyl(1.5, 1.5, 0.16, std(PAL.steel, { m: 0.92, r: 0.25 }), 28);
    carousel.add(plate);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const nz = cyl(0.07, 0.05, 0.5, std(0xd7dee6, { m: 0.9, r: 0.25 }), 8);
      nz.position.set(Math.cos(a) * 1.25, -0.32, Math.sin(a) * 1.25);
      carousel.add(nz);
      const pist = cyl(0.13, 0.13, 0.55, std(PAL.steel, { m: 0.9, r: 0.3 }), 10);
      pist.position.set(Math.cos(a) * 1.25, 0.42, Math.sin(a) * 1.25);
      carousel.add(pist);
    }
    carousel.position.set(0, 2.6, 0); g.add(carousel);
    g.userData.carousel = carousel;
    // product bowl above
    const bowl = tint(cyl(1.0, 0.8, 0.8, std(PAL.steel, { m: 0.9, r: 0.28 }), 22));
    bowl.position.set(0, 3.9, 0); g.add(bowl);
    g.add(pipeRun([[-3.2, 3.9, 0], [-1.0, 3.9, 0]], 0.13, std(PAL.steel, { m: 0.9, r: 0.3 })));
    // infeed / outfeed conveyors
    const inC = conveyor(4.6, { pitch: 0.5 });
    inC.position.set(-5.4, 0, 0); g.add(inC);
    const outC = conveyor(4.6, { pitch: 0.5 });
    outC.position.set(5.4, 0, 0); g.add(outC);
    g.userData.convs = [inC, outC];
    // drive motor — the component carrying the maintenance order
    const drive = tint(cyl(0.55, 0.55, 1.1, std(0x3f6fa8, { m: 0.7, r: 0.4 }), 18));
    drive.rotation.z = Math.PI / 2; drive.position.set(-2.4, 0.95, 1.9); g.add(drive);
    const fanCowl = cyl(0.35, 0.35, 0.3, std(0x2b3644, { m: 0.7, r: 0.4 }), 14);
    fanCowl.rotation.z = Math.PI / 2; fanCowl.position.set(-3.1, 0.95, 1.9); g.add(fanCowl);
    g.userData.drive = drive;
    // vibration sensor + HMI
    const sensor = box(0.2, 0.2, 0.2, std(0xe0a24a, { m: 0.5, r: 0.4 }));
    sensor.position.set(-2.4, 1.6, 1.9); g.add(sensor);
    g.userData.sensor = sensor;
    const hmi = box(1.5, 1.1, 0.12, std(0x121a24, { m: 0.4, r: 0.4 }));
    hmi.position.set(2.2, 2.0, 1.95); hmi.rotation.y = -0.25; g.add(hmi);
    const scr = screen(1.32, 0.95, 'vib'); scr.position.set(2.15, 2.0, 2.02); scr.rotation.y = -0.25; g.add(scr);
    // andon stack light
    const stack = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const l = cyl(0.16, 0.16, 0.22, basic([0x2a3a2a, 0x3a3520, 0x3a2424][i], 1), 12);
      l.position.y = i * 0.24; stack.add(l);
    }
    stack.position.set(-2.9, 4.6, -1.5); g.add(stack);
    g.userData.andon = stack;
    g.add(at(operator(), 2.6, 0, 3.0));
  },

  capper(g) {
    const plinth = box(5.2, 0.35, 3.4, std(0x38414d, { m: 0.5, r: 0.6 }));
    plinth.position.set(0, 0.17, 0); g.add(plinth);
    const body = tint(box(3.4, 1.4, 2.4, std(PAL.steel, { m: 0.85, r: 0.3 })));
    body.position.set(0, 1.05, 0); g.add(body);
    // cap hopper + elevator chute
    const hopper = tint(cyl(1.0, 0.35, 1.1, std(0x8f9aa6, { m: 0.6, r: 0.45 }), 18));
    hopper.position.set(-1.6, 3.6, -0.9); g.add(hopper);
    const chute = box(0.3, 2.4, 0.3, std(PAL.steel, { m: 0.85, r: 0.3 }));
    chute.rotation.z = 0.35; chute.position.set(-0.8, 2.4, -0.9); g.add(chute);
    for (let i = 0; i < 6; i++) {
      const c = cyl(0.1, 0.12, 0.1, std(0xe2762f, { m: 0.25, r: 0.5 }), 10);
      c.position.set(-1.7 + i * 0.16, 4.15, -0.9 + (i % 2) * 0.2); g.add(c);
    }
    // capping heads
    const heads = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const h = cyl(0.17, 0.17, 0.6, std(PAL.steel, { m: 0.92, r: 0.25 }), 12);
      h.position.set(-0.75 + i * 0.5, 0, 0); heads.add(h);
    }
    heads.position.set(0.3, 2.2, 0); g.add(heads);
    g.userData.heads = heads;
    // induction sealer tunnel
    const tunnel = tint(box(1.6, 0.8, 1.0, std(0x4a6272, { m: 0.6, r: 0.45 })));
    tunnel.position.set(1.9, 1.85, 0); g.add(tunnel);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 20), std(0xc9884a, { m: 0.9, r: 0.3 }));
    coil.rotation.x = Math.PI / 2; coil.position.set(1.9, 1.5, 0); g.add(coil);
    const conv = conveyor(5.0, { pitch: 0.5 });
    conv.position.set(0, 0, 0); g.add(conv);
    g.userData.convs = [conv];
    g.add(at(operator(), -1.4, 0, 2.3));
  },

  labeller(g) {
    const plinth = box(5.0, 0.35, 3.2, std(0x38414d, { m: 0.5, r: 0.6 }));
    plinth.position.set(0, 0.17, 0); g.add(plinth);
    const body = tint(box(2.8, 1.3, 2.0, std(PAL.steel, { m: 0.85, r: 0.3 })));
    body.position.set(-0.6, 1.0, -0.6); g.add(body);
    // label reels
    for (let i = 0; i < 2; i++) {
      const reel = cyl(0.85, 0.85, 0.3, std(0xf0e6d2, { m: 0.05, r: 0.8 }), 24);
      reel.rotation.x = Math.PI / 2;
      reel.position.set(-1.5 + i * 1.9, 2.5, -0.9); g.add(reel);
      const hub = cyl(0.2, 0.2, 0.34, std(PAL.steelDark, { m: 0.8, r: 0.4 }), 12);
      hub.rotation.x = Math.PI / 2; hub.position.set(-1.5 + i * 1.9, 2.5, -0.9); g.add(hub);
      if (i === 0) g.userData.reel = reel;
    }
    // applicator + vision camera + coder
    const app = box(0.7, 0.6, 0.5, std(0x4a6272, { m: 0.7, r: 0.4 }));
    app.position.set(0.4, 1.65, 0); g.add(app);
    const cam = cyl(0.16, 0.16, 0.5, std(0x2b3644, { m: 0.7, r: 0.35 }), 12);
    cam.rotation.x = Math.PI / 2.6; cam.position.set(1.5, 2.0, -0.5); g.add(cam);
    const lens = cyl(0.11, 0.11, 0.06, basic(0x2f6f9e), 12);
    lens.rotation.x = Math.PI / 2.6; lens.position.set(1.5, 1.83, -0.28); g.add(lens);
    const coder = box(0.5, 0.45, 0.4, std(0x3f6fa8, { m: 0.5, r: 0.45 }));
    coder.position.set(2.3, 1.6, -0.5); g.add(coder);
    const conv = conveyor(5.0, { pitch: 0.5 });
    conv.position.set(0, 0, 0); g.add(conv);
    g.userData.convs = [conv];
    // reject chute + bin
    const bin = tint(cyl(0.5, 0.4, 0.8, std(0xb3453f, { m: 0.3, r: 0.6 }), 14));
    bin.position.set(2.4, 0.4, 1.6); g.add(bin);
    g.add(at(operator(), -1.0, 0, 2.2));
  },

  packer(g) {
    // case erector + cartoner
    const cart = tint(box(4.0, 2.0, 2.4, std(PAL.steel, { m: 0.8, r: 0.35 })));
    cart.position.set(-4.0, 1.2, 0); g.add(cart);
    const hood = box(4.2, 0.16, 2.6, std(PAL.steelDark, { m: 0.7, r: 0.4 }));
    hood.position.set(-4.0, 2.3, 0); g.add(hood);
    const conv = conveyor(4.4, { pitch: 0.5 });
    conv.position.set(-7.4, 0, 0); g.add(conv);
    g.userData.convs = [conv];
    // case conveyor with cartons
    const caseConv = box(5.0, 0.12, 0.9, std(0x252c36, { m: 0.2, r: 0.85 }));
    caseConv.position.set(-0.4, 1.0, 0); g.add(caseConv);
    const cartons = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const c = box(0.62, 0.45, 0.7, std(PAL.carton, { m: 0.05, r: 0.9 }));
      c.position.set(-2.6 + i * 0.8, 1.29, 0); cartons.add(c);
    }
    g.add(cartons); g.userData.cartons = cartons;
    // palletising robot
    const base = cyl(0.7, 0.85, 0.6, std(0xe0a24a, { m: 0.5, r: 0.45 }), 18);
    base.position.set(2.8, 0.3, 0); g.add(base);
    const armGrp = new THREE.Group();
    const a1 = box(0.4, 2.2, 0.4, std(0xe0a24a, { m: 0.5, r: 0.45 }));
    a1.position.y = 1.1; armGrp.add(a1);
    const a2 = box(2.0, 0.34, 0.34, std(0xe0a24a, { m: 0.5, r: 0.45 }));
    a2.position.set(0.9, 2.1, 0); armGrp.add(a2);
    const grip = box(0.6, 0.4, 0.6, std(0x3a4450, { m: 0.7, r: 0.4 }));
    grip.position.set(1.8, 1.85, 0); armGrp.add(grip);
    armGrp.position.set(2.8, 0.6, 0); g.add(armGrp);
    g.userData.robot = armGrp;
    // finished pallets + stretch wrapper
    for (let i = 0; i < 3; i++) {
      const pal = box(1.5, 0.16, 1.2, std(0x9a7748, { m: 0.05, r: 0.9 }));
      pal.position.set(5.4, 0.08, -1.8 + i * 1.8); g.add(pal);
      const load = tint(box(1.4, 1.5, 1.15, std(0xb9a184, { m: 0.05, r: 0.85 })));
      load.position.set(5.4, 0.9, -1.8 + i * 1.8); g.add(load);
    }
    const wrapRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 8, 24),
      std(PAL.steelDark, { m: 0.7, r: 0.4 }));
    wrapRing.rotation.x = Math.PI / 2; wrapRing.position.set(5.4, 1.4, 1.8); g.add(wrapRing);
    g.userData.wrap = wrapRing;
    g.add(at(operator(), 0.4, 0, 2.4));
  },

  cip(g) {
    // CIP skid: three tanks + pump set
    for (let i = 0; i < 3; i++) {
      const t = tint(cyl(0.85, 0.85, 2.4, std(PAL.steel, { m: 0.85, r: 0.3 }), 20));
      t.position.set(-2.4 + i * 2.4, 1.5, 0); g.add(t);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        std(PAL.steel, { m: 0.85, r: 0.3 }));
      dome.position.set(-2.4 + i * 2.4, 2.7, 0); g.add(dome);
      const band = cyl(0.88, 0.88, 0.14, std([0x3f6fa8, 0xc9573f, 0x5fa37a][i], { m: 0.4, r: 0.5 }), 20);
      band.position.set(-2.4 + i * 2.4, 2.2, 0); g.add(band);
    }
    const skid = box(7.6, 0.24, 2.2, std(PAL.steelDark, { m: 0.7, r: 0.45 }));
    skid.position.set(0, 0.12, 0); g.add(skid);
    for (const x of [-1.2, 1.2]) {
      const p = cyl(0.34, 0.34, 0.9, std(0x3f6fa8, { m: 0.65, r: 0.4 }), 14);
      p.rotation.z = Math.PI / 2; p.position.set(x, 0.6, 1.4); g.add(p);
    }
    const pm = std(0x7d8996, { m: 0.8, r: 0.35 });
    g.add(pipeRun([[-3.2, 3.2, 0], [3.2, 3.2, 0]], 0.11, pm));
    g.add(pipeRun([[3.2, 3.2, 0], [4.4, 3.2, -1.6], [4.4, 1.2, -4.0]], 0.11, pm));
    const panel = box(1.4, 1.1, 0.14, std(0x121a24, { m: 0.4, r: 0.4 }));
    panel.position.set(-4.4, 1.7, 0.6); panel.rotation.y = 0.5; g.add(panel);
    const scr = screen(1.22, 0.92, 'line'); scr.position.set(-4.33, 1.7, 0.68); scr.rotation.y = 0.5; g.add(scr);
  },
};

// ---------------------------------------------------------------------------
// Building shell
// ---------------------------------------------------------------------------
const WALLS = [];
const CEILING = [];

function partition(group, a, b, opts = {}) {
  const [x1, z1] = a, [x2, z2] = b;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  const th = opts.thick ?? 0.28;
  const H = opts.height ?? 5.2;
  const doorW = opts.doorW ?? 3.4;
  const doors = opts.doors || [];

  const segs = [];
  let cursor = 0;
  for (const d of [...doors].sort((p, q) => p - q)) {
    const s = d - doorW / 2 / len, e = d + doorW / 2 / len;
    if (s > cursor) segs.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < 1) segs.push([cursor, 1]);

  const panelMat = std(opts.color ?? PAL.wallPanel, { m: 0.1, r: 0.66, env: 0.5 });
  const glassMat = std(PAL.glass, { m: 0.05, r: 0.15, o: 0.13, env: 0.5 });
  const faded = m => { const f = m.clone(); f.transparent = true; f.opacity = 0.06; f.depthWrite = false; return f; };
  const panelFade = faded(panelMat), glassFade = faded(glassMat);

  const place = (mat, fade, t0, t1, y, h, d) => {
    const l = (t1 - t0) * len;
    if (l <= 0.05) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, d), mat);
    const mid = (t0 + t1) / 2;
    m.position.set(x1 + (x2 - x1) * mid, y, z1 + (z2 - z1) * mid);
    m.rotation.y = ang;
    m.castShadow = true; m.receiveShadow = true;
    m.userData.wall = { solid: mat, fade };
    WALLS.push(m);
    group.add(m);
  };

  for (const [t0, t1] of segs) {
    if (opts.solid) place(panelMat, panelFade, t0, t1, H / 2, H, th);
    else {
      place(panelMat, panelFade, t0, t1, 0.7, 1.4, th);
      place(glassMat, glassFade, t0, t1, 2.7, 2.6, th * 0.4);
      place(panelMat, panelFade, t0, t1, 4.6, 1.2, th);
    }
  }
  for (const d of doors) {
    const fx = x1 + (x2 - x1) * d, fz = z1 + (z2 - z1) * d;
    const frame = box(doorW + 0.3, 0.22, th * 1.2, std(PAL.steelDark, { m: 0.7, r: 0.4 }));
    frame.position.set(fx, 3.3, fz); frame.rotation.y = ang; group.add(frame);
  }
}

function ceilingGrid(x, z, w, d, y = 6.6) {
  const g = new THREE.Group();
  const nx = Math.max(1, Math.round(w / 3)), nz = Math.max(1, Math.round(d / 3));
  const cw = w / nx, cd = d / nz;
  const panMat = std(0x6b7684, { m: 0.2, r: 0.75, o: 0.14 });
  const litMat = std(0xdfe9f2, { m: 0.1, r: 0.7, o: 0.3 });
  panMat.depthWrite = false; litMat.depthWrite = false;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lit = (i + j) % 3 === 0;
    const p = box(cw * 0.94, 0.1, cd * 0.94, lit ? litMat : panMat);
    p.position.set(x - w / 2 + cw * (i + 0.5), y, z - d / 2 + cd * (j + 0.5));
    p.castShadow = false;
    g.add(p);
  }
  CEILING.push(g);
  return g;
}

function buildShell(scene) {
  const shell = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 160),
    std(PAL.floor, { m: 0.05, r: 0.75, env: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; shell.add(floor);

  const grid = new THREE.GridHelper(240, 120, 0x232d3a, 0x1a212b);
  grid.position.y = 0.012;
  grid.material.transparent = true; grid.material.opacity = 0.3;
  shell.add(grid);

  // zone floors
  const zones = [
    { x: -34, z: -12, w: 17, d: 18, c: 0x7d8b9c },   // warehouse / dispensing
    { x: -21, z: -12, w: 9, d: 18, c: 0x5fa37a },    // compounding
    { x: -8, z: -12, w: 13, d: 18, c: 0x5fa37a },    // emulsification
    { x: 6, z: -12, w: 14, d: 18, c: 0x4e8fd0 },     // filling
    { x: 19, z: -12, w: 11, d: 18, c: 0x4e8fd0 },    // capping
    { x: 32, z: -12, w: 12, d: 18, c: 0x4e8fd0 },    // labelling
    { x: 6, z: 10, w: 16, d: 16, c: 0xc0a24a },      // QC lab
    { x: 32, z: 10, w: 18, d: 16, c: 0x7d8b9c },     // despatch
    { x: -18, z: 10, w: 16, d: 16, c: 0x7d8b9c },    // technical / CIP
  ];
  for (const z of zones) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d),
      new THREE.MeshBasicMaterial({ color: z.c, transparent: true, opacity: 0.05 }));
    m.rotation.x = -Math.PI / 2; m.position.set(z.x, 0.03, z.z); shell.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(z.w - 0.3, z.d - 0.3)),
      new THREE.LineBasicMaterial({ color: z.c, transparent: true, opacity: 0.16 }));
    e.rotation.x = -Math.PI / 2; e.position.set(z.x, 0.05, z.z); shell.add(e);
  }

  const P = (a, b, o) => partition(shell, a, b, o || {});
  P([-44, -22], [40, -22]);
  P([-44, 19], [40, 19]);
  P([-44, -22], [-44, 19], { solid: true, thick: 1.0, color: 0x8c95a0 });
  P([40, -22], [40, 19], { solid: true, thick: 1.0, color: 0x8c95a0 });
  // compounding is a separated area from the packing hall
  P([-26, -22], [-26, -3], { doors: [0.6] });
  P([-2, -22], [-2, -3], { doors: [0.55] });
  // corridor between the north production band and the south service band
  P([-44, -3], [40, -3], { doors: [0.1, 0.34, 0.58, 0.78, 0.93] });
  P([-2, 2], [-2, 19], { doors: [0.3] });
  P([16, 2], [16, 19], { doors: [0.3] });

  shell.add(ceilingGrid(-21, -12, 34, 18));
  shell.add(ceilingGrid(19, -12, 40, 18));
  shell.add(ceilingGrid(6, 10, 16, 16));

  // overhead services
  const duct = std(0x8e9aa8, { m: 0.8, r: 0.45 });
  for (const [x1, z1, x2, z2] of [[-40, -18, 36, -18], [-40, 6.5, 36, 6.5]]) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = box(len, 1.0, 1.0, duct);
    m.position.set((x1 + x2) / 2, 7.6, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    shell.add(m);
  }

  // aisle markings
  const aisle = new THREE.MeshBasicMaterial({ color: 0xc9a13f, transparent: true, opacity: 0.16 });
  for (const zz of [-2.2, -0.2]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(82, 0.16), aisle);
    s.rotation.x = -Math.PI / 2; s.position.set(-2, 0.06, zz); shell.add(s);
  }

  scene.add(shell);
  return shell;
}

// ---------------------------------------------------------------------------
export function buildScene(scene) {
  scene.background = new THREE.Color(0x070b12);
  scene.fog = new THREE.Fog(0x070b12, 120, 280);

  scene.add(new THREE.HemisphereLight(0xc6dcf0, 0x0d1219, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(36, 58, 34); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -90; key.shadow.camera.right = 90;
  key.shadow.camera.top = 80; key.shadow.camera.bottom = -80;
  key.shadow.camera.far = 240; key.shadow.bias = -0.0009;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x86b6e0, 0.7);
  rim.position.set(-44, 28, -36); scene.add(rim);
  const front = new THREE.DirectionalLight(0xdceaff, 0.7);
  front.position.set(-4, 36, 66); scene.add(front);

  buildShell(scene);

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

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x3ee0c4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(5.0, 6.4, 56), haloMat);
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.1; halo.renderOrder = 3;
    halo.visible = false; g.add(halo);

    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff4d4d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const inner = new THREE.Mesh(new THREE.CircleGeometry(5.0, 44), innerMat);
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.085; inner.renderOrder = 2;
    inner.visible = false; g.add(inner);

    const mast = cyl(0.08, 0.08, 2.0, std(PAL.steelDark, { m: 0.8, r: 0.4 }), 8);
    mast.position.set(0, 7.2, 0); g.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14), basic(0x222b36));
    beacon.position.set(0, 8.4, 0); beacon.scale.setScalar(0.5); g.add(beacon);
    const glow = new THREE.PointLight(0x3ee0c4, 0, 26); glow.position.set(0, 8.4, 0); g.add(glow);

    const lbl = makeLabel(st.short, st.zone, st.tag);
    lbl.position.set(0, 10.1, 0); g.add(lbl);

    scene.add(g);
    stations[st.id] = { group: g, halo, inner, beacon, glow, label: lbl, def: st, tintMats, targetH: 0 };
  }

  // material flow: bulk from compounding to filling, then packed goods to despatch
  const flow = [
    [-34, 1.3, -6], [-21, 1.3, -6], [-8, 1.3, -6], [6, 1.3, -6],
    [19, 1.3, -6], [32, 1.3, -6], [36, 1.3, 0], [32, 1.3, 8],
  ].map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(flow, false, 'catmullrom', 0.25);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 360, 0.16, 10, false),
    std(0x36414f, { m: 0.85, r: 0.35 }));
  scene.add(tube);

  const puckGeo = new THREE.SphereGeometry(0.3, 14, 10);
  const pucks = [];
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(puckGeo, basic(0x2f8f78));
    scene.add(p); pucks.push(p);
  }

  return { stations, curve, pucks, walls: WALLS, ceiling: CEILING, key };
}

export { THREE };
