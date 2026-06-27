// Dev-only live dissect overlay: interactive part breakdown in-browser.
// - globalThis.__dissect.show(key) opens the overlay for any texture key
// - Click a panel to drill into its sub-parts (▸ suffix = drillable)
// - Click the key/part segments in the header to navigate back up
// - Draggable via the ⠿ handle; × to close
// - Re-renders automatically on every 'artLayersUpdated' event (hot-reload)
// Activated from ArtPreviewScene animal clicks, or with ?dissect=horse&part=mane.

import { swallowDomInput } from './swallowDomInput.js';

const CODE = ['#e0907a', '#7fb5e8', '#86c98e', '#e8c66b', '#b79be0', '#e69bbf', '#8fd3c4', '#d99a6c'];
const hex  = (n) => '#' + (n >>> 0 & 0xffffff).toString(16).padStart(6, '0');
const bbox = (o) => o.t === 'rect'    ? [o.x, o.y, o.x+o.w, o.y+o.h]
  : o.t === 'circle'  ? [o.x-o.r, o.y-o.r, o.x+o.r, o.y+o.r]
  : o.t === 'ellipse' ? [o.x-o.w/2, o.y-o.h/2, o.x+o.w/2, o.y+o.h/2]
  : o.t === 'tri'     ? [Math.min(o.pts[0],o.pts[2],o.pts[4]), Math.min(o.pts[1],o.pts[3],o.pts[5]),
                         Math.max(o.pts[0],o.pts[2],o.pts[4]), Math.max(o.pts[1],o.pts[3],o.pts[5])]
  : [Math.min(...o.points.map(p=>p.x)), Math.min(...o.points.map(p=>p.y)),
     Math.max(...o.points.map(p=>p.x)), Math.max(...o.points.map(p=>p.y))];

// State: key = texture base key, crumb = stack of parent parts (null = top level)
const state = { key: null, crumb: [] };
let wrap, handle, breadcrumbEl, panelsEl;
let SCALE = 3;

export function setupDissectOverlay() {
  const params = new URLSearchParams(location.search);
  SCALE = Number(params.get('scale') || 3);

  // ── outer wrapper ─────────────────────────────────────────────────────────
  wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed', top: '8px', left: '8px', zIndex: '9999',
    fontFamily: 'monospace', fontSize: '12px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.7)', borderRadius: '6px', overflow: 'hidden',
    maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)',
    display: 'flex', flexDirection: 'column',
  });

  // ── header row ───────────────────────────────────────────────────────────
  const headerRow = document.createElement('div');
  Object.assign(headerRow.style, {
    background: '#1e2026', color: '#9ba3b0', padding: '5px 8px',
    userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '180px',
  });

  handle = document.createElement('span');
  handle.textContent = '⠿';
  Object.assign(handle.style, { cursor: 'grab', opacity: '0.4', flexShrink: '0', padding: '0 2px' });
  headerRow.appendChild(handle);

  // Close at the LEFT of the header (next to the grip). The overlay is anchored top-left
  // and grows rightward with its panels, so a right-aligned × drifts under the Art-Preview
  // "Back to Farm" button at the top-right — aiming for it kept closing the whole gallery.
  // A wider hit target, too, so it's easy to land on.
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, { cursor: 'pointer', opacity: '0.6', padding: '0 7px', fontSize: '16px', flexShrink: '0' });
  closeBtn.addEventListener('click', () => { state.key = null; state.crumb = []; idle(); });
  headerRow.appendChild(closeBtn);

  breadcrumbEl = document.createElement('span');
  breadcrumbEl.style.flex = '1';
  headerRow.appendChild(breadcrumbEl);

  // ── panels row ───────────────────────────────────────────────────────────
  panelsEl = document.createElement('div');
  Object.assign(panelsEl.style, {
    display: 'flex', flexDirection: 'row',
    overflow: 'auto', background: '#1e2026',
    flex: '1', minHeight: '0',
  });

  wrap.append(headerRow, panelsEl);
  document.body.appendChild(wrap);

  // Block clicks/drags from reaching Phaser's input (which fires on window for events not
  // targeting the canvas) — otherwise interacting with the overlay dissects/customises the
  // sprite behind it. Phaser uses mouse/touch, not pointer, events; see swallowDomInput.
  swallowDomInput(wrap);

  // drag via handle
  let drag = null;
  handle.addEventListener('pointerdown', (e) => {
    const r = wrap.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    handle.setPointerCapture(e.pointerId);
    handle.style.cursor = 'grabbing';
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    wrap.style.left = (e.clientX - drag.dx) + 'px';
    wrap.style.top  = (e.clientY - drag.dy) + 'px';
  });
  handle.addEventListener('pointerup', () => { drag = null; handle.style.cursor = 'grab'; });

  // re-render on texture rebuild
  window.addEventListener('artLayersUpdated', () => { if (state.key) render(); });

  globalThis.__dissect = {
    // crumb stores the navigation stack; last element = current part (null = top level)
    show(key, part = null) {
      state.key = key;
      state.crumb = part == null ? [] : [part];
      render();
    },
  };

  // URL param initial state
  const initKey = params.get('dissect');
  if (initKey) globalThis.__dissect.show(initKey, params.get('part') || null);
  else idle();
}

function idle() {
  wrap.style.display = 'none';
  breadcrumbEl.innerHTML = '<span style="opacity:0.4">click an animal to dissect</span>';
  panelsEl.innerHTML = '';
}

// ── Main render ─────────────────────────────────────────────────────────────
function render() {
  wrap.style.display = 'flex';
  const rawKey = state.key;
  const part   = state.crumb.length ? state.crumb[state.crumb.length - 1] : null;

  const reg = globalThis.__artLayers || {};
  const key = reg[rawKey] ? rawKey : (reg[`${rawKey}_idle_0`] ? `${rawKey}_idle_0` : null);
  if (!key) { breadcrumbEl.textContent = `no layers for "${rawKey}"`; panelsEl.innerHTML = ''; return; }

  const data = reg[key];
  const topOf   = (l) => l.split('.')[0];
  const scoped  = part ? data.ops.filter((o) => o.layer === part || o.layer.startsWith(`${part}.`)) : data.ops;
  const labelOf = part ? ((o) => o.layer) : ((o) => topOf(o.layer));
  const groups  = [...new Set(scoped.map(labelOf))];
  const colorOf = (g) => CODE[groups.indexOf(g) % CODE.length];
  const hasSubs = (g) => data.ops.some((o) => o.layer.startsWith(g + '.'));

  // ── breadcrumb ────────────────────────────────────────────────────────────
  breadcrumbEl.innerHTML = '';
  // Each segment in state.crumb is a part value (null = top level).
  // We display: key [> part0 [> part1 …]] and every non-last segment is clickable.
  const segments = [null, ...state.crumb]; // null = key root
  segments.forEach((seg, i) => {
    if (i > 0) breadcrumbEl.append(Object.assign(document.createElement('span'), { textContent: ' › ', style: 'opacity:0.4' }));
    const label = seg === null ? rawKey : seg;
    const isLast = i === segments.length - 1;
    if (isLast) {
      breadcrumbEl.append(Object.assign(document.createElement('span'), { textContent: label, style: 'color:#cfd3da' }));
    } else {
      const btn = Object.assign(document.createElement('span'), { textContent: label });
      Object.assign(btn.style, { cursor: 'pointer', opacity: '0.6', textDecoration: 'underline' });
      const targetDepth = i; // clicking segment i navigates to that depth
      btn.addEventListener('click', () => { state.crumb = state.crumb.slice(0, targetDepth); render(); });
      breadcrumbEl.appendChild(btn);
    }
  });

  // ── bounding box ─────────────────────────────────────────────────────────
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of scoped) { const b = bbox(o); x0=Math.min(x0,b[0]); y0=Math.min(y0,b[1]); x1=Math.max(x1,b[2]); y1=Math.max(y1,b[3]); }
  const pad = Math.round(5 * SCALE), lh = 18;
  const cw  = Math.ceil((x1-x0)*SCALE) + pad*2;
  const ch  = Math.ceil((y1-y0)*SCALE) + pad*2 + lh;

  // ── panels ────────────────────────────────────────────────────────────────
  panelsEl.innerHTML = '';

  function drawOp(ctx, o, override, alpha) {
    const mx = (x) => pad + (x-x0)*SCALE, my = (y) => pad + (y-y0)*SCALE;
    ctx.fillStyle   = override || hex(o.color);
    ctx.globalAlpha = alpha ?? o.alpha;
    if      (o.t==='rect')    ctx.fillRect(mx(o.x), my(o.y), Math.max(1,o.w*SCALE), Math.max(1,o.h*SCALE));
    else if (o.t==='circle')  { ctx.beginPath(); ctx.arc(mx(o.x),my(o.y),o.r*SCALE,0,Math.PI*2); ctx.fill(); }
    else if (o.t==='ellipse') { ctx.beginPath(); ctx.ellipse(mx(o.x),my(o.y),o.w/2*SCALE,o.h/2*SCALE,0,0,Math.PI*2); ctx.fill(); }
    else if (o.t==='tri')     { ctx.beginPath(); ctx.moveTo(mx(o.pts[0]),my(o.pts[1])); ctx.lineTo(mx(o.pts[2]),my(o.pts[3])); ctx.lineTo(mx(o.pts[4]),my(o.pts[5])); ctx.fill(); }
    else { ctx.beginPath(); o.points.forEach((p,i)=>i?ctx.lineTo(mx(p.x),my(p.y)):ctx.moveTo(mx(p.x),my(p.y))); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  const allPanels = [...groups, '= overlaid', '◆ colour'];

  for (const name of allPanels) {
    const isAll   = name === '= overlaid';
    const isCoded = name === '◆ colour';
    const drillable = !isAll && !isCoded && hasSubs(name);

    const cv  = document.createElement('canvas');
    cv.width  = cw; cv.height = ch;
    Object.assign(cv.style, { display: 'block', imageRendering: 'pixelated', flexShrink: '0' });
    if (drillable) { cv.style.cursor = 'pointer'; cv.title = `drill into ${name}`; }

    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1e2026'; ctx.fillRect(0, 0, cw, ch);

    // ghost of the whole scope
    if (!isAll && !isCoded) for (const o of scoped) drawOp(ctx, o, '#8a8f98', 0.12);

    // content
    for (const o of scoped) {
      const g = labelOf(o);
      if      (isAll)   drawOp(ctx, o);
      else if (isCoded) drawOp(ctx, o, colorOf(g), Math.max(0.55, o.alpha));
      else if (g===name) drawOp(ctx, o);
    }

    // label + border
    ctx.fillStyle  = isCoded || isAll ? '#cfd3da' : colorOf(name);
    ctx.font       = '11px monospace';
    ctx.fillText(drillable ? name + ' ▸' : name, 5, ch - lh/2 + 4);
    ctx.strokeStyle = drillable ? colorOf(name) : '#3a3d45';
    ctx.lineWidth   = drillable ? 1.5 : 1;
    ctx.strokeRect(0.5, 0.5, cw-1, ch-1);

    if (drillable) {
      cv.addEventListener('click', () => { state.crumb = [...state.crumb, name]; render(); });
    }

    panelsEl.appendChild(cv);
  }
}
