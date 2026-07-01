// Dev tool: render a creature's procedural sprite frames side-by-side into a PNG so
// you can eyeball the art while iterating (these sprites are generated at runtime, so
// there's no asset file to open). Works for ANY creature — it reads the live textures,
// auto-detects which frames exist, and uses each frame's own pixel size, so nothing is
// hardcoded per species. Renderer-agnostic (loads the game with ?canvas like smoke).
//
// Usage: start the dev server (npm run dev), then:
//   npm run sprites cat
//   npm run sprites horse chicken0 foal1      (multiple keys → one row each)
//   SPRITE_SCALE=10 SPRITE_OUT=/tmp/foo.png npm run sprites cat
//
// Each argument is a texture-key prefix: cat, horse, horse2, chicken0, foal1, cow, …
// (the underscore guard means `horse` won't pick up `horse2`'s frames).

import { chromium } from 'playwright';
import { resolveDevServerUrl } from './dev-server-url.mjs';

const keys = process.argv.slice(2).filter(a => a !== '--');
if (!keys.length) {
  console.error('usage: npm run sprites <key> [key...]   e.g. npm run sprites cat horse chicken0');
  process.exit(1);
}

const SCALE = Number(process.env.SPRITE_SCALE || 8);
const OUT   = process.env.SPRITE_OUT || '/tmp/sprite-preview.png';
const URL   = await resolveDevServerUrl();

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(
    () => window.__game?.scene?.isActive('PaddockScene') && window.__game.registry.get('allHorses'),
    { timeout: 20000 },
  );

  const dataUrl = await page.evaluate(({ keys, SCALE }) => {
    const game = window.__game;
    // Preferred frame order; anything unknown falls to the end, alphabetically.
    const ORDER = ['idle_0','idle_1','walk_0','walk_1','walk_2','walk_3','eat_0','eat_1','sleep_0','sleep_1','nap_0','nap_1','pounce_0'];
    const rank = (s) => { const i = ORDER.indexOf(s); return i < 0 ? 100 : i; };

    const rows = keys.map((key) => {
      const frames = game.textures.getTextureKeys()
        .filter((k) => k.startsWith(key + '_'))
        .map((k) => ({ k, suffix: k.slice(key.length + 1) }))
        // keep only real animation frames (skip any deeper/compound keys)
        .filter((f) => ORDER.includes(f.suffix))
        .sort((a, b) => rank(a.suffix) - rank(b.suffix));
      return { key, frames };
    }).filter((r) => r.frames.length);

    if (!rows.length) return null;

    const PAD = 14, LABEL = 20;
    let maxW = 0, maxH = 0;
    for (const r of rows) for (const f of r.frames) {
      const img = game.textures.get(f.k).getSourceImage();
      maxW = Math.max(maxW, img.width); maxH = Math.max(maxH, img.height);
    }
    const cellW = maxW * SCALE + PAD * 2;
    const cellH = maxH * SCALE + PAD * 2 + LABEL;
    const cols  = Math.max(...rows.map((r) => r.frames.length));

    const cv = document.createElement('canvas');
    cv.width = cellW * cols;
    cv.height = cellH * rows.length;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#7ab648'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '13px monospace';

    rows.forEach((r, ri) => {
      r.frames.forEach((f, ci) => {
        const img = game.textures.get(f.k).getSourceImage();
        const x = ci * cellW + PAD;
        // bottom-align (sprites have their feet at the bottom edge)
        const y = ri * cellH + PAD + (maxH - img.height) * SCALE;
        ctx.drawImage(img, x, y, img.width * SCALE, img.height * SCALE);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(f.k, ci * cellW + PAD, (ri + 1) * cellH - 6);
      });
    });
    return cv.toDataURL('image/png').split(',')[1];
  }, { keys, SCALE });

  if (!dataUrl) {
    console.error('no frames found for: ' + keys.join(', ') + '  (is the key right? is the dev server running?)');
    process.exitCode = 1;
  } else {
    const fs = await import('fs');
    fs.writeFileSync(OUT, Buffer.from(dataUrl, 'base64'));
    console.log(`sprite preview saved: ${OUT}  (keys: ${keys.join(', ')}, ${SCALE}x)`);
  }
} catch (e) {
  console.error('sprite-preview failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
