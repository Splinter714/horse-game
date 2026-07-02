// Dev tool: render the horse's idle sprite (already generated procedurally at
// runtime — there are no static art assets in this repo) onto a filled square
// background at each size the PWA manifest / apple-touch-icon needs, and save
// them as real PNG files under public/icons/. Run once whenever the icon
// subject/background should change; the output is committed (manifests need
// static files, they can't reference a runtime canvas).
//
// Usage: start the dev server (npm run dev), then: node scripts/gen-pwa-icons.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveDevServerUrl } from './dev-server-url.mjs';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// Background matches the page's own background (index.html) so the icon reads
// as part of the app rather than a random sprite floating on white.
const BG = '#1c2330';
const SIZES = [
  { name: 'icon-192.png', size: 192, pad: 0.18 },
  { name: 'icon-512.png', size: 512, pad: 0.18 },
  { name: 'icon-1024.png', size: 1024, pad: 0.18 }, // full-bleed for macOS Safari "Add to Dock"
  { name: 'icon-maskable-512.png', size: 512, pad: 0.30 }, // maskable needs a big safe-zone margin
  { name: 'apple-touch-icon.png', size: 180, pad: 0.14 },  // iOS doesn't apply a mask, can fill more
];

const devUrl = await resolveDevServerUrl();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(devUrl, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(
  () => window.__game?.scene?.isActive('PaddockScene') && window.__game.registry.get('allHorses'),
  { timeout: 20000 },
);

for (const { name, size, pad } of SIZES) {
  const dataUrl = await page.evaluate(({ size, pad, BG }) => {
    const game = window.__game;
    const src = game.textures.get('horse_idle_0').getSourceImage();

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, size, size);

    // Fit the sprite into the safe area (size minus padding) preserving aspect ratio.
    const safe = size * (1 - pad * 2);
    const scale = Math.min(safe / src.width, safe / src.height);
    const w = src.width * scale, h = src.height * scale;
    const x = (size - w) / 2, y = (size - h) / 2;
    ctx.drawImage(src, x, y, w, h);

    return canvas.toDataURL('image/png');
  }, { size, pad, BG });

  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  await import('node:fs/promises').then(fs => fs.writeFile(join(OUT_DIR, name), buf));
  console.log('wrote', name, `${size}x${size}`);
}

await browser.close();
