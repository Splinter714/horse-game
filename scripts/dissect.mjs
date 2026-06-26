// Dev tool: dissect a procedural sprite into its named parts and render them side by
// side + overlaid, so you can study (and art-direct) one piece at a time — the leg, the
// mane, the tail, etc. Reuses the REAL art code: in dev, every texture build also runs
// the draw fn through a recording graphics that tags each fill with the current
// `g.layer('name')` (see src/art/_frames.js), exposed on window.__artLayers. So the
// parts here are exactly what the art draws — nothing is re-implemented.
//
// Usage: start the dev server (npm run dev), then:
//   npm run dissect horse                 (whole horse, grouped by top-level part)
//   npm run dissect horse mane            (zoom into the mane's sub-parts)
//   npm run dissect horse_walk_1 legs     (any frame + any part)
//   SPRITE_SCALE=3 DISSECT_OUT=/tmp/x.png npm run dissect horse tail
//
// A bare creature key (e.g. `horse`) resolves to its `_idle_0` frame. Pass a second arg
// to drill into one part (its dotted sub-layers are shown instead of the top level).

import { chromium } from 'playwright';
import { resolveDevServerUrl } from './dev-server-url.mjs';

const [rawKey, part] = process.argv.slice(2).filter((a) => a !== '--');
if (!rawKey) {
  console.error('usage: npm run dissect <textureKey> [part]   e.g. npm run dissect horse mane');
  process.exit(1);
}
const SCALE = Number(process.env.SPRITE_SCALE || 3);
const OUT   = process.env.DISSECT_OUT || '/tmp/art-dissect.png';
const URL   = await resolveDevServerUrl();

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__game?.scene?.isActive('PaddockScene') && window.__artLayers, { timeout: 20000 });

  const result = await page.evaluate(({ rawKey, part, SCALE }) => {
    const reg = window.__artLayers || {};
    const key = reg[rawKey] ? rawKey : (reg[`${rawKey}_idle_0`] ? `${rawKey}_idle_0` : null);
    if (!key) return { error: `no captured layers for "${rawKey}"`, keys: Object.keys(reg).sort().slice(0, 60) };
    const data = reg[key];
    const top = (l) => l.split('.')[0];

    let scoped = data.ops, labelOf;
    if (part) { scoped = data.ops.filter((o) => o.layer === part || o.layer.startsWith(`${part}.`)); labelOf = (o) => o.layer; }
    else labelOf = (o) => top(o.layer);
    if (!scoped.length) return { error: `part "${part}" not found in ${key}`, parts: [...new Set(data.ops.map((o) => top(o.layer)))] };

    const groups = [];
    for (const o of scoped) { const g = labelOf(o); if (!groups.includes(g)) groups.push(g); }

    const ext = (o) => o.t === 'rect' ? [o.x, o.y, o.x + o.w, o.y + o.h]
      : o.t === 'circle' ? [o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r]
      : o.t === 'ellipse' ? [o.x - o.w / 2, o.y - o.h / 2, o.x + o.w / 2, o.y + o.h / 2]
      : o.t === 'tri' ? [Math.min(o.pts[0], o.pts[2], o.pts[4]), Math.min(o.pts[1], o.pts[3], o.pts[5]), Math.max(o.pts[0], o.pts[2], o.pts[4]), Math.max(o.pts[1], o.pts[3], o.pts[5])]
      : [Math.min(...o.points.map((p) => p.x)), Math.min(...o.points.map((p) => p.y)), Math.max(...o.points.map((p) => p.x)), Math.max(...o.points.map((p) => p.y))];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of scoped) { const e = ext(o); x0 = Math.min(x0, e[0]); y0 = Math.min(y0, e[1]); x1 = Math.max(x1, e[2]); y1 = Math.max(y1, e[3]); }
    const pad = Math.round(6 * SCALE), label = 22, title = 30;
    const cw = Math.ceil((x1 - x0) * SCALE) + pad * 2;
    const ch = Math.ceil((y1 - y0) * SCALE) + pad * 2 + label;
    const panels = [...groups, '= overlaid', '◆ colour-coded'];
    const cols = panels.length;
    const CODE = ['#e0907a', '#7fb5e8', '#86c98e', '#e8c66b', '#b79be0', '#e69bbf', '#8fd3c4', '#d99a6c'];
    const colorOf = (g) => CODE[groups.indexOf(g) % CODE.length];

    const cv = document.createElement('canvas');
    cv.width = cw * cols; cv.height = ch + title;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#23252b'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '13px monospace'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cfd3da';
    ctx.fillText(`${key}${part ? '  ·  ' + part : ''}   (${groups.length} parts, ${scoped.length} ops)`, 8, title / 2);

    const hex = (n) => '#' + (n >>> 0 & 0xffffff).toString(16).padStart(6, '0');
    const drawOp = (ox, oy, o, override, alpha) => {
      const mx = (x) => ox + pad + (x - x0) * SCALE, my = (y) => oy + pad + (y - y0) * SCALE;
      ctx.fillStyle = override || hex(o.color);
      ctx.globalAlpha = alpha != null ? alpha : o.alpha;
      if (o.t === 'rect') ctx.fillRect(mx(o.x), my(o.y), Math.max(1, o.w * SCALE), Math.max(1, o.h * SCALE));
      else if (o.t === 'circle') { ctx.beginPath(); ctx.arc(mx(o.x), my(o.y), o.r * SCALE, 0, 7); ctx.fill(); }
      else if (o.t === 'ellipse') { ctx.beginPath(); ctx.ellipse(mx(o.x), my(o.y), o.w / 2 * SCALE, o.h / 2 * SCALE, 0, 0, 7); ctx.fill(); }
      else if (o.t === 'tri') { ctx.beginPath(); ctx.moveTo(mx(o.pts[0]), my(o.pts[1])); ctx.lineTo(mx(o.pts[2]), my(o.pts[3])); ctx.lineTo(mx(o.pts[4]), my(o.pts[5])); ctx.fill(); }
      else { ctx.beginPath(); o.points.forEach((p, i) => i ? ctx.lineTo(mx(p.x), my(p.y)) : ctx.moveTo(mx(p.x), my(p.y))); ctx.fill(); }
      ctx.globalAlpha = 1;
    };

    panels.forEach((name, ci) => {
      const ox = ci * cw, oy = title;
      ctx.strokeStyle = '#3a3d45'; ctx.strokeRect(ox + 0.5, oy + 0.5, cw - 1, ch - 1);
      const isAll = name === '= overlaid', isCoded = name === '◆ colour-coded';
      if (!isAll && !isCoded) for (const o of scoped) drawOp(ox, oy, o, '#8a8f98', 0.12); // ghost of the whole part
      for (const o of scoped) {
        const g = labelOf(o);
        if (isAll) drawOp(ox, oy, o);
        else if (isCoded) drawOp(ox, oy, o, colorOf(g), Math.max(0.55, o.alpha));
        else if (g === name) drawOp(ox, oy, o);
      }
      ctx.fillStyle = isCoded ? '#cfd3da' : (isAll ? '#cfd3da' : colorOf(name));
      ctx.font = '12px monospace';
      ctx.fillText(name, ox + 6, oy + ch - label / 2);
    });
    return { dataUrl: cv.toDataURL('image/png').split(',')[1], key, groups };
  }, { rawKey, part, SCALE });

  if (result.error) {
    console.error(result.error);
    if (result.keys) console.error('available keys:\n  ' + result.keys.join('  '));
    if (result.parts) console.error('available parts:\n  ' + result.parts.join('  '));
    process.exitCode = 1;
  } else {
    const fs = await import('fs');
    fs.writeFileSync(OUT, Buffer.from(result.dataUrl, 'base64'));
    console.log(`dissect saved: ${OUT}  (${result.key}: ${result.groups.join(', ')}, ${SCALE}x)`);
  }
} catch (e) {
  console.error('dissect failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
