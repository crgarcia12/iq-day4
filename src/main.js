import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { STATIONS, DEFAULTS, ISOTOPES, PRESETS, simulate } from './sim.js';
import { buildScene } from './scene.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const params = { ...DEFAULTS };
let result = simulate(params);
let openStation = null;
let quality = 'high';

// ---------------------------------------------------------------------------
// Renderer + post-processing
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 600);
camera.position.set(-8, 78, 96);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(-6, 2, -4);
controls.maxPolarAngle = Math.PI / 2.15;
controls.minDistance = 10;
controls.maxDistance = 190;

const { stations, curve, pucks, qcBranch, qcPucks, air, walls, ceiling } = buildScene(scene);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.52, 0.72, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
const pickTargets = Object.values(stations).map(s => s.group);
let hovered = null;

function pick(ev) {
  ndc.x = (ev.clientX / innerWidth) * 2 - 1;
  ndc.y = -(ev.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects(pickTargets, true)) {
    let o = h.object;
    while (o) { if (o.userData.stationId) return o.userData.stationId; o = o.parent; }
  }
  return null;
}

renderer.domElement.addEventListener('pointermove', ev => {
  const id = pick(ev);
  hovered = id;
  if (id) {
    const st = STATIONS.find(s => s.id === id);
    const n = (result.issues[id] || []).length;
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(ev.clientX + 16, innerWidth - 320) + 'px';
    tooltip.style.top = ev.clientY + 16 + 'px';
    tooltip.innerHTML = `<b>${st.short}</b><span class="tt-sub">${n ? `${n} open deviation${n > 1 ? 's' : ''} · click for detail` : 'within design space · click to tune'}</span>`;
    tooltip.className = n ? 'warn' : '';
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tooltip.style.display = 'none';
    renderer.domElement.style.cursor = 'grab';
  }
});

let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => (downAt = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', ev => {
  if (!downAt) return;
  const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;
  const id = pick(ev);
  if (id) openModal(id);
  else if (openStation) closeModal();
});

// ---------------------------------------------------------------------------
// Health colouring
// ---------------------------------------------------------------------------
const COL_OK = new THREE.Color(0x3ee0c4);
const COL_WARN = new THREE.Color(0xffc247);
const COL_BAD = new THREE.Color(0xff4136);

function healthColor(h) {
  return h < 0.38
    ? COL_OK.clone().lerp(COL_WARN, h / 0.38)
    : COL_WARN.clone().lerp(COL_BAD, Math.min(1, (h - 0.38) / 0.62));
}

function applyHealth() {
  for (const st of STATIONS) {
    const s = stations[st.id];
    const h = result.health[st.id] || 0;
    const c = healthColor(h);
    s.targetH = h;
    s.color = c;
    s.halo.material.color.copy(c);
    s.beacon.material.color.copy(c);
    s.glow.color.copy(c);
    s.inner.material.color.copy(c);
    s.inner.material.opacity = h * 0.13;
    for (const m of s.tintMats) {
      m.emissive.copy(c);
      m.emissiveIntensity = h * 0.75;
    }
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const fmt = (v, d = 1) => (isFinite(v) ? v.toFixed(d) : '—');
const cls = (v, warnAt, badAt, higherIsBetter = false) => {
  if (higherIsBetter) return v < badAt ? 'bad' : v < warnAt ? 'warn' : 'good';
  return v > badAt ? 'bad' : v > warnAt ? 'warn' : 'good';
};

function renderKPIs() {
  const k = result.kpi;
  const u = s => `<span class="u">${s}</span>`;
  const items = [
    { v: fmt(k.dosesPerDay, 0), l: 'Patient doses / day', c: cls(k.dosesPerDay, 20, 8, true) },
    { v: fmt(k.oee, 0) + u('%'), l: 'Line OEE', c: cls(k.oee, 55, 35, true) },
    { v: fmt(k.rcp, 1) + u('%'), l: 'Radiochemical purity', c: k.rcpFail ? 'bad' : cls(k.rcp, 97, 95.5, true) },
    { v: fmt(k.rcy, 0) + u('%'), l: 'Labeling yield', c: cls(k.rcy, 90, 75, true) },
    { v: fmt(k.grossErrorRate, 1) + u('%'), l: 'Defect rate', c: cls(k.grossErrorRate, 3, 10) },
    { v: fmt(k.escapedDefects, 2) + u('%'), l: 'Escaped to release', c: cls(k.escapedDefects, 0.5, 2) },
    { v: fmt(k.decayLossPct, 1) + u('%'), l: 'Decay loss', c: cls(k.decayLossPct, 15, 35) },
    { v: fmt(k.cycleMin, 0) + u('min'), l: 'Batch cycle time', c: cls(k.cycleMin, 240, 400) },
    { v: fmt(k.activityEOB, 0) + u('GBq'), l: 'Activity at end of synthesis', c: 'info' },
    { v: fmt(k.molarActivity, 0) + u('GBq/µmol'), l: 'Molar activity', c: 'info' },
    { v: fmt(k.doseRate, 1) + u('µSv/h'), l: 'Dose rate at cell face', c: cls(k.doseRate, 7.5, 25) },
    { v: fmt(k.tiPot, 2), l: 'Transport index', c: cls(k.tiPot, 1, 10) },
    { v: '$' + fmt(k.revenuePerDay / 1e6, 2) + u('M'), l: 'Dose value released / day', c: 'good' },
    { v: '$' + fmt(k.valueLostPerDay / 1e6, 2) + u('M'), l: 'Value lost / day', c: cls(k.valueLostPerDay / 1e6, 1.5, 4) },
  ];
  document.getElementById('kpi-grid').innerHTML = items
    .map(i => `<div class="kpi"><div class="v ${i.c}">${i.v}</div><div class="l">${i.l}</div></div>`).join('');

  const status = document.getElementById('status');
  const worst = Math.max(0, ...Object.values(result.health));
  if (k.rcpFail) { status.textContent = 'Batch rejected'; status.className = 'pill bad'; }
  else if (worst > 0.6) { status.textContent = 'Critical deviation'; status.className = 'pill bad'; }
  else if (worst > 0.2) { status.textContent = 'Deviations open'; status.className = 'pill warn'; }
  else { status.textContent = 'In control'; status.className = 'pill ok'; }

  document.getElementById('isotope-pill').textContent = ISOTOPES[params.isotope].label;
  document.getElementById('batch-pill').textContent =
    `${k.dosesPerBatch} doses/batch · ${fmt(k.batchesPerDay, 1)} batches/day`;
}

function renderConsumables() {
  document.getElementById('cons-list').innerHTML = Object.entries(result.consumables)
    .map(([k, v]) => `<div class="cons-row"><span>${k}</span><b>${v.qty}<i> ${v.unit}</i></b></div>`)
    .join('');
}

function renderAlerts() {
  const rows = [];
  for (const st of STATIONS) {
    for (const i of result.issues[st.id] || []) {
      rows.push({ id: st.id, name: st.short, sev: i.sev, text: i.text, ref: i.ref });
    }
  }
  rows.sort((a, b) => b.sev - a.sev);
  document.getElementById('alert-count').textContent = rows.length;
  const el = document.getElementById('alert-list');
  el.innerHTML = rows.length
    ? rows.map(r => `<div class="alert ${r.sev > 0.6 ? 'crit' : ''}" data-st="${r.id}">
        <span class="st">${r.name}${r.ref ? ` · <i>${r.ref}</i>` : ''}</span>${r.text}</div>`).join('')
    : '<div class="ok-note">✓ Every station is inside its validated design space. Batch is releasable.</div>';
  el.querySelectorAll('.alert').forEach(a => (a.onclick = () => openModal(a.dataset.st)));
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
const modal = document.getElementById('modal');
const cardBody = document.getElementById('card-body');

function openModal(id) {
  openStation = id;
  renderModal();
  modal.classList.add('open');
  document.body.classList.add('drawer-open');
  focusStation(id);
}
function closeModal() {
  modal.classList.remove('open');
  document.body.classList.remove('drawer-open');
  openStation = null;
}
addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'r' || e.key === 'R') applyPreset('nominal');
});

function impactHTML() {
  const st = STATIONS.find(s => s.id === openStation);
  const k = result.kpi;
  const util = (result.util[st.id] || 0) * 100;
  const cells = [
    [util.toFixed(0) + '%', 'Station utilisation', util > 95 ? 'bad' : util > 82 ? 'warn' : 'good'],
    [k.dosesPerDay.toFixed(0), 'Doses / day', cls(k.dosesPerDay, 20, 8, true)],
    [k.grossErrorRate.toFixed(1) + '%', 'Defect rate', cls(k.grossErrorRate, 3, 10)],
    [k.rcp.toFixed(1) + '%', 'RCP', k.rcpFail ? 'bad' : 'good'],
    [k.rcy.toFixed(0) + '%', 'Labeling yield', cls(k.rcy, 90, 75, true)],
    [k.oee.toFixed(0) + '%', 'Line OEE', cls(k.oee, 55, 35, true)],
  ];
  return cells.map(([v, l, c]) => `<div><div class="v ${c}">${v}</div><div class="l">${l}</div></div>`).join('');
}

function issuesHTML() {
  const issues = result.issues[openStation] || [];
  return issues.length
    ? issues.map(i => `<div class="issue ${i.sev > 0.6 ? 'crit' : ''}">
        ${i.ref ? `<span class="ref">${i.ref}</span>` : ''}${i.text}</div>`).join('')
    : `<div class="issue ok">✓ Operating inside the validated design space — no deviation raised.</div>`;
}

function renderModal() {
  if (!openStation) return;
  const st = STATIONS.find(s => s.id === openStation);

  cardBody.innerHTML = `
    <div class="card-head">
      <div>
        <div class="zone">${st.zone}</div>
        <h3>${st.name}</h3>
      </div>
      <button class="btn icon" id="close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="desc">${st.desc}</div>

    <div class="section-title">Active deviations</div>
    <div id="issue-box">${issuesHTML()}</div>

    <div class="section-title">Critical process parameters <i>— drag and watch the whole line react</i></div>
    ${st.params.map(p => p.type === 'enum'
      ? `<div class="param"><div class="top"><span>${p.label}</span></div>
           <select data-key="${p.key}">${p.options.map(o =>
             `<option value="${o}" ${params[p.key] === o ? 'selected' : ''}>${ISOTOPES[o] ? ISOTOPES[o].label : o}</option>`).join('')}</select>
           ${p.note ? `<div class="note">${p.note}</div>` : ''}</div>`
      : `<div class="param"><div class="top"><span>${p.label}</span><b id="v-${p.key}">${(+params[p.key]).toFixed(p.step < 1 ? 1 : 0)}${p.unit ? ' ' + p.unit : ''}</b></div>
           <input type="range" data-key="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${params[p.key]}">
           <div class="scale"><span>${p.min}</span>${p.ok ? `<span class="ok-band">validated ${p.ok[0]}–${p.ok[1]}${p.unit ? ' ' + p.unit : ''}</span>` : '<span></span>'}<span>${p.max}</span></div>
           ${p.note ? `<div class="note">${p.note}</div>` : ''}</div>`
    ).join('')}

    <div class="section-title">Line impact right now</div>
    <div class="impact" id="impact-box">${impactHTML()}</div>

    <div class="section-title">Equipment &amp; consumables at this station</div>
    <div class="supplies">${st.supplies.map(s => `<span class="chip">${s}</span>`).join('')}</div>
  `;

  document.getElementById('close-btn').onclick = closeModal;

  cardBody.querySelectorAll('input[type=range]').forEach(inp => {
    inp.oninput = () => {
      const key = inp.dataset.key;
      const def = st.params.find(p => p.key === key);
      params[key] = parseFloat(inp.value);
      document.getElementById('v-' + key).textContent =
        params[key].toFixed(def.step < 1 ? 1 : 0) + (def.unit ? ' ' + def.unit : '');
      recompute(true);
    };
  });
  cardBody.querySelectorAll('select').forEach(sel => {
    sel.onchange = () => { params[sel.dataset.key] = sel.value; recompute(); };
  });
}

function recompute(partial = false) {
  result = simulate(params);
  applyHealth();
  renderKPIs();
  renderConsumables();
  renderAlerts();
  if (!openStation) return;
  if (partial) {
    const ib = document.getElementById('issue-box');
    const im = document.getElementById('impact-box');
    if (ib) ib.innerHTML = issuesHTML();
    if (im) im.innerHTML = impactHTML();
  } else {
    renderModal();
  }
}

function focusStation(id) {
  const p = STATIONS.find(s => s.id === id).pos;
  flyTo(new THREE.Vector3(p[0], 3, p[2]), null, 750);
}

function flyTo(target, camPos, ms = 900) {
  const t0 = performance.now();
  const fromT = controls.target.clone();
  const fromC = camera.position.clone();
  (function anim() {
    const t = Math.min(1, (performance.now() - t0) / ms);
    const e = 1 - Math.pow(1 - t, 3);
    controls.target.lerpVectors(fromT, target, e);
    if (camPos) camera.position.lerpVectors(fromC, camPos, e);
    if (t < 1) requestAnimationFrame(anim);
  })();
}

// ---------------------------------------------------------------------------
// Presets & toolbar
// ---------------------------------------------------------------------------
function applyPreset(name) {
  Object.assign(params, DEFAULTS, PRESETS[name] || {});
  recompute();
  tooltip.style.display = 'none';
  document.querySelectorAll('#topbar .btn[data-preset]').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === name));
}
document.querySelectorAll('#topbar .btn[data-preset]').forEach(b => {
  b.onclick = () => applyPreset(b.dataset.preset);
});

let tourIdx = -1, tourTimer = null;
const tourBtn = document.getElementById('btn-tour');
function stopTour() {
  clearInterval(tourTimer); tourTimer = null; tourIdx = -1;
  controls.autoRotate = false; tourBtn.classList.remove('active');
  tourBtn.textContent = 'Guided tour';
}
function stepTour() {
  tourIdx = (tourIdx + 1) % STATIONS.length;
  const st = STATIONS[tourIdx];
  const p = st.pos;
  flyTo(new THREE.Vector3(p[0], 3, p[2]),
    new THREE.Vector3(p[0] - 4, 16, p[2] + 24), 1600);
  openStation = st.id; renderModal();
  modal.classList.add('open'); document.body.classList.add('drawer-open');
}
tourBtn.onclick = () => {
  if (tourTimer) { stopTour(); closeModal(); return; }
  tourBtn.classList.add('active'); tourBtn.textContent = 'Stop tour';
  stepTour();
  tourTimer = setInterval(stepTour, 6500);
};
document.getElementById('btn-overview').onclick = () => {
  stopTour(); closeModal();
  flyTo(new THREE.Vector3(-6, 2, -4), new THREE.Vector3(-5, 45, 58), 1100);
};

const qualityBtn = document.getElementById('btn-quality');
qualityBtn.onclick = () => {
  quality = quality === 'high' ? 'fast' : 'high';
  const high = quality === 'high';
  bloom.enabled = high;
  renderer.shadowMap.enabled = high;
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.8) : 1);
  air.pts.visible = high;
  qualityBtn.textContent = high ? 'Quality: high' : 'Quality: fast';
  resize();
};

// panel collapse on small screens
document.querySelectorAll('.panel h2').forEach(h => {
  h.onclick = () => h.parentElement.classList.toggle('collapsed');
});

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const k = result.kpi;
  const risk = Math.min(1, k.grossErrorRate / 28);

  // ---- product flow along the shielded transfer path ----
  const flowRate = params.conveyorSpeed / 46;
  for (let i = 0; i < pucks.length; i++) {
    const p = pucks[i];
    const u = (t * flowRate + i / pucks.length) % 1;
    curve.getPointAt(u, tmp);
    p.position.set(tmp.x, tmp.y + 0.42 + Math.sin(t * 3 + i) * 0.05, tmp.z);
    p.material.color.setRGB(0.36 + risk * 0.64, 0.94 - risk * 0.6, 0.82 - risk * 0.74);
    p.scale.setScalar(0.85 + 0.15 * Math.sin(t * 6 + i));
  }
  for (let i = 0; i < qcPucks.length; i++) {
    const p = qcPucks[i];
    const u = (t * 0.09 + i / qcPucks.length) % 1;
    qcBranch.getPointAt(u, tmp);
    p.position.set(tmp.x, tmp.y + 0.3, tmp.z);
  }

  // ---- airflow particles ----
  if (air.pts.visible) {
    const arr = air.attr.array;
    const vel = 0.55 + params.airChanges / 42;
    for (let i = 0; i < air.meta.length; i++) {
      const m = air.meta[i];
      arr[i * 3 + 1] -= dt * m.v * vel * 2.2;
      if (arr[i * 3 + 1] < m.y0) arr[i * 3 + 1] = m.y1;
    }
    air.attr.needsUpdate = true;
    air.pts.material.opacity = 0.18 + Math.min(0.5, params.airChanges / 90);
  }

  // ---- machines ----
  for (const st of STATIONS) {
    const s = stations[st.id];
    const u = result.util[st.id] || 0;
    const h = s.targetH || 0;
    const d = s.group.userData;

    if (d.spin) d.spin.rotation.z += dt * (0.5 + u * 3.2);
    if (d.spinY) d.spinY.rotation.y += dt * (1.4 + u * 6);
    if (d.fans) for (const f of d.fans) f.rotation.z += dt * (2 + params.airChanges / 8);
    if (d.beam) {
      d.beam.scale.setScalar(1 + 0.03 * Math.sin(t * 9));
      d.beam.material.opacity = 1;
      d.beam.visible = params.beamCurrent > 12;
    }
    if (d.vials) d.vials.position.x = (t * params.fillSpeed * 0.11) % 0.66;
    if (d.needle) d.needle.position.y = 3.6 - 0.12 * Math.abs(Math.sin(t * params.fillSpeed * 0.5));
    if (d.laf) d.laf.material.opacity = 0.18 + Math.min(0.4, params.airChanges / 110) + 0.05 * Math.sin(t * 2);
    if (d.lamp) d.lamp.material.opacity = 0.6 + 0.4 * (params.inspectRigor / 100);
    if (d.beacon2) {
      d.beacon2.material.color.copy(s.color || COL_OK);
      d.beacon2.visible = Math.sin(t * (3 + h * 8)) > (h > 0.2 ? -0.2 : 0.75);
    }

    // status pulse — faster and brighter with risk
    const pulse = 0.55 + 0.45 * Math.sin(t * (1.8 + h * 9));
    s.beacon.scale.setScalar(0.78 + h * 0.55 * pulse + pulse * 0.14);
    s.glow.intensity = (1.3 + h * 7) * (0.6 + 0.4 * pulse);
    s.halo.material.opacity = (0.2 + h * 0.55) * (0.68 + 0.32 * pulse);
    s.halo.scale.setScalar(1 + h * 0.07 * pulse);
    s.inner.material.opacity = h * 0.14 * (0.6 + 0.4 * pulse);
    if (hovered === st.id) {
      s.halo.material.opacity = Math.min(1, s.halo.material.opacity + 0.35);
      s.halo.scale.setScalar(1.05);
    }
  }

  controls.update();

  // "dollhouse" wall culling: fade partitions that sit between the camera and
  // the point being looked at, so the near side of the building never occludes.
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  for (const w of walls) {
    const d = tmp.copy(w.position).sub(controls.target).dot(fwd);
    const want = d < -1.5 ? w.userData.wall.fade : w.userData.wall.solid;
    if (w.material !== want) w.material = want;
  }

  // Ceiling only closes in when the camera moves down onto a station. From the
  // overview distance it is hidden so the floorplan and machines stay readable.
  const showCeiling = camera.position.distanceTo(controls.target) < 46;
  for (const c of ceiling) if (c.visible !== showCeiling) c.visible = showCeiling;

  (bloom.enabled ? composer : renderer).render(scene, camera);
}

// ---------------------------------------------------------------------------
recompute();
tick();
// cinematic entry
flyTo(new THREE.Vector3(-6, 2, -4), new THREE.Vector3(-5, 45, 58), 2400);

// Test/automation surface: project a station's body to screen coordinates.
window.__rlt = {
  params, simulate,
  get result() { return result; },
  stationIds: STATIONS.map(s => s.id),
  open: openModal,
  project(id) {
    const s = stations[id];
    if (!s) return null;
    // pick the bulkiest body mesh so the ray lands on real geometry
    let best = null, bestVol = -1;
    const bb = new THREE.Box3(), sz = new THREE.Vector3();
    s.group.traverse(o => {
      if (!o.isMesh || !o.geometry || o.geometry.type === 'RingGeometry' || o.geometry.type === 'CircleGeometry') return;
      bb.setFromObject(o); bb.getSize(sz);
      const vol = sz.x * sz.y * sz.z;
      if (vol > bestVol) { bestVol = vol; best = o; }
    });
    if (!best) return null;
    bb.setFromObject(best);
    const v = bb.getCenter(new THREE.Vector3()).project(camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  },
};
