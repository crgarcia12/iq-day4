import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  STATIONS, DEFAULTS, DEMAND, PRODUCT, HORIZON_DAYS, PM_DURATION_DAYS,
  simulate, rateCurve, optimalRate, planAt, damageFactor,
} from './line.js';
import { buildSteps, AGENTS, ONTOLOGY } from './scenario.js';
import { buildScene } from './factory.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const params = { ...DEFAULTS };
let result = simulate(params);
let steps = buildSteps(params);
let stepIndex = 0;
let openStation = null;
let quality = 'high';
let ontologyHops = 0;

const fmt = n => Math.round(n).toLocaleString('en-GB');
const fmtM = n => (n / 1e6).toFixed(2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------------------
// Renderer
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
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 700);
camera.position.set(0, 56, 70);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
scene.environmentIntensity = 0.3;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(2, 2, -3);
controls.maxPolarAngle = Math.PI / 2.15;
controls.minDistance = 10;
controls.maxDistance = 210;

const { stations, curve, pucks, walls, ceiling } = buildScene(scene);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.6, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  drawTimeline(); drawCurve(); drawOntology();
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
    tooltip.style.left = Math.min(ev.clientX + 16, innerWidth - 330) + 'px';
    tooltip.style.top = ev.clientY + 16 + 'px';
    tooltip.innerHTML = `<b>${st.short}</b> <span class="tag">${st.tag}</span>` +
      `<span class="tt-sub">${n ? `${n} open issue${n > 1 ? 's' : ''} · click for detail` : 'running to plan · click to inspect'}</span>`;
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
  if (id) openDrawer(id);
  else if (openStation) closeDrawer();
});

// ---------------------------------------------------------------------------
// Status colours
// ---------------------------------------------------------------------------
const COL_OK = new THREE.Color(0x3ee0c4);
const COL_WARN = new THREE.Color(0xffc247);
const COL_BAD = new THREE.Color(0xff4136);
const healthColor = h => h < 0.38
  ? COL_OK.clone().lerp(COL_WARN, h / 0.38)
  : COL_WARN.clone().lerp(COL_BAD, Math.min(1, (h - 0.38) / 0.62));

function applyHealth() {
  for (const st of STATIONS) {
    const s = stations[st.id];
    const h = result.health[st.id] || 0;
    const c = healthColor(h);
    s.targetH = h;
    s.color = c;
    s.halo.material.color.copy(c);
    s.glow.color.copy(c);
    s.inner.material.color.copy(c);
    s.emiss = -1;
  }
}

// ---------------------------------------------------------------------------
// KPI dock
// ---------------------------------------------------------------------------
const cls = (v, warnAt, badAt, higherBetter = false) => higherBetter
  ? (v < badAt ? 'bad' : v < warnAt ? 'warn' : 'good')
  : (v > badAt ? 'bad' : v > warnAt ? 'warn' : 'good');

function renderKPIs() {
  const k = result.kpi;
  const u = s => `<span class="u">${s}</span>`;
  const cov = k.coverage;
  const items = [
    { v: fmt(k.dailyOutput / 1000) + u('k'), l: 'Units per day', c: 'info' },
    { v: fmtM(k.monthlyOutput) + u('M'), l: 'Monthly output', c: cov >= 100 ? 'good' : 'bad' },
    { v: fmtM(k.demand) + u('M'), l: 'Committed demand', c: 'info' },
    { v: cov.toFixed(1) + u('%'), l: 'Demand coverage', c: cov >= 100 ? 'good' : cov >= 95 ? 'warn' : 'bad' },
    { v: k.productionDays + u('d'), l: 'Production days', c: k.lostDays > 0 ? 'warn' : 'good' },
    { v: k.oee.toFixed(1) + u('%'), l: 'Line OEE', c: cls(k.oee, 65, 50, true) },
    { v: k.bpm + u('bpm'), l: 'Line speed', c: 'info' },
    { v: k.rejectRate.toFixed(2) + u('%'), l: 'Reject rate', c: cls(k.rejectRate, 1.2, 2.5) },
    { v: k.rulDays.toFixed(0) + u('d'), l: 'FL-02 remaining life', c: cls(k.rulDays, 20, 12, true) },
    { v: k.vibration.toFixed(1) + u('mm/s'), l: `Vibration · zone ${k.vibZone.zone}`, c: k.vibZone.cls },
    { v: (k.pmInHorizon ? 'Day ' + k.pmStartDay : 'Deferred'), l: 'PM-4471 window', c: k.pmInHorizon ? 'bad' : 'good' },
    { v: (k.gap >= 0 ? '+' : '') + fmt(k.gap / 1000) + u('k'), l: 'Capacity vs demand', c: k.gap >= 0 ? 'good' : 'bad' },
  ];
  document.getElementById('kpi-grid').innerHTML = items
    .map(i => `<div class="kpi"><div class="v ${i.c}">${i.v}</div><div class="l">${i.l}</div></div>`).join('');

  const status = document.getElementById('status');
  if (!k.batchRelease) { status.textContent = 'Batch would fail QC'; status.className = 'pill bad'; }
  else if (k.gap < 0) { status.textContent = 'Demand not covered'; status.className = 'pill bad'; }
  else if (k.pmInHorizon) { status.textContent = 'PM window in month'; status.className = 'pill warn'; }
  else { status.textContent = 'Plan feasible'; status.className = 'pill ok'; }

  document.getElementById('rate-pill').textContent = `${params.lineRate}% · ${k.bpm} bpm`;
  document.getElementById('rate-value').textContent = `${params.lineRate}%`;
  document.getElementById('rate-slider').value = params.lineRate;
  document.getElementById('rate-sub').innerHTML =
    `${k.bpm} bottles/min · RUL <b>${k.rulDays.toFixed(0)} d</b> · vibration zone <b>${k.vibZone.zone}</b>`;
}

function renderConsumables() {
  document.getElementById('cons-list').innerHTML = Object.entries(result.consumables)
    .map(([k, v]) => `<div class="cons-row"><span>${k}</span><b>${fmt(v.qty)}<i> ${v.unit}</i></b></div>`).join('');
}

// ---------------------------------------------------------------------------
// Month timeline
// ---------------------------------------------------------------------------
const tlCanvas = document.getElementById('timeline');
function drawTimeline() {
  const k = result.kpi;
  const dpr = Math.min(devicePixelRatio, 2);
  const w = tlCanvas.clientWidth, h = tlCanvas.clientHeight;
  if (!w || !h) return;
  tlCanvas.width = w * dpr; tlCanvas.height = h * dpr;
  const g = tlCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const padL = 8, padR = 8, padT = 20, rowH = 22;
  const cw = (w - padL - padR) / HORIZON_DAYS;

  // day cells
  for (let d = 1; d <= HORIZON_DAYS; d++) {
    const x = padL + (d - 1) * cw;
    const isPM = k.pmInHorizon && d >= k.pmStartDay && d <= Math.min(HORIZON_DAYS, k.pmEndDay);
    g.fillStyle = isPM ? 'rgba(255,90,90,0.55)' : 'rgba(62,224,196,0.30)';
    g.fillRect(x + 1, padT, cw - 2, rowH);
    if (d % 5 === 0 || d === 1) {
      g.fillStyle = 'rgba(150,175,200,0.75)';
      g.font = '9px "Segoe UI", sans-serif';
      g.textAlign = 'center';
      g.fillText(String(d), x + cw / 2, padT - 6);
    }
  }
  // PM label
  if (k.pmInHorizon) {
    const x0 = padL + (k.pmStartDay - 1) * cw;
    const x1 = padL + Math.min(HORIZON_DAYS, k.pmEndDay) * cw;
    g.fillStyle = '#ffd0d0';
    g.font = '600 9.5px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    if (x1 - x0 > 42) g.fillText('PM-4471', (x0 + x1) / 2, padT + 15);
  }

  // cumulative output vs demand
  const chartT = padT + rowH + 12;
  const chartH = h - chartT - 16;
  const maxY = Math.max(k.demand, k.monthlyOutput) * 1.08;
  const yOf = v => chartT + chartH - (v / maxY) * chartH;

  // demand line
  g.strokeStyle = 'rgba(255,194,71,0.9)';
  g.lineWidth = 1.5; g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(padL, yOf(k.demand)); g.lineTo(w - padR, yOf(k.demand));
  g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(255,194,71,0.95)';
  g.font = '9.5px "Segoe UI", sans-serif'; g.textAlign = 'left';
  g.fillText(`committed demand ${fmtM(k.demand)} M`, padL + 2, yOf(k.demand) - 4);

  // cumulative production
  g.beginPath();
  let cum = 0;
  g.moveTo(padL, yOf(0));
  for (let d = 1; d <= HORIZON_DAYS; d++) {
    const isPM = k.pmInHorizon && d >= k.pmStartDay && d <= Math.min(HORIZON_DAYS, k.pmEndDay);
    if (!isPM) cum += k.dailyOutput;
    g.lineTo(padL + d * cw, yOf(cum));
  }
  const met = cum >= k.demand;
  g.strokeStyle = met ? 'rgba(62,224,196,0.95)' : 'rgba(255,90,90,0.95)';
  g.lineWidth = 2.2; g.stroke();
  g.lineTo(w - padR, yOf(0)); g.lineTo(padL, yOf(0)); g.closePath();
  g.fillStyle = met ? 'rgba(62,224,196,0.10)' : 'rgba(255,90,90,0.10)';
  g.fill();

  g.fillStyle = met ? 'rgba(62,224,196,0.95)' : 'rgba(255,120,120,0.95)';
  g.textAlign = 'right';
  g.fillText(`${met ? 'covered' : 'short'} · ${fmtM(cum)} M`, w - padR - 2, yOf(cum) - 5);
}

// ---------------------------------------------------------------------------
// Rate vs monthly output curve
// ---------------------------------------------------------------------------
const curveCanvas = document.getElementById('curve');
let curveCache = null;
function drawCurve() {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = curveCanvas.clientWidth, h = curveCanvas.clientHeight;
  if (!w || !h) return;
  curveCanvas.width = w * dpr; curveCanvas.height = h * dpr;
  const g = curveCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const pts = curveCache || (curveCache = rateCurve({ ...params, campaignApplied: true }, 70, 105, 1));
  const padL = 30, padR = 10, padT = 12, padB = 18;
  const xs = pts.map(p => p.rate);
  const ys = pts.map(p => p.monthly);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const maxY = Math.max(...ys) * 1.05, minY = Math.min(...ys) * 0.9;
  // a failed batch drives output to zero everywhere; nothing meaningful to plot
  if (!(maxY > minY)) {
    g.fillStyle = 'rgba(150,175,200,0.6)';
    g.font = '10px "Segoe UI", sans-serif'; g.textAlign = 'center';
    g.fillText('no output — batch fails QC release', w / 2, h / 2);
    return;
  }
  const X = r => padL + ((r - minX) / (maxX - minX)) * (w - padL - padR);
  const Y = v => padT + (1 - (v - minY) / (maxY - minY)) * (h - padT - padB);

  // demand reference
  const demand = DEMAND.baseline + DEMAND.campaignUplift;
  if (demand > minY && demand < maxY) {
    g.strokeStyle = 'rgba(255,194,71,0.75)'; g.setLineDash([4, 3]); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(padL, Y(demand)); g.lineTo(w - padR, Y(demand)); g.stroke();
    g.setLineDash([]);
  }

  // the curve, coloured by whether the PM sits inside the month
  g.lineWidth = 2.4;
  for (let i = 1; i < pts.length; i++) {
    g.beginPath();
    g.moveTo(X(pts[i - 1].rate), Y(pts[i - 1].monthly));
    g.lineTo(X(pts[i].rate), Y(pts[i].monthly));
    g.strokeStyle = pts[i].pmInHorizon ? 'rgba(255,90,90,0.95)' : 'rgba(62,224,196,0.95)';
    g.stroke();
  }

  // current operating point
  const cur = pts.reduce((a, b) => Math.abs(b.rate - params.lineRate) < Math.abs(a.rate - params.lineRate) ? b : a);
  g.fillStyle = '#eaf4ff';
  g.beginPath(); g.arc(X(cur.rate), Y(cur.monthly), 4.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.stroke();

  // axes
  g.fillStyle = 'rgba(150,175,200,0.8)';
  g.font = '9px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  for (const r of [70, 80, 90, 100]) g.fillText(r + '%', X(r), h - 5);
  g.textAlign = 'left';
  g.fillText((maxY / 1e6).toFixed(1) + 'M', 2, padT + 6);
  g.fillText((minY / 1e6).toFixed(1) + 'M', 2, h - padB);
}

// ---------------------------------------------------------------------------
// Ontology graph
// ---------------------------------------------------------------------------
const ontoCanvas = document.getElementById('onto-canvas');
function drawOntology() {
  const wrap = document.getElementById('onto-panel');
  if (!wrap || wrap.classList.contains('hidden')) return;
  const dpr = Math.min(devicePixelRatio, 2);
  const w = ontoCanvas.clientWidth, h = ontoCanvas.clientHeight;
  if (!w || !h) return;
  ontoCanvas.width = w * dpr; ontoCanvas.height = h * dpr;
  const g = ontoCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const pad = 52;
  const P = n => ({ x: pad + n.x * (w - pad * 2), y: 26 + n.y * (h - 60) });
  const byId = Object.fromEntries(ONTOLOGY.nodes.map(n => [n.id, n]));
  const activePath = ONTOLOGY.path.slice(0, ontologyHops);
  const onPath = id => activePath.includes(id);
  const edgeOnPath = (a, b) => {
    const i = activePath.indexOf(a), j = activePath.indexOf(b);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  };

  // edges
  for (const [a, b, lbl] of ONTOLOGY.edges) {
    const pa = P(byId[a]), pb = P(byId[b]);
    const hot = edgeOnPath(a, b);
    g.strokeStyle = hot ? 'rgba(62,224,196,0.95)' : 'rgba(120,145,170,0.22)';
    g.lineWidth = hot ? 2.4 : 1;
    g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
    if (hot) {
      g.fillStyle = 'rgba(62,224,196,0.85)';
      g.font = '9px "Segoe UI", sans-serif';
      g.textAlign = 'center';
      g.fillText(lbl, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 5);
    }
  }
  // nodes
  const kindCol = { entity: '#4e8fd0', asset: '#e0a24a', signal: '#b978d0', rule: '#3ee0c4' };
  for (const n of ONTOLOGY.nodes) {
    const p = P(n);
    const hot = onPath(n.id);
    const rw = Math.min(104, w * 0.24), rh = 30;
    g.fillStyle = hot ? 'rgba(16,32,44,0.98)' : 'rgba(14,20,30,0.85)';
    g.strokeStyle = hot ? kindCol[n.kind] : 'rgba(120,145,170,0.25)';
    g.lineWidth = hot ? 2 : 1;
    g.beginPath(); g.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, 7); g.fill(); g.stroke();
    g.fillStyle = hot ? kindCol[n.kind] : 'rgba(150,175,200,0.6)';
    g.font = '600 10px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.fillText(n.label, p.x, p.y - 2);
    g.fillStyle = hot ? 'rgba(220,235,250,0.85)' : 'rgba(130,155,180,0.45)';
    g.font = '8.5px "Segoe UI", sans-serif';
    g.fillText(n.sub, p.x, p.y + 10);
  }
}

// ---------------------------------------------------------------------------
// Agent console
// ---------------------------------------------------------------------------
const consoleEl = document.getElementById('agent-body');
const navEl = document.getElementById('agent-nav');
let thinkingTimer = null;

function renderNav() {
  navEl.innerHTML = steps.map((s, i) =>
    `<button class="nav-dot ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}" data-i="${i}">
       <span>${i}</span>${s.nav}</button>`).join('');
  navEl.querySelectorAll('.nav-dot').forEach(b => b.onclick = () => gotoStep(+b.dataset.i));
}

function renderStep(animate = true) {
  const s = steps[stepIndex];
  const a = AGENTS[s.agent];
  clearInterval(thinkingTimer);

  const citations = (s.citations || []).map(c => `
    <div class="cite">
      <div class="cite-ico">${c.icon}</div>
      <div class="cite-body">
        <div class="cite-src">${c.src}</div>
        <div class="cite-txt">${c.txt}</div>
        <div class="cite-meta">${c.meta}</div>
      </div>
    </div>`).join('');

  consoleEl.innerHTML = `
    <div class="agent-head">
      <span class="badge ${a.cls}">${a.badge}</span>
      <span class="agent-name">${a.name}</span>
    </div>
    ${s.prompt ? `<div class="prompt"><span class="who">You</span>${s.prompt}</div>` : ''}
    ${s.thinking ? `<div class="thinking" id="thinking"></div>` : ''}
    <div class="answer" id="answer">${s.answer.replace(/\n\n/g, '<br><br>')}</div>
    ${s.bullets ? `<ul class="findings">${s.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
    ${s.recommend ? `<button class="apply-btn" id="apply-rec">Apply recommendation — set line to ${s.recommend.lineRate}%</button>` : ''}
    ${citations ? `<div class="cite-title">Grounding</div>${citations}` : ''}
    ${a.blurb ? `<div class="agent-blurb">${a.blurb}</div>` : ''}
  `;

  const rec = document.getElementById('apply-rec');
  if (rec) rec.onclick = () => {
    params.lineRate = s.recommend.lineRate;
    curveCache = null;
    recompute();
    rec.textContent = `Applied — line at ${s.recommend.lineRate}%`;
    rec.classList.add('done');
  };

  document.getElementById('onto-panel').classList.toggle('hidden', !s.showOntology);
  if (s.showOntology) ontologyHops = animate ? 2 : ONTOLOGY.path.length;

  if (s.thinking && animate) {
    const el = document.getElementById('thinking');
    let i = 0;
    const tick = () => {
      if (i >= s.thinking.length) { clearInterval(thinkingTimer); return; }
      el.innerHTML += `<div class="think-line">${s.thinking[i]}</div>`;
      if (s.showOntology) { ontologyHops = Math.min(ONTOLOGY.path.length, i + 2); drawOntology(); }
      i++;
    };
    tick();
    thinkingTimer = setInterval(tick, 520);
  } else if (s.thinking) {
    document.getElementById('thinking').innerHTML =
      s.thinking.map(t => `<div class="think-line">${t}</div>`).join('');
  }
  if (s.showOntology) requestAnimationFrame(drawOntology);

  document.getElementById('step-title').textContent = s.title;
  document.getElementById('btn-prev').disabled = stepIndex === 0;
  document.getElementById('btn-next').disabled = stepIndex === steps.length - 1;
  renderNav();
}

function gotoStep(i, animate = true) {
  stepIndex = clamp(i, 0, steps.length - 1);
  const s = steps[stepIndex];
  Object.assign(params, s.apply || {});
  if (s.id === 'situation') params.lineRate = 100;
  curveCache = null;
  recompute();
  renderStep(animate);
  if (s.focus) focusStation(s.focus);
  else if (stepIndex === 0) overview();
}

document.getElementById('btn-next').onclick = () => gotoStep(stepIndex + 1);
document.getElementById('btn-prev').onclick = () => gotoStep(stepIndex - 1);
document.getElementById('btn-restart').onclick = () => { params.lineRate = 100; gotoStep(0); };

// ---------------------------------------------------------------------------
// Station drawer
// ---------------------------------------------------------------------------
const drawer = document.getElementById('drawer');
const drawerBody = document.getElementById('drawer-body');

function openDrawer(id) {
  openStation = id;
  renderDrawer();
  drawer.classList.add('open');
  document.body.classList.add('drawer-open');
  focusStation(id);
}
function closeDrawer() {
  drawer.classList.remove('open');
  document.body.classList.remove('drawer-open');
  openStation = null;
}
addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
  if (e.key === 'ArrowRight') gotoStep(stepIndex + 1);
  if (e.key === 'ArrowLeft') gotoStep(stepIndex - 1);
});

function issuesHTML() {
  const issues = result.issues[openStation] || [];
  return issues.length
    ? issues.map(i => `<div class="issue ${i.sev > 0.6 ? 'crit' : ''}">
        ${i.ref ? `<span class="ref">${i.ref}</span>` : ''}${i.text}</div>`).join('')
    : `<div class="issue ok">✓ Running inside its normal operating window.</div>`;
}

function renderDrawer() {
  if (!openStation) return;
  const st = STATIONS.find(s => s.id === openStation);
  const k = result.kpi;
  const util = (result.util[st.id] || 0) * 100;

  drawerBody.innerHTML = `
    <div class="card-head">
      <div>
        <div class="zone">${st.zone} · <b>${st.tag}</b></div>
        <h3>${st.name}</h3>
      </div>
      <button class="btn icon" id="close-drawer">✕</button>
    </div>
    <div class="desc">${st.desc}</div>

    <div class="section-title">Status</div>
    <div id="issue-box">${issuesHTML()}</div>

    <div class="section-title">Parameters <i>— the line responds live</i></div>
    ${st.params.map(p => `
      <div class="param">
        <div class="top"><span>${p.label}</span><b id="v-${p.key}">${(+params[p.key]).toFixed(p.step < 1 ? 1 : 0)}${p.unit ? ' ' + p.unit : ''}</b></div>
        <input type="range" data-key="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${params[p.key]}">
        <div class="scale"><span>${p.min}</span>${p.ok ? `<span class="ok-band">normal ${p.ok[0]}–${p.ok[1]}${p.unit ? ' ' + p.unit : ''}</span>` : '<span></span>'}<span>${p.max}</span></div>
        <div class="note">${p.note}</div>
      </div>`).join('')}

    <div class="section-title">Line impact</div>
    <div class="impact" id="impact-box">
      <div><div class="v info">${util.toFixed(0)}%</div><div class="l">Utilisation</div></div>
      <div><div class="v ${k.coverage >= 100 ? 'good' : 'bad'}">${k.coverage.toFixed(0)}%</div><div class="l">Coverage</div></div>
      <div><div class="v ${cls(k.oee, 65, 50, true)}">${k.oee.toFixed(0)}%</div><div class="l">OEE</div></div>
    </div>

    <div class="section-title">Materials</div>
    <div class="supplies">${st.supplies.map(s => `<span class="chip">${s}</span>`).join('')}</div>
  `;

  document.getElementById('close-drawer').onclick = closeDrawer;
  drawerBody.querySelectorAll('input[type=range]').forEach(inp => {
    inp.oninput = () => {
      const key = inp.dataset.key;
      const def = st.params.find(p => p.key === key);
      params[key] = parseFloat(inp.value);
      document.getElementById('v-' + key).textContent =
        params[key].toFixed(def.step < 1 ? 1 : 0) + (def.unit ? ' ' + def.unit : '');
      curveCache = null;
      recompute(true);
    };
  });
}

// ---------------------------------------------------------------------------
function recompute(partial = false) {
  result = simulate(params);
  applyHealth();
  renderKPIs();
  renderConsumables();
  drawTimeline();
  drawCurve();
  if (openStation) {
    const ib = document.getElementById('issue-box');
    if (ib) ib.innerHTML = issuesHTML();
    if (!partial) renderDrawer();
  }
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
function focusStation(id) {
  const p = STATIONS.find(s => s.id === id).pos;
  flyTo(new THREE.Vector3(p[0], 2, p[2]), new THREE.Vector3(p[0] - 6, 34, p[2] + 44), 1200);
}
function overview() {
  flyTo(new THREE.Vector3(2, 2, -3), new THREE.Vector3(0, 56, 70), 1200);
}
document.getElementById('btn-overview').onclick = () => { closeDrawer(); overview(); };

// line speed slider in the control strip
const rateSlider = document.getElementById('rate-slider');
rateSlider.oninput = () => {
  params.lineRate = +rateSlider.value;
  curveCache = null;
  recompute();
};

const qualityBtn = document.getElementById('btn-quality');
qualityBtn.onclick = () => {
  quality = quality === 'high' ? 'fast' : 'high';
  const high = quality === 'high';
  bloom.enabled = high;
  renderer.shadowMap.enabled = high;
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.8) : 1);
  qualityBtn.textContent = high ? 'Quality: high' : 'Quality: fast';
  resize();
};

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const k = result.kpi;
  const speed = params.lineRate / 100;
  const risk = clamp(k.gap < 0 ? 1 : 0, 0, 1);

  // bulk flow pucks
  for (let i = 0; i < pucks.length; i++) {
    const p = pucks[i];
    const u = (t * 0.035 * (0.4 + speed) + i / pucks.length) % 1;
    curve.getPointAt(u, tmp);
    p.position.set(tmp.x, tmp.y + 0.3, tmp.z);
    p.material.color.setRGB(0.14 + risk * 0.7, 0.46 - risk * 0.26, 0.4 - risk * 0.3);
  }

  for (const st of STATIONS) {
    const s = stations[st.id];
    const h = s.targetH || 0;
    const d = s.group.userData;

    if (d.spinY) d.spinY.rotation.y += dt * (2 + (result.util[st.id] || 0) * 5);
    if (d.carousel) d.carousel.rotation.y += dt * speed * 1.9;
    if (d.drive) d.drive.rotation.x += dt * speed * 9;
    if (d.heads) d.heads.rotation.y += dt * speed * 2.4;
    if (d.reel) d.reel.rotation.z -= dt * speed * 2.2;
    if (d.wrap) d.wrap.rotation.y += dt * 1.4;
    if (d.robot) d.robot.rotation.y = Math.sin(t * 0.8 * speed) * 0.7;
    if (d.cartons) d.cartons.position.x = (t * speed * 0.55) % 0.8;
    // vibration on the constraint asset — visibly shakes above the knee
    if (d.sensor) {
      const amp = Math.max(0, (k.vibration - 4.5)) * 0.012;
      d.sensor.position.x = -2.4 + Math.sin(t * 42) * amp;
      d.sensor.position.y = 1.6 + Math.cos(t * 37) * amp;
    }
    if (d.andon) {
      const lamps = d.andon.children;
      const state = k.gap < 0 || h > 0.6 ? 2 : h > 0.2 ? 1 : 0;
      const on = [[0x35c48a, 0x3a3520, 0x3a2424], [0x2a3a2a, 0xe0a24a, 0x3a2424], [0x2a3a2a, 0x3a3520, 0xe05050]][state];
      const blink = state === 2 ? (Math.sin(t * 5) > -0.2 ? 1 : 0.25) : 1;
      lamps.forEach((l, i) => {
        l.material.color.setHex(on[i]);
        l.material.opacity = (i === state ? blink : 1);
        l.material.transparent = true;
      });
    }
    if (d.convs) {
      for (const c of d.convs) {
        const b = c.userData.bottles;
        if (b) b.position.x = (t * speed * 1.4) % c.userData.pitch;
      }
    }

    // Labels are billboards with a fixed world size, so they swell when the
    // camera closes in. Scale them down with proximity to keep them legible
    // without letting them dominate the frame.
    const dist = camera.position.distanceTo(s.group.position);
    const k2 = clamp(dist / 90, 0.42, 1);
    s.label.scale.set(8.4 * k2, 2.15 * k2, 1);

    // exception-based status lamps
    const alarm = h > 0.02;
    const attention = alarm ? h : (hovered === st.id || openStation === st.id ? 0.4 : 0);
    if (attention < 0.001) {
      if (s.lit !== false) {
        s.beacon.material.color.setHex(0x222b36);
        s.beacon.scale.setScalar(0.5);
        s.glow.intensity = 0;
        s.halo.visible = false; s.inner.visible = false;
        s.lit = false;
      }
    } else {
      s.lit = true; s.halo.visible = true;
      const pulse = alarm ? 0.5 + 0.5 * Math.sin(t * (1.8 + h * 9)) : 1;
      s.beacon.material.color.copy(s.color);
      s.beacon.scale.setScalar(alarm ? 0.55 + h * 0.45 * (0.7 + 0.3 * pulse) : 0.8);
      s.glow.intensity = alarm ? h * 5.5 * (0.45 + 0.55 * pulse) : 1.0;
      s.halo.material.opacity = alarm ? (0.16 + h * 0.5) * (0.65 + 0.35 * pulse) : 0.55;
      s.inner.visible = alarm;
      if (alarm) s.inner.material.opacity = h * 0.12 * (0.6 + 0.4 * pulse);
    }
    const wantEmiss = alarm ? h * 0.75 : (attention > 0 ? 0.3 : 0);
    if (s.emiss !== wantEmiss) {
      for (const m of s.tintMats) { m.emissive.copy(s.color); m.emissiveIntensity = wantEmiss; }
      s.emiss = wantEmiss;
    }
  }

  controls.update();
  camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  for (const w of walls) {
    const dd = tmp.copy(w.position).sub(controls.target).dot(fwd);
    const want = dd < -1.5 ? w.userData.wall.fade : w.userData.wall.solid;
    if (w.material !== want) w.material = want;
  }
  const showCeiling = camera.position.distanceTo(controls.target) < 50;
  for (const c of ceiling) if (c.visible !== showCeiling) c.visible = showCeiling;

  (bloom.enabled ? composer : renderer).render(scene, camera);
}

// ---------------------------------------------------------------------------
document.getElementById('product-pill').textContent = `${PRODUCT.name} · ${PRODUCT.pack}`;
gotoStep(0, false);
tick();
setTimeout(() => { drawTimeline(); drawCurve(); }, 60);

window.__ops = {
  params, simulate, planAt, damageFactor,
  get result() { return result; },
  get step() { return stepIndex; },
  steps: () => steps.map(s => ({ id: s.id, agent: s.agent, title: s.title })),
  goto: i => gotoStep(i, false),
  setRate: r => { params.lineRate = r; curveCache = null; recompute(); },
  stationIds: STATIONS.map(s => s.id),
  open: openDrawer,
  kpis: () => ({ ...result.kpi }),
  project(id) {
    const s = stations[id];
    if (!s) return null;
    let best = null, bestVol = -1;
    const bb = new THREE.Box3(), sz = new THREE.Vector3();
    s.group.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const ty = o.geometry.type;
      if (ty === 'RingGeometry' || ty === 'CircleGeometry') return;
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
