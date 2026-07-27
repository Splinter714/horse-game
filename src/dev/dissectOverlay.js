// Dev-only live dissect overlay: interactive part breakdown in-browser.
// - globalThis.__dissect.show(key) opens the overlay for any texture key
// - Click a panel to drill into its sub-parts (▸ suffix = drillable)
// - Click the key/part segments in the header to navigate back up
// - Docked as a fixed RIGHT sidebar; panels stack vertically and scroll; × to close
// - Re-renders automatically on every 'artLayersUpdated' event (hot-reload)
// Activated from ArtPreviewScene animal clicks, or with ?dissect=horse&part=mane.

import { swallowDomInput } from './swallowDomInput.js';

// Docked as a fixed right sidebar (#193). It fires a `dissectDockChanged` window event with
// its width on open and 0 on close; ArtPreviewScene listens to reserve matching gallery
// space so the dock never covers the cards. (Outside the gallery — e.g. ?dissect= on the
// real game — nothing listens and it just docks over the right edge.)
const DOCK_W = 300;
const fireDock = (width) => window.dispatchEvent(new CustomEvent('dissectDockChanged', { detail: { width } }));

const CODE = ['#e0907a', '#7fb5e8', '#86c98e', '#e8c66b', '#b79be0', '#e69bbf', '#8fd3c4', '#d99a6c'];
const hex  = (n) => '#' + (n >>> 0 & 0xffffff).toString(16).padStart(6, '0');
const bbox = (o) => o.t === 'rect'    ? [o.x, o.y, o.x+o.w, o.y+o.h]
  : o.t === 'circle'  ? [o.x-o.r, o.y-o.r, o.x+o.r, o.y+o.r]
  : o.t === 'ellipse' ? [o.x-o.w/2, o.y-o.h/2, o.x+o.w/2, o.y+o.h/2]
  : o.t === 'tri'     ? [Math.min(o.pts[0],o.pts[2],o.pts[4]), Math.min(o.pts[1],o.pts[3],o.pts[5]),
                         Math.max(o.pts[0],o.pts[2],o.pts[4]), Math.max(o.pts[1],o.pts[3],o.pts[5])]
  : [Math.min(...o.points.map(p=>p.x)), Math.min(...o.points.map(p=>p.y)),
     Math.max(...o.points.map(p=>p.x)), Math.max(...o.points.map(p=>p.y))];

// State: key = texture base key, crumb = stack of parent parts (null = top level).
// poses = [{ pose, frames }] discovered by ArtPreviewScene for the current key (for
// the animation picker); activePose = which pose's frames drive the dissected frame
// AND the little live-preview canvas; playing = whether the preview canvas cycles
// through activePose's frames on a timer (vs. showing a single static frame).
const state = { key: null, crumb: [], poses: [], activePose: null, playing: false };
let wrap, breadcrumbEl, panelsEl, posesEl, previewCv, previewCtx;
let SCALE = 3;        // working scale, recomputed per render to fit the dock width
let MAX_SCALE = 3;    // upper bound (overridable with ?scale=)
let playTimer = null, playFrameIdx = 0;

export function setupDissectOverlay() {
  const params = new URLSearchParams(location.search);
  MAX_SCALE = Number(params.get('scale') || 3);

  // ── outer wrapper: docked RIGHT sidebar, full height ──────────────────────
  wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed', top: '0', right: '0', bottom: '0', width: DOCK_W + 'px', zIndex: '9999',
    fontFamily: 'monospace', fontSize: '12px', background: '#1e2026',
    boxShadow: '-2px 0 16px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column',
  });

  // ── header row (pinned; panels scroll below it) ───────────────────────────
  const headerRow = document.createElement('div');
  Object.assign(headerRow.style, {
    background: '#1e2026', color: '#9ba3b0', padding: '7px 8px',
    userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: '0',
  });

  breadcrumbEl = document.createElement('span');
  breadcrumbEl.style.flex = '1';
  headerRow.appendChild(breadcrumbEl);

  // × at the top-right of the dock. A wide hit target so it's easy to land on.
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, { cursor: 'pointer', opacity: '0.6', padding: '0 7px', fontSize: '16px', flexShrink: '0' });
  closeBtn.addEventListener('click', () => { stopPlaying(); state.key = null; state.crumb = []; state.poses = []; state.activePose = null; idle(); });
  headerRow.appendChild(closeBtn);

  // ── animation/pose picker row (pinned, below the header) ──────────────────
  // One button per pose this creature has frames for (idle/walk/eat/roll/wallow/
  // swim/lay/sleep/nap/pounce/crow/spit/fly/run/…) — discovered structurally by
  // ArtPreviewScene (_posesFor), never hardcoded here. Picking a pose both (a)
  // switches which frame the static panels below dissect, and (b) drives a small
  // live-preview canvas that can play through that pose's frames on a timer.
  posesEl = document.createElement('div');
  Object.assign(posesEl.style, {
    display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '6px 8px',
    background: '#25282f', borderTop: '1px solid #3a3d45', borderBottom: '1px solid #3a3d45',
    flexShrink: '0',
  });
  posesEl.style.display = 'none'; // hidden until a creature with discovered poses is shown

  wrap.append(headerRow, posesEl);

  // ── panels column (stack vertically, scroll vertically) ───────────────────
  panelsEl = document.createElement('div');
  Object.assign(panelsEl.style, {
    display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px',
    overflow: 'auto', background: '#1e2026',
    flex: '1', minHeight: '0',
  });

  wrap.append(panelsEl);
  document.body.appendChild(wrap);

  // Block clicks/drags from reaching Phaser's input (which fires on window for events not
  // targeting the canvas) — otherwise interacting with the overlay dissects/customises the
  // sprite behind it. Phaser uses mouse/touch, not pointer, events; see swallowDomInput.
  swallowDomInput(wrap);

  // re-render on texture rebuild
  window.addEventListener('artLayersUpdated', () => { if (state.key) render(); });

  globalThis.__dissect = {
    // crumb stores the navigation stack; last element = current part (null = top level)
    show(key, part = null) {
      stopPlaying();
      state.key = key;
      state.crumb = part == null ? [] : [part];
      state.poses = [];
      state.activePose = null;
      render();
    },
    // Called by ArtPreviewScene right after show() with this creature's discovered
    // poses ([{ pose, frames }]) so the picker row can render. Optional — dissecting
    // via the ?dissect= URL param (no gallery, no ArtPreviewScene) just won't show one.
    setPoses(key, poses) {
      if (key !== state.key) return; // stale call from a since-replaced selection
      state.poses = poses;
      state.activePose = poses.find((p) => p.pose === 'idle') ?? poses[0] ?? null;
      renderPoses();
      renderPreview();
    },
  };

  // URL param initial state
  const initKey = params.get('dissect');
  if (initKey) globalThis.__dissect.show(initKey, params.get('part') || null);
  else idle();
}

function idle() {
  stopPlaying();
  wrap.style.display = 'none';
  breadcrumbEl.innerHTML = '<span style="opacity:0.4">click an animal to dissect</span>';
  panelsEl.innerHTML = '';
  posesEl.innerHTML = '';
  posesEl.style.display = 'none';
  fireDock(0); // tell the gallery to reclaim the reserved space
}

// ── Main render ─────────────────────────────────────────────────────────────
function render() {
  wrap.style.display = 'flex';
  fireDock(DOCK_W); // gallery reserves matching left space so the dock doesn't cover cards
  const rawKey = state.key;
  const part   = state.crumb.length ? state.crumb[state.crumb.length - 1] : null;

  const reg = globalThis.__artLayers || {};
  // The pose picker's active pose (if any) pins the dissected frame to its current
  // playback frame (playFrameIdx) — so switching poses, or letting one play, updates
  // what's being dissected below, not just the little preview canvas. Falls back to
  // the bare key, then common first-frame suffixes (idle_0, fly_0, _0) when no pose
  // has been discovered yet (e.g. dissecting via the ?dissect= URL param, no gallery).
  const poseFrame = state.activePose?.frames?.[playFrameIdx % (state.activePose.frames.length || 1)];
  const key = [poseFrame, rawKey, `${rawKey}_idle_0`, `${rawKey}_fly_0`, `${rawKey}_0`].find(k => k && reg[k]) ?? null;
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
  // Union across EVERY frame of the active pose (not just the one currently
  // showing), so the panel boxes stay a fixed size while an animation plays —
  // otherwise a pose whose frames have different extents (legs out vs. tucked
  // in, say) resized the boxes every frame, which read as jostling (2026-07-27).
  // Falls back to just this frame's own ops when there's no active pose to span
  // (e.g. dissecting via the ?dissect= URL param with no gallery/pose picker).
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const framesToSpan = state.activePose?.frames?.length ? state.activePose.frames : [key];
  for (const frameKey of framesToSpan) {
    const frameData = reg[frameKey];
    if (!frameData) continue;
    const frameScoped = part
      ? frameData.ops.filter((o) => o.layer === part || o.layer.startsWith(`${part}.`))
      : frameData.ops;
    for (const o of frameScoped) { const b = bbox(o); x0=Math.min(x0,b[0]); y0=Math.min(y0,b[1]); x1=Math.max(x1,b[2]); y1=Math.max(y1,b[3]); }
  }
  // Auto-fit each panel to the dock width (ops are super-sampled, so a fixed scale would
  // overflow the column). Cap at MAX_SCALE so small/drilled-in parts don't blow up.
  SCALE = Math.min(MAX_SCALE, (DOCK_W - 30) / Math.max(1, (x1 - x0) + 10));
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

  renderPoses();
  renderPreview();
}

// ── Animation/pose picker ───────────────────────────────────────────────────
// One button per discovered pose (idle/walk/eat/roll/wallow/swim/lay/sleep/nap/
// pounce/crow/spit/…), plus a live-preview canvas + a play/pause toggle so the
// owner can actually see the animation cycle, not just one static dissected frame.
function renderPoses() {
  posesEl.innerHTML = '';
  if (!state.poses.length) { posesEl.style.display = 'none'; return; }
  posesEl.style.display = 'flex';

  for (const p of state.poses) {
    const btn = document.createElement('button');
    btn.textContent = `${p.pose} (${p.frames.length})`;
    const active = state.activePose === p;
    Object.assign(btn.style, {
      font: '11px monospace', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer',
      background: active ? '#4a7fd8' : '#33363e', color: active ? '#fff' : '#cfd3da',
      border: '1px solid ' + (active ? '#6a9bee' : '#454852'),
    });
    btn.addEventListener('click', () => {
      // Switching pose keeps play/pause as-is (2026-07-27) — if it was playing,
      // it keeps playing the new pose; if paused, it stays paused on frame 0 of
      // the new pose. Only reset the frame index (a pose with fewer frames than
      // the previous one could otherwise leave playFrameIdx out of range).
      state.activePose = p;
      playFrameIdx = 0;
      renderPoses(); // refresh the play button's enabled state/label for the new pose's frame count
      render();
    });
    posesEl.appendChild(btn);
  }

  // Play/pause the active pose's frames in the little preview canvas (and, since
  // render() pins the dissected frame to playFrameIdx, in the panels below too).
  const playBtn = document.createElement('button');
  const framesN = state.activePose?.frames?.length ?? 0;
  playBtn.textContent = state.playing ? '⏸ pause' : '▶ play';
  playBtn.disabled = framesN < 2;
  Object.assign(playBtn.style, {
    font: '11px monospace', padding: '3px 7px', borderRadius: '4px',
    cursor: playBtn.disabled ? 'default' : 'pointer', marginLeft: 'auto',
    background: '#33363e', color: playBtn.disabled ? '#6a6d75' : '#cfd3da', border: '1px solid #454852',
  });
  playBtn.addEventListener('click', () => { state.playing ? stopPlaying() : startPlaying(); renderPoses(); });
  posesEl.appendChild(playBtn);

  if (!previewCv) {
    previewCv = document.createElement('canvas');
    Object.assign(previewCv.style, { display: 'block', imageRendering: 'pixelated', marginLeft: '6px', flexShrink: '0' });
    previewCtx = previewCv.getContext('2d');
    previewCtx.imageSmoothingEnabled = false;
  }
  posesEl.appendChild(previewCv);
}

function renderPreview() {
  if (!previewCv || !state.activePose) return;
  const frameKey = state.activePose.frames[playFrameIdx % state.activePose.frames.length];
  const tex = globalThis.__game?.textures?.get(frameKey);
  const img = tex?.getSourceImage?.();
  if (!img) return;
  // Fit to the dock width like the per-part panels below do (a fixed 4x scale
  // clipped wide sprites, e.g. the duck, since the dock itself is only DOCK_W wide).
  const maxW = DOCK_W - 12;
  const PREVIEW_SCALE = Math.max(1, Math.min(4, maxW / img.width));
  previewCv.width = img.width * PREVIEW_SCALE;
  previewCv.height = img.height * PREVIEW_SCALE;
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, previewCv.width, previewCv.height);
  previewCtx.drawImage(img, 0, 0, previewCv.width, previewCv.height);
}

function startPlaying() {
  if (!state.activePose || state.activePose.frames.length < 2) return;
  state.playing = true;
  playTimer = setInterval(() => {
    playFrameIdx = (playFrameIdx + 1) % state.activePose.frames.length;
    renderPreview();
    render(); // keep the dissected panels in step with the playing pose
  }, 160);
}

function stopPlaying() {
  state.playing = false;
  playFrameIdx = 0;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
}
